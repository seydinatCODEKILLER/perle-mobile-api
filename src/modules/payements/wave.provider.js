import crypto from "crypto";
import { env } from "../../../config/env.js";
import logger from "../../../config/logger.js";

const WAVE_WEBHOOK_TOLERANCE_SECONDS = 300;

export class WaveProvider {
  #baseUrl = "https://api.wave.com/v1";
  #apiKey = env.WAVE_API_KEY;

  // ─────────────────────────────────────────────────────────────
  // Headers communs Wave
  // ─────────────────────────────────────────────────────────────
  #headers() {
    if (!this.#apiKey) {
      throw new Error("WAVE_API_KEY manquant");
    }

    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.#apiKey}`,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Initier une session de paiement
  // ─────────────────────────────────────────────────────────────
  async initiatePayment({
    amount,
    currency = "XOF",
    clientReference,
    successUrl,
    errorUrl,
  }) {
    try {
      const response = await fetch(`${this.#baseUrl}/checkout/sessions`, {
        method: "POST",
        headers: this.#headers(),
        body: JSON.stringify({
          amount: String(Number(amount)),
          currency,
          client_reference: clientReference,
          success_url: successUrl,
          error_url: errorUrl,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          `Wave API error [${response.status}]: ${error.message || response.statusText}`,
        );
      }

      const data = await response.json();

      return {
        waveSessionId: data.id,
        paymentUrl: data.wave_launch_url,
        clientReference: data.client_reference,
        expiresAt: data.when_expires,
      };
    } catch (error) {
      logger.logError(error, { context: "WAVE_INITIATE_PAYMENT" });
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Vérifier le statut d'une session
  // ─────────────────────────────────────────────────────────────
  async checkPaymentStatus(waveSessionId) {
    try {
      const response = await fetch(
        `${this.#baseUrl}/checkout/sessions/${waveSessionId}`,
        { headers: this.#headers() },
      );

      if (!response.ok) {
        throw new Error(
          `Wave API error [${response.status}]: ${response.statusText}`,
        );
      }

      const data = await response.json();

      const statusMap = {
        pending: "PENDING",
        succeeded: "COMPLETED",
        failed: "FAILED",
      };

      return {
        status: statusMap[data.payment_status] ?? "FAILED",
        amount: Number(data.amount),
        currency: data.currency,
        waveTransactionId: data.transaction_id,
        clientReference: data.client_reference,
        paidAt: data.last_payment_date
          ? new Date(data.last_payment_date)
          : null,
        rawStatus: data.payment_status,
      };
    } catch (error) {
      logger.logError(error, { context: "WAVE_CHECK_STATUS" });
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Remboursement Wave
  // ─────────────────────────────────────────────────────────────
  async refund({ phone, amount, waveTransactionId, reason }) {
    try {
      const response = await fetch(`${this.#baseUrl}/transfers`, {
        method: "POST",
        headers: this.#headers(),
        body: JSON.stringify({
          receive_amount: String(Number(amount)),
          currency: "XOF",
          mobile: phone,
          name: reason || "Remboursement",
          client_reference: `REFUND-${waveTransactionId}-${Date.now()}`,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          `Wave refund error [${response.status}]: ${error.message || response.statusText}`,
        );
      }

      return await response.json();
    } catch (error) {
      logger.logError(error, { context: "WAVE_REFUND" });
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Vérification webhook Wave (HMAC + anti-replay)
  // rawBody = Buffer (express.raw)
  // ─────────────────────────────────────────────────────────────
  verifyWebhookSignature(rawBody, signature, timestamp) {
    if (!env.WAVE_WEBHOOK_SECRET) {
      throw new Error("WAVE_WEBHOOK_SECRET manquant");
    }

    if (!rawBody || !signature || !timestamp) return false;

    const now = Math.floor(Date.now() / 1000);
    const ts = Number(timestamp);
    const age = now - ts;

    // Anti-replay + horloge
    if (isNaN(ts) || Math.abs(age) > WAVE_WEBHOOK_TOLERANCE_SECONDS) {
      return false;
    }

    // Payload signé : timestamp.body
    const signedPayload = `${timestamp}.${rawBody.toString("utf8")}`;

    const expectedSignature = crypto
      .createHmac("sha256", env.WAVE_WEBHOOK_SECRET)
      .update(signedPayload)
      .digest("hex");

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature, "hex"),
        Buffer.from(expectedSignature, "hex"),
      );
    } catch {
      return false;
    }
  }
}