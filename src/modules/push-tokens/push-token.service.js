import { Expo } from "expo-server-sdk";
import { PushTokenRepository } from "./push-token.repository.js";
import logger from "../../config/logger.js";

const expo = new Expo();
const pushTokenRepo = new PushTokenRepository();

export class PushTokenService {
  async registerToken(userId, { token, platform, deviceName }) {
    if (!Expo.isExpoPushToken(token)) {
      logger.warn({ userId, token }, "[PUSH] Token Expo invalide");
      throw new Error(`Token Expo invalide : ${token}`);
    }

    const result = await pushTokenRepo.upsertToken(userId, {
      token,
      platform,
      deviceName,
    });
    logger.info(
      { userId, platform, deviceName },
      "[PUSH] Token enregistré en base",
    );
    return result;
  }

  async revokeToken(userId, token) {
    const result = await pushTokenRepo.deactivateToken(userId, token);
    logger.info({ userId }, "[PUSH] Token révoqué");
    return result;
  }

  async revokeAllTokens(userId) {
    const result = await pushTokenRepo.deactivateAllForUser(userId);
    logger.info({ userId }, "[PUSH] Tous les tokens révoqués");
    return result;
  }

  async sendToUser(userId, { title, body, data = {} }) {
    const records = await pushTokenRepo.findActiveByUserId(userId);

    logger.info(
      { userId, tokenCount: records.length, title },
      "[PUSH] sendToUser",
    );

    if (records.length === 0) {
      logger.warn(
        { userId },
        "[PUSH] Aucun token actif trouvé pour cet utilisateur",
      );
      return { sent: 0, skipped: 0 };
    }

    const tokens = records.map((r) => r.token);
    return this.#sendToTokens(tokens, { title, body, data });
  }

  async sendToUsers(userIds, { title, body, data = {} }) {
    const records = await pushTokenRepo.findActiveByUserIds(userIds);

    logger.info(
      { userCount: userIds.length, tokenCount: records.length, title },
      "[PUSH] sendToUsers",
    );

    if (records.length === 0) {
      logger.warn(
        { userIds },
        "[PUSH] Aucun token actif trouvé pour ces utilisateurs",
      );
      return { sent: 0, skipped: 0 };
    }

    const tokens = records.map((r) => r.token);
    return this.#sendToTokens(tokens, { title, body, data });
  }

  async #sendToTokens(tokens, { title, body, data }) {
    const validTokens = tokens.filter((t) => Expo.isExpoPushToken(t));
    const skipped = tokens.length - validTokens.length;

    if (skipped > 0) {
      logger.warn(
        {
          skipped,
          invalidTokens: tokens.filter((t) => !Expo.isExpoPushToken(t)),
        },
        "[PUSH] Tokens invalides ignorés",
      );
    }

    if (validTokens.length === 0) {
      logger.warn("[PUSH] Aucun token valide à envoyer");
      return { sent: 0, skipped };
    }

    const messages = validTokens.map((token) => ({
      to: token,
      sound: "default",
      title,
      body,
      data,
    }));

    let sent = 0;
    const chunks = expo.chunkPushNotifications(messages);

    for (const chunk of chunks) {
      try {
        const receipts = await expo.sendPushNotificationsAsync(chunk);

        for (let i = 0; i < receipts.length; i++) {
          const receipt = receipts[i];

          if (receipt.status === "ok") {
            sent++;
            logger.info(
              { token: chunk[i].to },
              "[PUSH] Notification envoyée avec succès",
            );
          } else if (receipt.status === "error") {
            logger.error(
              {
                token: chunk[i].to,
                error: receipt.details?.error,
                message: receipt.message,
              },
              "[PUSH] Erreur réception Expo",
            );

            if (receipt.details?.error === "DeviceNotRegistered") {
              logger.warn(
                { token: chunk[i].to },
                "[PUSH] DeviceNotRegistered → désactivation du token",
              );
              await pushTokenRepo
                .deactivateByToken(chunk[i].to)
                .catch((err) =>
                  logger.error(
                    { err, token: chunk[i].to },
                    "[PUSH] Échec désactivation token",
                  ),
                );
            }
          }
        }
      } catch (error) {
        logger.logError(error, {
          context: "[PUSH] Erreur envoi chunk",
          chunkSize: chunk.length,
        });
      }
    }

    logger.info(
      { sent, skipped, total: validTokens.length },
      "[PUSH] Résultat envoi",
    );
    return { sent, skipped };
  }
}

export const pushTokenService = new PushTokenService();
