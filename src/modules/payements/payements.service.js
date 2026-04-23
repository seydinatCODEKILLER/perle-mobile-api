import { WaveProvider } from "./providers/wave.provider.js";
import { PaymentRepository } from "./payment.repository.js";
import { NotificationService } from "../notifications/notification.module.js";
import {
  NotFoundError,
  ConflictError,
  ForbiddenError,
} from "../../shared/errors/AppError.js";

const waveProvider = new WaveProvider();
const paymentRepo = new PaymentRepository();
const notificationService = new NotificationService();

export class PaymentService {

  // ─── Initier un paiement Wave ─────────────────────────────────
  async initiateWavePayment(organizationId, data, userId) {
    const { type, resourceId, successUrl, errorUrl } = data;

    // 1. Vérifier que l'utilisateur est membre actif de l'organisation
    const membership = await paymentRepo.findActiveMembership(userId, organizationId);
    if (!membership) {
      throw new ForbiddenError("Accès non autorisé à cette organisation");
    }

    // 2. Valider la ressource ET vérifier qu'elle appartient à l'organisation
    const { amount, description } = await this.#resolveResource(
      type,
      resourceId,
      organizationId,
    );

    // 3. Vérifier qu'aucune session Wave n'est déjà en cours
    const existingSession = await paymentRepo.findPendingWaveSession(
      resourceId,
      organizationId,
    );
    if (existingSession) {
      throw new ConflictError(
        "Un paiement Wave est déjà en cours pour cette ressource. " +
        "Attendez sa confirmation ou son expiration (1h).",
      );
    }

    // 4. Récupérer le wallet de l'organisation
    const wallet = await paymentRepo.findWalletByOrganization(organizationId);
    if (!wallet) throw new NotFoundError("Portefeuille de l'organisation");

    // 5. Créer la session Wave
    const session = await waveProvider.initiatePayment({
      amount,
      currency: wallet.currency,
      clientReference: `${type}-${resourceId}-${organizationId}`,
      successUrl,
      errorUrl,
    });

    // 6. Persister la transaction PENDING
    await paymentRepo.createPendingTransaction({
      membershipId: membership.id,
      organizationId,
      type,
      amount,
      currency: wallet.currency,
      walletId: wallet.id,
      resourceId,
      waveSessionId: session.waveSessionId,
      description,
    });

    return {
      paymentUrl: session.paymentUrl,
      waveSessionId: session.waveSessionId,
      amount,
      currency: wallet.currency,
      expiresAt: session.expiresAt,
    };
  }

  // ─── Vérifier manuellement le statut (polling fallback) ───────
  async checkPaymentStatus(organizationId, waveSessionId, userId) {
    // Vérifier accès
    const membership = await paymentRepo.findActiveMembership(userId, organizationId);
    if (!membership) {
      throw new ForbiddenError("Accès non autorisé à cette organisation");
    }

    const status = await waveProvider.checkPaymentStatus(waveSessionId);

    if (status.status === "succeeded") {
      await this.#handleSuccess(waveSessionId);
    } else if (status.status === "failed") {
      await paymentRepo.failTransaction(waveSessionId, "Paiement échoué côté Wave");
    }

    return status;
  }

  // ─── Traiter le webhook Wave ───────────────────────────────────
  async handleWebhook(rawBody, signature, timestamp) {
    // 1. Vérifier signature + anti-replay AVANT de parser
    const isValid = waveProvider.verifyWebhookSignature(
      rawBody,
      signature,
      timestamp,
    );

    if (!isValid) {
      throw new ForbiddenError("Signature webhook Wave invalide");
    }

    // 2. Parser après validation
    let payload;
    try {
      payload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      throw new Error("Payload webhook Wave invalide (JSON malformé)");
    }

    const { payment_status, id: waveSessionId, failure_reason } = payload;

    if (payment_status === "succeeded") {
      await this.#handleSuccess(waveSessionId);
    } else if (payment_status === "failed") {
      await paymentRepo.failTransaction(
        waveSessionId,
        failure_reason || "Échec Wave",
      );
    }

    return { received: true };
  }

  // ─── Expirer les sessions périmées (cron) ─────────────────────
  async expireOldSessions() {
    const result = await paymentRepo.expireOldSessions();
    return { expired: result.count };
  }

  // ─── Logique de succès — atomique et idempotente ──────────────
  async #handleSuccess(waveSessionId) {
    // updateMany atomique — un seul webhook sera traité
    const transaction = await paymentRepo.confirmTransactionAtomic(waveSessionId);

    // null = déjà traité par un webhook précédent → sortie silencieuse
    if (!transaction) return;

    const { resourceId, type, organizationId } = transaction.metadata;

    const wallet = await paymentRepo.findWalletByOrganization(organizationId);
    if (!wallet) return;

    // Tout dans une transaction Prisma atomique
    await paymentRepo.runTransaction(async (tx) => {
      if (type === "CONTRIBUTION") {
        await this.#applyContributionPayment(tx, resourceId, transaction, wallet);
      } else if (type === "DEBT") {
        await this.#applyDebtRepayment(tx, resourceId, transaction, wallet);
      }
    });

    // Notification après la transaction — fire & forget
    notificationService
      .sendPaymentConfirmation(organizationId, transaction.membershipId, {
        title: type === "CONTRIBUTION" ? "Cotisation" : "Remboursement de dette",
        amount: transaction.amount,
      })
      .catch(() => {});
  }

  // ─── Appliquer le paiement d'une cotisation ───────────────────
  async #applyContributionPayment(tx, resourceId, transaction, wallet) {
    const contribution = await paymentRepo.findContribution(
      resourceId,
      transaction.metadata.organizationId,
    );

    if (!contribution) return;
    if (contribution.status === "PAID") return;
    if (contribution.status === "CANCELLED") return;

    await paymentRepo.applyContributionPayment(
      tx,
      resourceId,
      transaction.id,
      contribution.amount,
    );

    await paymentRepo.creditWallet(tx, wallet.id, contribution.amount);
  }

  // ─── Appliquer le remboursement d'une dette ───────────────────
  async #applyDebtRepayment(tx, resourceId, transaction, wallet) {
    const debt = await paymentRepo.findDebt(
      resourceId,
      transaction.metadata.organizationId,
    );

    if (!debt) return;
    if (debt.status === "PAID") return;
    if (debt.status === "CANCELLED") return;

    const amount = transaction.amount;
    const newRemaining = Math.max(0, debt.remainingAmount - amount);
    const isFullyPaid = newRemaining === 0;

    await paymentRepo.applyDebtRepayment(
      tx,
      resourceId,
      transaction.id,
      amount,
      newRemaining,
      isFullyPaid,
    );

    await paymentRepo.creditWallet(tx, wallet.id, amount);
  }

  // ─── Résoudre la ressource + vérification organisationId ──────
  async #resolveResource(type, resourceId, organizationId) {
    if (type === "CONTRIBUTION") {
      const contribution = await paymentRepo.findContribution(
        resourceId,
        organizationId,
      );

      if (!contribution) throw new NotFoundError("Cotisation");
      if (contribution.status === "PAID") {
        throw new ConflictError("Cette cotisation est déjà payée.");
      }
      if (contribution.status === "CANCELLED") {
        throw new ForbiddenError("Impossible de payer une cotisation annulée.");
      }

      const remaining = contribution.amount - contribution.amountPaid;
      if (remaining <= 0) {
        throw new ConflictError("Le montant restant de cette cotisation est nul.");
      }

      return {
        amount: remaining,
        description: `Cotisation Wave — ${contribution.contributionPlan.name}`,
      };
    }

    if (type === "DEBT") {
      const debt = await paymentRepo.findDebt(resourceId, organizationId);

      if (!debt) throw new NotFoundError("Dette");
      if (debt.status === "PAID") {
        throw new ConflictError("Cette dette est déjà remboursée.");
      }
      if (debt.status === "CANCELLED") {
        throw new ForbiddenError("Impossible de rembourser une dette annulée.");
      }
      if (debt.remainingAmount <= 0) {
        throw new ConflictError("Le montant restant de cette dette est nul.");
      }

      return {
        amount: debt.remainingAmount,
        description: `Remboursement Wave — ${debt.title}`,
      };
    }

    throw new ForbiddenError("Type de ressource non supporté");
  }
}