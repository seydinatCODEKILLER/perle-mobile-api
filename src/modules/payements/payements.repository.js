import { prisma } from "../../config/database.js";
import { BaseRepository } from "../../shared/base/base.repository.js";

export class PaymentRepository extends BaseRepository {
  constructor() {
    super(prisma.transaction);
  }

  // ─── Vérification d'accès ─────────────────────────────────────

  async findActiveMembership(userId, organizationId) {
    return prisma.membership.findFirst({
      where: { userId, organizationId, status: "ACTIVE" },
    });
  }

  // ─── Wallet ───────────────────────────────────────────────────

  async findWalletByOrganization(organizationId) {
    return prisma.organizationWallet.findUnique({
      where: { organizationId },
    });
  }

  // ─── Ressources payables ──────────────────────────────────────

  async findContribution(resourceId, organizationId) {
    return prisma.contribution.findFirst({
      where: { id: resourceId, organizationId },
      include: { contributionPlan: { select: { name: true } } },
    });
  }

  async findDebt(resourceId, organizationId) {
    return prisma.debt.findFirst({
      where: { id: resourceId, organizationId },
    });
  }

  // ─── Sessions Wave ────────────────────────────────────────────

  async findPendingWaveSession(resourceId, organizationId) {
    return prisma.transaction.findFirst({
      where: {
        organizationId,
        metadata: { path: ["resourceId"], equals: resourceId },
        paymentMethod: "WAVE",
        paymentStatus: "PENDING",
      },
    });
  }

  // ─── Création de transaction ──────────────────────────────────

  async createPendingTransaction({
    membershipId,
    organizationId,
    type,
    amount,
    currency,
    walletId,
    resourceId,
    waveSessionId,
    description,
  }) {
    return prisma.transaction.create({
      data: {
        membershipId,
        organizationId,
        type,
        amount,
        currency,
        paymentMethod: "WAVE",
        paymentStatus: "PENDING",
        walletId,
        description,
        waveSessionId,
        reference: `WAVE-${waveSessionId}`,
        metadata: { resourceId, type, organizationId },
      },
    });
  }

  // ─── Confirmation atomique (idempotente) ──────────────────────

  async confirmTransactionAtomic(waveSessionId) {
    const result = await prisma.transaction.updateMany({
      where: {
        waveSessionId,
        paymentStatus: "PENDING",
      },
      data: { paymentStatus: "COMPLETED" },
    });

    if (result.count === 0) return null;

    return prisma.transaction.findUnique({
      where: { waveSessionId },
    });
  }

  // ─── Échec ────────────────────────────────────────────────────

  async failTransaction(waveSessionId, reason) {
    return prisma.transaction.updateMany({
      where: { waveSessionId, paymentStatus: "PENDING" },
      data: {
        paymentStatus: "FAILED",
        metadata: {
          failReason: reason || "Inconnu",
          failedAt: new Date().toISOString(),
        },
      },
    });
  }

  async findByWaveSessionId(waveSessionId) {
    return prisma.transaction.findUnique({ where: { waveSessionId } });
  }

  // ─── Appliquer paiement cotisation (dans transaction Prisma) ──

  async applyContributionPayment(tx, resourceId, transactionId, amount) {
    await tx.contribution.update({
      where: { id: resourceId },
      data: {
        status: "PAID",
        amountPaid: amount,
        paymentDate: new Date(),
        paymentMethod: "WAVE",
        transactionId,
      },
    });
  }

  async creditWallet(tx, walletId, amount) {
    await tx.organizationWallet.update({
      where: { id: walletId },
      data: {
        currentBalance: { increment: amount },
        totalIncome: { increment: amount },
      },
    });
  }

  // ─── Appliquer remboursement dette (dans transaction Prisma) ──

  async applyDebtRepayment(tx, resourceId, transactionId, amount, newRemaining, isFullyPaid) {
    await tx.repayment.create({
      data: {
        debtId: resourceId,
        amount,
        paymentMethod: "WAVE",
        paymentDate: new Date(),
        transactionId,
      },
    });

    await tx.debt.update({
      where: { id: resourceId },
      data: {
        remainingAmount: newRemaining,
        status: isFullyPaid ? "PAID" : "PARTIALLY_PAID",
      },
    });
  }

  // ─── Expirer les vieilles sessions ────────────────────────────

  async expireOldSessions() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return prisma.transaction.updateMany({
      where: {
        paymentMethod: "WAVE",
        paymentStatus: "PENDING",
        createdAt: { lt: oneHourAgo },
      },
      data: { paymentStatus: "FAILED" },
    });
  }

  // ─── Transaction Prisma atomique ──────────────────────────────

  async runTransaction(fn) {
    return prisma.$transaction(fn);
  }
}