import { DebtRepository } from "./debt.repository.js";
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from "../../shared/errors/AppError.js";

const debtRepo = new DebtRepository();

// ─── Helpers ──────────────────────────────────────────────────

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
      name: `${membership.user.prenom} ${membership.user.nom}`,
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
    name: `${membership.provisionalFirstName || ""} ${membership.provisionalLastName || ""}`.trim(),
  };
};

const enrichDebt = (debt) => ({
  ...debt,
  membership: {
    ...debt.membership,
    displayInfo: getMemberDisplayInfo(debt.membership),
  },
});

const requireMembership = async (userId, organizationId, roles = []) => {
  const membership = await debtRepo.findActiveMembership(
    userId,
    organizationId,
    roles,
  );
  if (!membership) throw new ForbiddenError("Accès non autorisé");
  return membership;
};

// ─── Service Class ────────────────────────────────────────────

export class DebtService {
  async createDebt(organizationId, currentUserId, data) {
    const currentMembership = await requireMembership(
      currentUserId,
      organizationId,
      ["ADMIN", "FINANCIAL_MANAGER"],
    );

    const membership = await debtRepo.findMembershipById(data.membershipId);
    if (!membership || membership.organizationId !== organizationId) {
      throw new NotFoundError("Membre dans cette organisation");
    }

    const debt = await debtRepo.createWithAudit(
      organizationId,
      { ...data, memberDisplayInfo: getMemberDisplayInfo(membership) },
      { id: currentMembership.id, userId: currentUserId },
    );

    return enrichDebt(debt);
  }

  async getDebtById(organizationId, debtId, currentUserId) {
    await requireMembership(currentUserId, organizationId);

    const debt = await debtRepo.findByIdWithDetails(debtId, organizationId);
    if (!debt) throw new NotFoundError("Dette");

    return enrichDebt(debt);
  }

  async getOrganizationDebts(organizationId, currentUserId, filters) {
    await requireMembership(currentUserId, organizationId);

    const { debts, total } = await debtRepo.findWithFilters(
      organizationId,
      filters,
    );

    return {
      debts: debts.map(enrichDebt),
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        pages: Math.ceil(total / filters.limit),
      },
    };
  }

  async getMemberDebts(organizationId, membershipId, currentUserId, filters) {
    const currentMembership = await requireMembership(
      currentUserId,
      organizationId,
    );

    const isAdminOrFinancial = ["ADMIN", "FINANCIAL_MANAGER"].includes(
      currentMembership.role,
    );
    const isSelf = currentMembership.id === membershipId;

    if (!isAdminOrFinancial && !isSelf) {
      throw new ForbiddenError("Permissions insuffisantes");
    }

    const { debts, total, totals } = await debtRepo.findMemberDebts(
      organizationId,
      membershipId,
      filters,
    );

    return {
      debts: debts.map(enrichDebt),
      totals: {
        totalInitial: totals._sum.initialAmount || 0,
        totalRemaining: totals._sum.remainingAmount || 0,
        totalRepaid:
          (totals._sum.initialAmount || 0) - (totals._sum.remainingAmount || 0),
      },
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        pages: Math.ceil(total / filters.limit),
      },
    };
  }

  async getMyDebts(organizationId, currentUserId, filters) {
    const membership = await requireMembership(currentUserId, organizationId);

    const { debts, total, totals } = await debtRepo.findMemberDebts(
      organizationId,
      membership.id,
      filters,
    );

    return {
      debts: debts.map(enrichDebt),
      totals: {
        totalDebts: totals._sum.initialAmount || 0,
        totalRemaining: totals._sum.remainingAmount || 0,
        totalRepaid:
          (totals._sum.initialAmount || 0) - (totals._sum.remainingAmount || 0),
      },
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        pages: Math.ceil(total / filters.limit),
      },
    };
  }

  async getDebtRepayments(organizationId, debtId, currentUserId) {
    await requireMembership(currentUserId, organizationId);

    const debt = await debtRepo.findSimpleById(debtId);
    if (!debt || debt.organizationId !== organizationId) {
      throw new NotFoundError("Dette");
    }

    const repayments = await debtRepo.findRepaymentsByDebtId(debtId);
    const totalRepaid = repayments.reduce((sum, r) => sum + r.amount, 0);

    return {
      debtId,
      debtTitle: debt.title,
      initialAmount: debt.initialAmount,
      remainingAmount: debt.remainingAmount,
      status: debt.status,
      totalRepaid,
      repaymentRate: debt.initialAmount
        ? Math.round((totalRepaid / debt.initialAmount) * 100)
        : 0,
      repayments,
    };
  }

  async addRepayment(organizationId, debtId, currentUserId, data) {
    const currentMembership = await requireMembership(
      currentUserId,
      organizationId,
      ["ADMIN", "FINANCIAL_MANAGER"],
    );

    try {
      const result = await debtRepo.addRepaymentWithTransaction(
        debtId,
        organizationId,
        { id: currentMembership.id, userId: currentUserId },
        data,
      );
      return result;
    } catch (error) {
      // Mapping des erreurs "métier" propagées depuis le repository transactionnel
      const errorMap = {
        NOT_FOUND: new NotFoundError("Dette"),
        ALREADY_PAID: new ConflictError("Cette dette est déjà payée"),
        CANCELLED: new ForbiddenError(
          "Impossible de rembourser une dette annulée",
        ),
        AMOUNT_EXCEEDED: new ConflictError(
          `Montant trop élevé par rapport au restant dû`,
        ),
        WALLET_NOT_FOUND: new NotFoundError("Wallet"),
      };
      throw errorMap[error.message] || error;
    }
  }

  async updateDebtStatus(organizationId, debtId, currentUserId, status) {
    const membership = await requireMembership(currentUserId, organizationId, [
      "ADMIN",
    ]);

    const debt = await debtRepo.findSimpleById(debtId);
    if (!debt || debt.organizationId !== organizationId) {
      throw new NotFoundError("Dette");
    }

    return debtRepo.updateStatusWithAudit(
      debtId,
      organizationId,
      { id: membership.id, userId: currentUserId },
      status,
      debt.status,
    );
  }

  async cancelDebt(organizationId, debtId, currentUserId, reason = "") {
    const membership = await requireMembership(currentUserId, organizationId, [
      "ADMIN",
    ]);

    try {
      return await debtRepo.cancelWithTransaction(
        debtId,
        organizationId,
        { id: membership.id, userId: currentUserId },
        reason,
      );
    } catch (error) {
      const errorMap = {
        NOT_FOUND: new NotFoundError("Dette"),
        ALREADY_CANCELLED: new ConflictError("Cette dette est déjà annulée"),
      };
      throw errorMap[error.message] || error;
    }
  }

  async getDebtSummary(organizationId, currentUserId) {
    await requireMembership(currentUserId, organizationId);

    const {
      totalDebts,
      activeDebts,
      overdueDebts,
      paidDebts,
      recentRepayments,
      wallet,
    } = await debtRepo.getSummaryStats(organizationId);

    const totalRepaid =
      (totalDebts._sum.initialAmount || 0) -
      (activeDebts._sum.remainingAmount || 0);

    return {
      summary: {
        totalDebts: totalDebts._count,
        totalAmount: totalDebts._sum.initialAmount || 0,
        activeDebts: activeDebts._count,
        activeAmount: activeDebts._sum.remainingAmount || 0,
        overdueDebts,
        paidDebts: paidDebts._count,
        paidAmount: paidDebts._sum.initialAmount || 0,
        totalRepaid,
        recentRepayments: recentRepayments._count,
        recentRepaidAmount: recentRepayments._sum.amount || 0,
      },
      percentages: {
        repaymentRate: totalDebts._sum.initialAmount
          ? Math.round((totalRepaid / totalDebts._sum.initialAmount) * 100)
          : 0,
        overdueRate: totalDebts._count
          ? Math.round((overdueDebts / totalDebts._count) * 100)
          : 0,
      },
      wallet: {
        currentBalance: wallet?.currentBalance || 0,
        totalIncome: wallet?.totalIncome || 0,
        currency: wallet?.currency || "XOF",
      },
    };
  }
}
