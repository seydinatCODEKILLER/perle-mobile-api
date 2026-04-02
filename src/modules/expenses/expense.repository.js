// src/modules/expenses/expense.repository.js
import { prisma } from "../../config/database.js";
import { BaseRepository } from "../../shared/base/base.repository.js";

export class ExpenseRepository extends BaseRepository {
  constructor() {
    super(prisma.expense);
  }

  // ─── Membership ─────────────────────────────────────────────

  async findActiveMembership(userId, organizationId, roles = []) {
    const where = {
      userId,
      organizationId,
      status: "ACTIVE",
      ...(roles.length && { role: { in: roles } }),
    };

    return prisma.membership.findFirst({ where });
  }

  // ─── Lectures ───────────────────────────────────────────────

  async findByIdWithDetails(expenseId, organizationId) {
    return prisma.expense.findFirst({
      where: { id: expenseId, organizationId },
      include: {
        createdBy: {
          include: {
            user: { select: { id: true, prenom: true, nom: true, email: true, phone: true } },
          },
        },
        approvedBy: {
          include: {
            user: { select: { id: true, prenom: true, nom: true, email: true } },
          },
        },
        transaction: true,
        wallet: {
          select: {
            id: true,
            currentBalance: true,
            currency: true,
          },
        },
        attachments: {
          include: {
            uploadedBy: {
              include: {
                user: { select: { prenom: true, nom: true } },
              },
            },
          },
        },
      },
    });
  }

  async findWithWallet(expenseId) {
    return prisma.expense.findUnique({
      where: { id: expenseId },
      include: { wallet: true },
    });
  }

  async findAllWithFilters(organizationId, { where, skip, take }) {
    const [expenses, total, totals] = await Promise.all([
      prisma.expense.findMany({
        where: { organizationId, ...where },
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: {
            include: {
              user: { select: { prenom: true, nom: true } },
            },
          },
          approvedBy: {
            include: {
              user: { select: { prenom: true, nom: true } },
            },
          },
          transaction: true,
        },
      }),
      prisma.expense.count({ where: { organizationId, ...where } }),
      prisma.expense.aggregate({
        where: { organizationId, ...where },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      expenses,
      total,
      totals: {
        totalAmount: totals._sum.amount || 0,
        totalCount: totals._count,
      },
    };
  }

  async getAggregateStats(organizationId, where = {}) {
    const [totalStats, byStatus, byCategory] = await Promise.all([
      prisma.expense.aggregate({
        where: { organizationId, ...where },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.expense.groupBy({
        by: ["status"],
        where: { organizationId, ...where },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.expense.groupBy({
        by: ["category"],
        where: { organizationId, ...where },
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    return {
      total: {
        amount: totalStats._sum.amount || 0,
        count: totalStats._count,
      },
      byStatus: byStatus.map((s) => ({
        status: s.status,
        amount: s._sum.amount || 0,
        count: s._count.id,
      })),
      byCategory: byCategory.map((c) => ({
        category: c.category,
        amount: c._sum.amount || 0,
        count: c._count.id,
      })),
    };
  }

  async getWalletByOrganization(organizationId) {
    return prisma.organizationWallet.findUnique({
      where: { organizationId },
    });
  }

  // ─── Utilitaires de filtres ─────────────────────────────────

  buildFiltersQuery(filters) {
    const { status, category, createdById, startDate, endDate, search } = filters;
    const where = {};

    if (status) where.status = status;
    if (category) where.category = category;
    if (createdById) where.createdById = createdById;

    if (startDate || endDate) {
      where.expenseDate = {
        ...(startDate && { gte: new Date(startDate) }),
        ...(endDate && { lte: new Date(endDate) }),
      };
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    return where;
  }

  buildDateFilter(startDate, endDate) {
    if (!startDate && !endDate) return {};
    return {
      expenseDate: {
        ...(startDate && { gte: new Date(startDate) }),
        ...(endDate && { lte: new Date(endDate) }),
      },
    };
  }

  // ─── Écritures transactionnelles ────────────────────────────

  async createWithAudit(organizationId, membership, wallet, expenseData, currentUserId) {
    return prisma.$transaction(async (tx) => {
      const newExpense = await tx.expense.create({
        data: {
          organizationId,
          walletId: wallet.id,
          createdById: membership.id,
          title: expenseData.title,
          description: expenseData.description,
          amount: Number(expenseData.amount),
          currency: wallet.currency,
          category: expenseData.category,
          status: "PENDING",
          expenseDate: expenseData.expenseDate
            ? new Date(expenseData.expenseDate)
            : new Date(),
        },
        include: {
          createdBy: {
            include: {
              user: { select: { prenom: true, nom: true } },
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          action: "CREATE_EXPENSE",
          resource: "expense",
          resourceId: newExpense.id,
          userId: currentUserId,
          organizationId,
          membershipId: membership.id,
          details: {
            title: newExpense.title,
            amount: newExpense.amount,
            category: newExpense.category,
          },
        },
      });

      return newExpense;
    });
  }

  async approveWithAudit(expenseId, membership, expense, currentUserId, organizationId) {
    return prisma.$transaction(async (tx) => {
      const approved = await tx.expense.update({
        where: { id: expenseId },
        data: {
          status: "APPROVED",
          approvedById: membership.id,
          approvedAt: new Date(),
        },
        include: {
          createdBy: {
            include: {
              user: { select: { prenom: true, nom: true } },
            },
          },
          approvedBy: {
            include: {
              user: { select: { prenom: true, nom: true } },
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          action: "APPROVE_EXPENSE",
          resource: "expense",
          resourceId: expenseId,
          userId: currentUserId,
          organizationId,
          membershipId: membership.id,
          details: {
            title: expense.title,
            amount: expense.amount,
          },
        },
      });

      return approved;
    });
  }

  async rejectWithAudit(expenseId, membership, expense, currentUserId, organizationId, reason) {
    return prisma.$transaction(async (tx) => {
      const rejected = await tx.expense.update({
        where: { id: expenseId },
        data: {
          status: "REJECTED",
          approvedById: membership.id,
          approvedAt: new Date(),
        },
        include: {
          createdBy: {
            include: {
              user: { select: { prenom: true, nom: true } },
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          action: "REJECT_EXPENSE",
          resource: "expense",
          resourceId: expenseId,
          userId: currentUserId,
          organizationId,
          membershipId: membership.id,
          details: {
            title: expense.title,
            amount: expense.amount,
            reason,
          },
        },
      });

      return rejected;
    });
  }

  async payWithAudit(expense, membership, paymentData, currentUserId, organizationId) {
    return prisma.$transaction(async (tx) => {
      // 1. Créer la transaction financière
      const transaction = await tx.transaction.create({
        data: {
          organizationId,
          membershipId: membership.id,
          walletId: expense.walletId,
          type: "EXPENSE",
          amount: expense.amount,
          currency: expense.currency,
          description: `Dépense: ${expense.title}`,
          paymentMethod: paymentData.paymentMethod,
          paymentStatus: "COMPLETED",
          reference: `EXP-${Date.now()}-${expense.id.slice(-6)}`,
          metadata: {
            expenseId: expense.id,
            category: expense.category,
            ...(paymentData.notes && { notes: paymentData.notes }),
          },
        },
      });

      // 2. Mettre à jour la dépense
      const paidExpense = await tx.expense.update({
        where: { id: expense.id },
        data: {
          status: "PAID",
          transactionId: transaction.id,
        },
        include: {
          createdBy: {
            include: {
              user: { select: { prenom: true, nom: true } },
            },
          },
          transaction: true,
        },
      });

      // 3. Mettre à jour le wallet
      await tx.organizationWallet.update({
        where: { id: expense.walletId },
        data: {
          currentBalance: { decrement: expense.amount },
          totalExpenses: { increment: expense.amount },
        },
      });

      // 4. Audit log avec impact financier
      await tx.auditLog.create({
        data: {
          action: "PAY_EXPENSE",
          resource: "expense",
          resourceId: expense.id,
          userId: currentUserId,
          organizationId,
          membershipId: membership.id,
          financialImpact: -expense.amount,
          previousBalance: expense.wallet.currentBalance,
          newBalance: expense.wallet.currentBalance - expense.amount,
          details: {
            title: expense.title,
            amount: expense.amount,
            category: expense.category,
            paymentMethod: paymentData.paymentMethod,
            transactionReference: transaction.reference,
          },
        },
      });

      return paidExpense;
    });
  }

  async cancelWithAudit(expenseId, membership, expense, currentUserId, organizationId, reason) {
    return prisma.$transaction(async (tx) => {
      const cancelled = await tx.expense.update({
        where: { id: expenseId },
        data: { status: "CANCELLED" },
      });

      await tx.auditLog.create({
        data: {
          action: "CANCEL_EXPENSE",
          resource: "expense",
          resourceId: expenseId,
          userId: currentUserId,
          organizationId,
          membershipId: membership.id,
          details: {
            title: expense.title,
            amount: expense.amount,
            previousStatus: expense.status,
            reason,
          },
        },
      });

      return cancelled;
    });
  }
}