import { prisma } from "../../config/database.js";
import { BaseRepository } from "../../shared/base/base.repository.js";

export class WalletRepository extends BaseRepository {
  constructor() {
    super(prisma.organizationWallet);
  }

  // ─── Lectures ───────────────────────────────────────────────

  async findByOrganizationId(organizationId) {
    return prisma.organizationWallet.findUnique({
      where: { organizationId },
      include: {
        organization: { select: { id: true, name: true, currency: true } },
      },
    });
  }

  async findByIdAndOrgId(walletId, organizationId) {
    return prisma.organizationWallet.findFirst({
      where: { id: walletId, organizationId },
      include: {
        organization: { select: { id: true, name: true, currency: true } },
      },
    });
  }

  // ─── Membership (Uniquement la recherche) ───────────────────

  async findActiveMembership(userId, organizationId, roles = []) {
    return prisma.membership.findFirst({
      where: {
        userId: String(userId),
        organizationId,
        status: "ACTIVE",
        ...(roles.length && { role: { in: roles } }),
      },
    });
  }

  // ─── Stats & Calculs ────────────────────────────────────────

  async calculateStats(organizationId) {
    const [income, expenses] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          organizationId,
          paymentStatus: "COMPLETED",
          type: { not: "EXPENSE" },
        },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.expense.aggregate({
        where: { organizationId, status: { not: "CANCELLED" } },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      incomeTotal: income._sum.amount || 0,
      incomeCount: income._count,
      expensesTotal: expenses._sum.amount || 0,
      expensesCount: expenses._count,
      netBalance: (income._sum.amount || 0) - (expenses._sum.amount || 0),
    };
  }

  // ─── Transactions Atomiques ─────────────────────────────────

  async createWithAudit(organizationId, currency, auditData) {
    return prisma.$transaction(async (tx) => {
      const wallet = await tx.organizationWallet.create({
        data: {
          organizationId,
          initialBalance: 0,
          currentBalance: 0,
          totalIncome: 0,
          currency,
        },
        include: {
          organization: { select: { id: true, name: true, currency: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          userId: auditData.userId,
          membershipId: auditData.membershipId,
          action: "CREATE_WALLET",
          resource: "OrganizationWallet",
          resourceId: wallet.id,
          details: auditData.details || {},
        },
      });

      return wallet;
    });
  }

  async reconcileWithAudit(organizationId, walletId, data) {
    return prisma.$transaction(async (tx) => {
      // 1. Créer la transaction d'ajustement
      const transaction = await tx.transaction.create({
        data: {
          organizationId,
          walletId, // ✅ Lié au wallet pour la traçabilité
          membershipId: data.membershipId,
          type: "WALLET_SETTLEMENT", // ✅ Plus logique que "OTHER" ou "EXPENSE"
          amount: Math.abs(data.difference),
          description: `Ajustement de réconciliation${data.note ? ` : ${data.note}` : ""}`,
          paymentMethod: "INTERNAL", // ✅ C'est un ajustement interne, pas du "CASH"
          paymentStatus: "COMPLETED",
          metadata: {
            reconciliation: true,
            previousBalance: data.previousBalance,
            expectedBalance: data.expectedBalance,
          },
        },
      });

      // 2. Mettre à jour le solde du wallet
      await tx.organizationWallet.update({
        where: { organizationId },
        data: {
          currentBalance: data.expectedBalance,
          ...(data.difference > 0
            ? { totalIncome: { increment: data.difference } }
            : { totalExpenses: { increment: Math.abs(data.difference) } }),
        },
      });

      // 3. Logger l'audit log (Utilisation des vrais champs financiers du schema !)
      await tx.auditLog.create({
        data: {
          organizationId,
          userId: data.userId,
          membershipId: data.membershipId,
          action: "RECONCILE_WALLET",
          resource: "OrganizationWallet",
          resourceId: walletId,
          financialImpact: data.difference, // ✅ Impact réel
          previousBalance: data.previousBalance, // ✅ Traçabilité Prisma
          newBalance: data.expectedBalance, // ✅ Traçabilité Prisma
          details: {
            transactionId: transaction.id,
            difference: data.difference,
            note: data.note,
          },
        },
      });

      return {
        transactionId: transaction.id,
        previousBalance: data.previousBalance,
        newBalance: data.expectedBalance,
        difference: data.difference,
      };
    });
  }
}
