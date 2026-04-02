// src/modules/debts/debt.repository.js
import { prisma } from "../../config/database.js";
import { BaseRepository } from "../../shared/base/base.repository.js";

const MEMBERSHIP_INCLUDE = {
  include: {
    user: {
      select: {
        id: true,
        prenom: true,
        nom: true,
        email: true,
        phone: true,
        avatar: true,
        gender: true,
      },
    },
  },
};

export class DebtRepository extends BaseRepository {
  constructor() {
    super(prisma.debt);
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

  async findMembershipById(membershipId) {
    return prisma.membership.findUnique({
      where: { id: membershipId },
      ...MEMBERSHIP_INCLUDE,
    });
  }

  // ─── Lectures ───────────────────────────────────────────────

  async findByIdWithDetails(debtId, organizationId) {
    return prisma.debt.findFirst({
      where: { id: debtId, organizationId },
      include: {
        membership: MEMBERSHIP_INCLUDE,
        repayments: {
          orderBy: { paymentDate: "desc" },
          include: {
            transaction: {
              select: {
                id: true,
                reference: true,
                paymentStatus: true,
                paymentMethod: true,
              },
            },
          },
        },
      },
    });
  }

  async findSimpleById(debtId) {
    return prisma.debt.findUnique({
      where: { id: debtId },
    });
  }

  async findRepaymentsByDebtId(debtId) {
    return prisma.repayment.findMany({
      where: { debtId },
      include: {
        transaction: {
          select: {
            id: true,
            reference: true,
            paymentStatus: true,
            paymentMethod: true,
          },
        },
      },
      orderBy: { paymentDate: "desc" },
    });
  }

  async findWithFilters(
    organizationId,
    { status, membershipId, search, page, limit },
  ) {
    const skip = (page - 1) * limit;

    const where = {
      organizationId,
      ...(status && { status }),
      ...(membershipId && { membershipId }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          {
            membership: {
              OR: [
                {
                  user: {
                    OR: [
                      { prenom: { contains: search, mode: "insensitive" } },
                      { nom: { contains: search, mode: "insensitive" } },
                    ],
                  },
                },
                {
                  provisionalFirstName: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
                {
                  provisionalLastName: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              ],
            },
          },
        ],
      }),
    };

    const [debts, total] = await Promise.all([
      prisma.debt.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          membership: MEMBERSHIP_INCLUDE,
          repayments: { take: 3, orderBy: { paymentDate: "desc" } },
        },
      }),
      prisma.debt.count({ where }),
    ]);

    return { debts, total };
  }

  async findMemberDebts(organizationId, membershipId, { status, page, limit }) {
    const skip = (page - 1) * limit;

    const where = {
      organizationId,
      membershipId,
      ...(status && { status }),
    };

    const [debts, total, totals] = await Promise.all([
      prisma.debt.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dueDate: "desc" },
        include: {
          membership: MEMBERSHIP_INCLUDE,
          repayments: { orderBy: { paymentDate: "desc" } },
        },
      }),
      prisma.debt.count({ where }),
      prisma.debt.aggregate({
        where,
        _sum: { initialAmount: true, remainingAmount: true },
      }),
    ]);

    return { debts, total, totals };
  }

  async getSummaryStats(organizationId) {
    const [
      totalDebts,
      activeDebts,
      overdueDebts,
      paidDebts,
      recentRepayments,
      wallet,
    ] = await Promise.all([
      prisma.debt.aggregate({
        where: { organizationId },
        _sum: { initialAmount: true },
        _count: true,
      }),
      prisma.debt.aggregate({
        where: { organizationId, status: { in: ["ACTIVE", "PARTIALLY_PAID"] } },
        _sum: { remainingAmount: true },
        _count: true,
      }),
      prisma.debt.count({ where: { organizationId, status: "OVERDUE" } }),
      prisma.debt.aggregate({
        where: { organizationId, status: "PAID" },
        _sum: { initialAmount: true },
        _count: true,
      }),
      prisma.repayment.aggregate({
        where: {
          debt: { organizationId },
          paymentDate: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.organizationWallet.findUnique({
        where: { organizationId },
        select: { currentBalance: true, totalIncome: true, currency: true },
      }),
    ]);

    return {
      totalDebts,
      activeDebts,
      overdueDebts,
      paidDebts,
      recentRepayments,
      wallet,
    };
  }

  // ─── Écritures Transactionnelles ────────────────────────────

  async createWithAudit(organizationId, debtData, currentMembership) {
    return prisma.$transaction(async (tx) => {
      const debt = await tx.debt.create({
        data: {
          membershipId: debtData.membershipId,
          organizationId,
          title: debtData.title,
          description: debtData.description || null,
          initialAmount: debtData.initialAmount,
          remainingAmount: debtData.initialAmount,
          dueDate: debtData.dueDate ? new Date(debtData.dueDate) : null,
          status: "ACTIVE",
        },
        include: { membership: MEMBERSHIP_INCLUDE },
      });

      await tx.auditLog.create({
        data: {
          action: "CREATE_DEBT",
          resource: "debt",
          resourceId: debt.id,
          userId: currentMembership.userId,
          organizationId,
          membershipId: currentMembership.id,
          financialImpact: debtData.initialAmount,
          details: {
            membershipId: debtData.membershipId,
            memberName: debtData.memberDisplayInfo?.name,
            isProvisional: debtData.memberDisplayInfo?.isProvisional,
            amount: debtData.initialAmount,
          },
        },
      });

      return debt;
    });
  }

  async addRepaymentWithTransaction(
    debtId,
    organizationId,
    currentMembership,
    data,
  ) {
    return prisma.$transaction(async (tx) => {
      const debt = await tx.debt.findUnique({ where: { id: debtId } });
      if (!debt || debt.organizationId !== organizationId)
        throw new Error("NOT_FOUND");
      if (debt.status === "PAID") throw new Error("ALREADY_PAID");
      if (debt.status === "CANCELLED") throw new Error("CANCELLED");
      if (data.amount > debt.remainingAmount)
        throw new Error("AMOUNT_EXCEEDED");

      const wallet = await tx.organizationWallet.findUnique({
        where: { organizationId },
      });
      if (!wallet) throw new Error("WALLET_NOT_FOUND");

      // 1. Remboursement
      const repayment = await tx.repayment.create({
        data: {
          debtId,
          amount: data.amount,
          paymentDate: new Date(),
          paymentMethod: data.paymentMethod,
        },
      });

      // 2. Mise à jour de la dette
      const newRemaining = debt.remainingAmount - data.amount;
      const updatedDebt = await tx.debt.update({
        where: { id: debtId },
        data: {
          remainingAmount: newRemaining,
          status: newRemaining === 0 ? "PAID" : "PARTIALLY_PAID",
        },
      });

      // 3. Transaction financière
      const transaction = await tx.transaction.create({
        data: {
          organizationId,
          membershipId: debt.membershipId,
          walletId: wallet.id,
          type: "DEBT_REPAYMENT",
          amount: data.amount,
          currency: wallet.currency,
          description: `Remboursement — ${debt.title}`,
          paymentMethod: data.paymentMethod,
          paymentStatus: "COMPLETED",
          reference: `REPAY-${Date.now()}-${debtId.slice(-6)}`,
          metadata: { debtId, repaymentId: repayment.id },
        },
      });

      // 4. Lien transaction -> remboursement
      await tx.repayment.update({
        where: { id: repayment.id },
        data: { transactionId: transaction.id },
      });

      // 5. Mise à jour du wallet
      await tx.organizationWallet.update({
        where: { id: wallet.id },
        data: {
          currentBalance: { increment: data.amount },
          totalIncome: { increment: data.amount },
        },
      });

      // 6. Audit
      await tx.auditLog.create({
        data: {
          action: "ADD_REPAYMENT",
          resource: "debt",
          resourceId: debtId,
          userId: currentMembership.userId,
          organizationId,
          membershipId: currentMembership.id,
          financialImpact: data.amount,
          details: {
            amount: data.amount,
            paymentMethod: data.paymentMethod,
            debtTitle: debt.title,
          },
        },
      });

      return updatedDebt;
    });
  }

  async updateStatusWithAudit(
    debtId,
    organizationId,
    currentMembership,
    newStatus,
    previousStatus,
  ) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.debt.update({
        where: { id: debtId },
        data: { status: newStatus },
      });

      await tx.auditLog.create({
        data: {
          action: "UPDATE_DEBT_STATUS",
          resource: "debt",
          resourceId: debtId,
          userId: currentMembership.userId,
          organizationId,
          membershipId: currentMembership.id,
          details: { previousStatus, newStatus },
        },
      });

      return updated;
    });
  }

  async cancelWithTransaction(
    debtId,
    organizationId,
    currentMembership,
    reason,
  ) {
    return prisma.$transaction(async (tx) => {
      const debt = await tx.debt.findUnique({
        where: { id: debtId },
        include: { repayments: true },
      });
      if (!debt || debt.organizationId !== organizationId)
        throw new Error("NOT_FOUND");
      if (debt.status === "CANCELLED") throw new Error("ALREADY_CANCELLED");

      const totalRepaid = debt.initialAmount - debt.remainingAmount;

      // Ajuster le wallet si des remboursements ont été faits
      if (totalRepaid > 0) {
        const wallet = await tx.organizationWallet.findUnique({
          where: { organizationId },
        });
        if (wallet) {
          await tx.organizationWallet.update({
            where: { id: wallet.id },
            data: {
              currentBalance: { decrement: totalRepaid },
              totalIncome: { decrement: totalRepaid },
            },
          });
        }
      }

      const cancelled = await tx.debt.update({
        where: { id: debtId },
        data: { status: "CANCELLED", remainingAmount: 0 },
      });

      await tx.auditLog.create({
        data: {
          action: "CANCEL_DEBT",
          resource: "debt",
          resourceId: debtId,
          userId: currentMembership.userId,
          organizationId,
          membershipId: currentMembership.id,
          financialImpact: -totalRepaid,
          details: {
            reason,
            amountRepaid: totalRepaid,
            walletAdjusted: totalRepaid > 0,
          },
        },
      });

      return cancelled;
    });
  }
}
