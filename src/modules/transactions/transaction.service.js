import { TransactionRepository } from "./transaction.repository.js";
import {
  ForbiddenError,
  NotFoundError,
  BadRequestError,
} from "../../shared/errors/AppError.js";

const transactionRepo = new TransactionRepository();

const getMemberDisplayInfo = (membership) => {
  if (!membership) return null;
  if (membership.userId && membership.user) {
    return {
      firstName: membership.user.prenom,
      lastName: membership.user.nom,
      email: membership.user.email,
      phone: membership.user.phone,
      avatar: membership.user.avatar,
      gender: membership.user.gender,
      hasAccount: true,
      isProvisional: false,
    };
  }
  return {
    firstName: membership.provisionalFirstName,
    lastName: membership.provisionalLastName,
    email: membership.provisionalEmail,
    phone: membership.provisionalPhone,
    avatar: membership.provisionalAvatar,
    gender: membership.provisionalGender,
    hasAccount: false,
    isProvisional: true,
  };
};

const checkAccess = async (userId, organizationId, roles = []) => {
  const membership = await transactionRepo.requireMembership(
    userId,
    organizationId,
    roles,
  );
  if (!membership) {
    throw new ForbiddenError("Accès non autorisé à cette organisation");
  }
  return membership;
};

export class TransactionService {
  async getTransactions(organizationId, currentUserId, filters) {
    await checkAccess(currentUserId, organizationId);
    const {
      type,
      paymentStatus,
      membershipId,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = filters;

    const where = {
      ...(type && { type }),
      ...(paymentStatus && { paymentStatus }),
      ...(membershipId && { membershipId }),
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate && { gte: new Date(startDate) }),
              ...(endDate && { lte: new Date(endDate) }),
            },
          }
        : {}),
    };

    const { transactions, total } = await transactionRepo.findWithFilters(
      organizationId,
      where,
      (page - 1) * limit,
      limit,
    );

    // ✅ Le wallet est maintenant inclus dans chaque transaction par le repository.
    // On l'extrait proprement du premier élément pour le mettre à la racine de la réponse.
    const currentWallet = transactions[0]?.wallet
      ? {
          currentBalance: transactions[0].wallet.currentBalance,
          currency: transactions[0].wallet.currency,
        }
      : null;

    return {
      transactions: transactions.map((t) => ({
        ...t,
        membership: t.membership
          ? { ...t.membership, displayInfo: getMemberDisplayInfo(t.membership) }
          : null,
      })),
      wallet: currentWallet,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async getTransactionById(organizationId, transactionId, currentUserId) {
    await checkAccess(currentUserId, organizationId);
    const transaction = await transactionRepo.findByIdWithDetails(
      transactionId,
      organizationId,
    );

    if (!transaction || transaction.organizationId !== organizationId) {
      throw new NotFoundError("Transaction");
    }

    return {
      ...transaction,
      membership: transaction.membership
        ? {
            ...transaction.membership,
            displayInfo: getMemberDisplayInfo(transaction.membership),
          }
        : null,
    };
  }

  async searchTransactions(organizationId, currentUserId, searchTerm) {
    await checkAccess(currentUserId, organizationId);
    if (!searchTerm || searchTerm.trim().length < 2) {
      throw new BadRequestError(
        "Le terme de recherche doit contenir au moins 2 caractères",
      );
    }
    const results = await transactionRepo.search(organizationId, searchTerm);
    return { searchTerm, count: results.length, results };
  }

  async getMemberTransactions(
    organizationId,
    membershipId,
    currentUserId,
    filters,
  ) {
    const currentMembership = await checkAccess(currentUserId, organizationId);
    if (
      currentMembership.role !== "ADMIN" &&
      currentMembership.id !== membershipId
    ) {
      throw new ForbiddenError(
        "Permissions insuffisantes pour voir les transactions de ce membre",
      );
    }
    return this.#getTransactionsInternal(
      organizationId,
      { membershipId },
      filters,
    );
  }

  async getMyTransactions(organizationId, currentUserId, filters) {
    const membership = await checkAccess(currentUserId, organizationId);
    return this.#getTransactionsInternal(
      organizationId,
      { membershipId: membership.id },
      filters,
    );
  }

  async #getTransactionsInternal(organizationId, extraWhere, filters) {
    const {
      type,
      paymentMethod,
      paymentStatus,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = filters;

    const whereClause = {
      ...(type && { type }),
      ...(paymentMethod && { paymentMethod }),
      ...(paymentStatus && { paymentStatus }),
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate && { gte: new Date(startDate) }),
              ...(endDate && { lte: new Date(endDate) }),
            },
          }
        : {}),
    };

    const result = await transactionRepo.findMemberTransactions(
      organizationId,
      extraWhere,
      whereClause,
      (page - 1) * limit,
      limit,
    );

    return {
      transactions: result.transactions,
      totals: {
        totalAmount: result.totals._sum.amount || 0,
        totalCount: result.total,
      },
      pagination: {
        page,
        limit,
        total: result.total,
        pages: Math.ceil(result.total / limit),
      },
    };
  }

  async verifyWalletIntegrity(organizationId, currentUserId) {
    await checkAccess(currentUserId, organizationId, ["ADMIN"]);

    const wallet = await transactionRepo.getWallet(organizationId);
    if (!wallet)
      throw new NotFoundError("Wallet non trouvé pour cette organisation");

    const { income, expenses } =
      await transactionRepo.calculateActuals(organizationId);
    const calculatedBalance = income - expenses;

    return {
      wallet: {
        currentBalance: wallet.currentBalance,
        totalIncome: wallet.totalIncome,
        totalExpenses: wallet.totalExpenses,
      },
      calculated: { income, expenses, balance: calculatedBalance },
      isConsistent: Math.abs(wallet.currentBalance - calculatedBalance) < 0.01,
      discrepancy: wallet.currentBalance - calculatedBalance,
    };
  }

  async getTransactionStatsByType(organizationId, currentUserId, filters) {
    await checkAccess(currentUserId, organizationId);
    const { startDate, endDate } = filters;

    const whereClause = {
      paymentStatus: "COMPLETED",
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate && { gte: new Date(startDate) }),
              ...(endDate && { lte: new Date(endDate) }),
            },
          }
        : {}),
    };

    const [statsByType, wallet] = await Promise.all([
      transactionRepo.aggregateByType(organizationId, whereClause),
      transactionRepo.getWallet(organizationId),
    ]);

    return {
      wallet,
      byType: statsByType.map((stat) => ({
        type: stat.type,
        totalAmount: stat._sum.amount || 0,
        count: stat._count.id,
      })),
      summary: {
        totalTransactions: statsByType.reduce((sum, s) => sum + s._count.id, 0),
        totalAmount: statsByType.reduce(
          (sum, s) => sum + (s._sum.amount || 0),
          0,
        ),
      },
    };
  }
}
