import { ExpenseRepository } from "./expense.repository.js";
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from "../../shared/errors/AppError.js";

const expenseRepo = new ExpenseRepository();

const ROLES = {
  ADMIN: "ADMIN",
  FINANCIAL_MANAGER: "FINANCIAL_MANAGER",
};

export class ExpenseService {
  // ─── Helpers privés ─────────────────────────────────────────

  async #getActiveMembership(userId, organizationId, roles = []) {
    const membership = await expenseRepo.findActiveMembership(
      userId,
      organizationId,
      roles,
    );

    if (!membership) {
      throw new ForbiddenError("Accès ou permissions insuffisantes");
    }

    return membership;
  }

  async #getExpenseWithValidation(expenseId, organizationId) {
    const expense = await expenseRepo.findWithWallet(expenseId);

    if (!expense || expense.organizationId !== organizationId) {
      throw new NotFoundError("Dépense");
    }

    return expense;
  }

  #validateStatusTransition(currentStatus, action) {
    const transitions = {
      approve: ["PENDING"],
      reject: ["PENDING"],
      pay: ["APPROVED"],
      cancel: ["PENDING", "APPROVED", "REJECTED"],
    };

    const allowedStatuses = transitions[action];
    if (!allowedStatuses.includes(currentStatus)) {
      const labels = {
        approve: "approuver",
        reject: "rejeter",
        pay: "payer",
        cancel: "annuler",
      };
      throw new ConflictError(
        `Impossible de ${labels[action]} une dépense ${currentStatus}`,
      );
    }
  }

  // ─── Créer une dépense ──────────────────────────────────────

  async createExpense(organizationId, currentUserId, expenseData) {
    const membership = await this.#getActiveMembership(
      currentUserId,
      organizationId,
      [ROLES.ADMIN, ROLES.FINANCIAL_MANAGER],
    );

    const wallet = await expenseRepo.getWalletByOrganization(organizationId);
    if (!wallet) {
      throw new NotFoundError("Wallet non trouvé. Contactez l'administrateur.");
    }

    return expenseRepo.createWithAudit(
      organizationId,
      membership,
      wallet,
      expenseData,
      currentUserId,
    );
  }

  // ─── Approuver une dépense ──────────────────────────────────

  async approveExpense(organizationId, expenseId, currentUserId) {
    const membership = await this.#getActiveMembership(
      currentUserId,
      organizationId,
      [ROLES.ADMIN],
    );

    const expense = await this.#getExpenseWithValidation(
      expenseId,
      organizationId,
    );
    this.#validateStatusTransition(expense.status, "approve");

    return expenseRepo.approveWithAudit(
      expenseId,
      membership,
      expense,
      currentUserId,
      organizationId,
    );
  }

  // ─── Rejeter une dépense ────────────────────────────────────

  async rejectExpense(organizationId, expenseId, currentUserId, reason = "") {
    const membership = await this.#getActiveMembership(
      currentUserId,
      organizationId,
      [ROLES.ADMIN],
    );

    const expense = await this.#getExpenseWithValidation(
      expenseId,
      organizationId,
    );
    this.#validateStatusTransition(expense.status, "reject");

    return expenseRepo.rejectWithAudit(
      expenseId,
      membership,
      expense,
      currentUserId,
      organizationId,
      reason,
    );
  }

  // ─── Payer une dépense ──────────────────────────────────────

  async payExpense(organizationId, expenseId, currentUserId, paymentData) {
    const membership = await this.#getActiveMembership(
      currentUserId,
      organizationId,
      [ROLES.ADMIN, ROLES.FINANCIAL_MANAGER],
    );

    const expense = await this.#getExpenseWithValidation(
      expenseId,
      organizationId,
    );
    this.#validateStatusTransition(expense.status, "pay");

    if (expense.wallet.currentBalance < expense.amount) {
      throw new ConflictError(
        `Solde insuffisant. Disponible: ${expense.wallet.currentBalance} ${expense.currency}, Requis: ${expense.amount} ${expense.currency}`,
      );
    }

    return expenseRepo.payWithAudit(
      expense,
      membership,
      paymentData,
      currentUserId,
      organizationId,
    );
  }

  // ─── Liste des dépenses ─────────────────────────────────────

  async getExpenses(organizationId, currentUserId, filters) {
    await this.#getActiveMembership(currentUserId, organizationId);

    const { page, limit, ...filterParams } = filters;
    const skip = (page - 1) * limit;
    const where = expenseRepo.buildFiltersQuery(filterParams);

    const { expenses, total, totals } = await expenseRepo.findAllWithFilters(
      organizationId,
      { where, skip, take: limit },
    );

    return {
      expenses,
      totals,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  // ─── Détail d'une dépense ──────────────────────────────────

  async getExpenseById(organizationId, expenseId, currentUserId) {
    await this.#getActiveMembership(currentUserId, organizationId);

    const expense = await expenseRepo.findByIdWithDetails(
      expenseId,
      organizationId,
    );

    if (!expense) {
      throw new NotFoundError("Dépense");
    }

    return expense;
  }

  // ─── Statistiques des dépenses ──────────────────────────────

  async getExpenseStats(organizationId, currentUserId, filters) {
    await this.#getActiveMembership(currentUserId, organizationId);

    const where = expenseRepo.buildDateFilter(
      filters.startDate,
      filters.endDate,
    );
    return expenseRepo.getAggregateStats(organizationId, where);
  }

  // ─── Annuler une dépense ────────────────────────────────────

  async cancelExpense(organizationId, expenseId, currentUserId, reason = "") {
    const membership = await this.#getActiveMembership(
      currentUserId,
      organizationId,
      [ROLES.ADMIN],
    );

    const expense = await this.#getExpenseWithValidation(
      expenseId,
      organizationId,
    );

    if (expense.status === "PAID") {
      throw new ConflictError(
        "Impossible d'annuler une dépense déjà payée. Utilisez la réconciliation du wallet.",
      );
    }

    this.#validateStatusTransition(expense.status, "cancel");

    return expenseRepo.cancelWithAudit(
      expenseId,
      membership,
      expense,
      currentUserId,
      organizationId,
      reason,
    );
  }
}
