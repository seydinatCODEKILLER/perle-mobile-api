import { Expo } from "expo-server-sdk";
import { PushTokenRepository } from "./push-token.repository.js";

const expo = new Expo();
const pushTokenRepo = new PushTokenRepository();

export class PushTokenService {

  // ─── Enregistrer ou mettre à jour un token ────────────────────
  async registerToken(userId, { token, platform, deviceName }) {
    if (!Expo.isExpoPushToken(token)) {
      throw new Error(`Token Expo invalide : ${token}`);
    }

    return pushTokenRepo.upsertToken(userId, { token, platform, deviceName });
  }

  // ─── Révoquer un token (logout d'un device) ───────────────────
  async revokeToken(userId, token) {
    return pushTokenRepo.deactivateToken(userId, token);
  }

  // ─── Révoquer tous les tokens (logout global) ─────────────────
  async revokeAllTokens(userId) {
    return pushTokenRepo.deactivateAllForUser(userId);
  }

  // ─── Envoyer à un utilisateur (tous ses devices) ──────────────
  async sendToUser(userId, { title, body, data = {} }) {
    const records = await pushTokenRepo.findActiveByUserId(userId);
    const tokens = records.map((r) => r.token);
    if (tokens.length === 0) return { sent: 0, skipped: 0 };
    return this.#sendToTokens(tokens, { title, body, data });
  }

  // ─── Envoyer à plusieurs utilisateurs ────────────────────────
  async sendToUsers(userIds, { title, body, data = {} }) {
    const records = await pushTokenRepo.findActiveByUserIds(userIds);
    const tokens = records.map((r) => r.token);
    if (tokens.length === 0) return { sent: 0, skipped: 0 };
    return this.#sendToTokens(tokens, { title, body, data });
  }

  // ─── Envoi interne (chunked, gestion DeviceNotRegistered) ─────
  async #sendToTokens(tokens, { title, body, data }) {
    const validTokens = tokens.filter((t) => Expo.isExpoPushToken(t));
    const skipped = tokens.length - validTokens.length;

    if (validTokens.length === 0) return { sent: 0, skipped };

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
          } else if (
            receipt.status === "error" &&
            receipt.details?.error === "DeviceNotRegistered"
          ) {
            // Token invalide → désactivation via repository
            await pushTokenRepo
              .deactivateByToken(chunk[i].to)
              .catch(() => {});
          }
        }
      } catch (error) {
        console.error("[PUSH] Erreur envoi chunk:", error.message);
      }
    }

    return { sent, skipped };
  }
}

// Singleton exporté pour usage dans les autres services
export const pushTokenService = new PushTokenService();