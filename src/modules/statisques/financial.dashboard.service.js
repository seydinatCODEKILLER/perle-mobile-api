// src/modules/dashboards/financial.dashboard.service.js

export class FinancialDashboardService {
  constructor(repo) {
    this.repo = repo;
  }

  async getDashboardData(organizationId) {
    const [
      totalCollected,
      pendingContributions,
      activeDebts,
      overdueContributions,
      walletOverview,
      expensesOverview,
      todayRevenue,
      weekRevenue,
      todayExpenses,
      weekExpenses,
      remainingToCollect,
      debtsToRecover,
      pendingExpenses,
      recentPayments,
      recentRepayments,
      recentExpenses,
      revenueTrend,
      expenseTrend,
      debtsVsPaid,
    ] = await Promise.all([
      this.#getTotalCollected(organizationId),
      this.#getPendingContributions(organizationId),
      this.#getActiveDebts(organizationId),
      this.#getOverdueContributions(organizationId),
      this.#getWalletOverview(organizationId),
      this.#getExpensesOverview(organizationId),
      this.#getTodayRevenue(organizationId),
      this.#getWeekRevenue(organizationId),
      this.#getTodayExpenses(organizationId),
      this.#getWeekExpenses(organizationId),
      this.#getRemainingToCollect(organizationId),
      this.#getDebtsToRecover(organizationId),
      this.#getPendingExpenses(organizationId),
      this.repo.getRecentPaymentsList(organizationId),
      this.repo.getRecentRepaymentsList(organizationId),
      this.repo.getRecentExpensesList(organizationId),
      this.repo.getWeeklyRevenueTrend(organizationId),
      this.repo.getWeeklyExpensesTrend(organizationId),
      this.#getDebtsVsPaid(organizationId),
    ]);

    return {
      role: "FINANCIAL_MANAGER",
      organizationId,
      generatedAt: new Date(),
      kpis: {
        totalCollected,
        pendingContributions,
        activeDebts,
        overdueContributions,
      },
      financialOverview: { wallet: walletOverview, expenses: expensesOverview },
      executionFocus: {
        todayRevenue,
        weekRevenue,
        todayExpenses,
        weekExpenses,
        remainingToCollect,
        debtsToRecover,
        pendingExpenses,
      },
      recentActivities: {
        payments: recentPayments,
        repayments: recentRepayments,
        expenses: recentExpenses,
      },
      charts: { revenueTrend, expenseTrend, debtsVsPaid },
      performance: {
        collectionRate: await this.#getCollectionRate(organizationId),
        debtRecoveryRate: await this.#getDebtRecoveryRate(organizationId),
        averagePaymentTime: await this.#getAveragePaymentTime(organizationId),
        expenseControlRate: await this.#getExpenseControlRate(organizationId),
      },
    };
  }

  // --- FORMATTERS PRIVÉS ---

  async #getTotalCollected(orgId) {
    const r = await this.repo.getTransactionsAgg(orgId, [
      "CONTRIBUTION",
      "DEBT_REPAYMENT",
    ]);
    return {
      value: r._sum.amount || 0,
      label: "Total collecté",
      icon: "💰",
      currency: "XOF",
    };
  }

  async #getPendingContributions(orgId) {
    const r = await this.repo.getPendingContributionsAgg(orgId);
    return {
      value: r._count,
      label: "Cotisations en attente",
      icon: "⏳",
      details: {
        count: r._count,
        remaining: (r._sum.amount || 0) - (r._sum.amountPaid || 0),
      },
    };
  }

  async #getActiveDebts(orgId) {
    const r = await this.repo.getActiveDebtsAgg(orgId);
    return {
      value: r._count,
      label: "Dettes actives",
      icon: "⚠️",
      details: { count: r._count, totalRemaining: r._sum.remainingAmount || 0 },
    };
  }

  async #getOverdueContributions(orgId) {
    const r = await this.repo.getOverdueContributionsAgg(orgId);
    return {
      value: r._count,
      label: "Cotisations en retard",
      icon: "📅",
      details: {
        count: r._count,
        remaining: (r._sum.amount || 0) - (r._sum.amountPaid || 0),
      },
    };
  }

  async #getWalletOverview(orgId) {
    const w = await this.repo.getWalletOverview(orgId);
    if (!w)
      return {
        exists: false,
        currentBalance: 0,
        totalIncome: 0,
        totalExpenses: 0,
        currency: "XOF",
      };
    const healthStatus = this.#getWalletHealthStatus(
      w.currentBalance,
      w.totalIncome,
    );
    return {
      exists: true,
      id: w.id,
      currentBalance: w.currentBalance,
      totalIncome: w.totalIncome,
      totalExpenses: w.totalExpenses,
      currency: w.currency,
      lastUpdated: w.lastUpdated,
      netBalance: w.totalIncome - w.totalExpenses,
      healthStatus,
    };
  }

  async #getExpensesOverview(orgId) {
    const d = await this.repo.getExpensesOverviewAgg(orgId);
    return {
      pending: { count: d.pending._count, amount: d.pending._sum.amount || 0 },
      approved: {
        count: d.approved._count,
        amount: d.approved._sum.amount || 0,
      },
      paid: { count: d.paid._count, amount: d.paid._sum.amount || 0 },
      rejected: {
        count: d.rejected._count,
        amount: d.rejected._sum.amount || 0,
      },
    };
  }

  async #getTodayRevenue(orgId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const r = await this.repo.getTransactionsAgg(
      orgId,
      ["CONTRIBUTION", "DEBT_REPAYMENT"],
      { start: today, end: tomorrow },
    );
    return { amount: r._sum.amount || 0, count: r._count, date: today };
  }

  async #getWeekRevenue(orgId) {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const r = await this.repo.getTransactionsAgg(
      orgId,
      ["CONTRIBUTION", "DEBT_REPAYMENT"],
      { start: weekAgo, end: today },
    );
    return {
      amount: r._sum.amount || 0,
      count: r._count,
      period: { from: weekAgo, to: today },
    };
  }

  async #getTodayExpenses(orgId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const r = await this.repo.getPeriodExpensesAgg(orgId, today, tomorrow);
    return { amount: r._sum.amount || 0, count: r._count, date: today };
  }

  async #getWeekExpenses(orgId) {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const r = await this.repo.getPeriodExpensesAgg(orgId, weekAgo, today);
    return {
      amount: r._sum.amount || 0,
      count: r._count,
      period: { from: weekAgo, to: today },
    };
  }

  async #getRemainingToCollect(orgId) {
    const r = await this.repo.getPendingContributionsAgg(orgId);
    const remaining = (r._sum.amount || 0) - (r._sum.amountPaid || 0);
    return {
      amount: remaining,
      details: {
        totalAmount: r._sum.amount || 0,
        totalPaid: r._sum.amountPaid || 0,
        remaining,
      },
    };
  }

  async #getDebtsToRecover(orgId) {
    const r = await this.repo.getDebtsToRecoverAgg(orgId);
    return { amount: r._sum.remainingAmount || 0, count: r._count };
  }

  async #getPendingExpenses(orgId) {
    const d = await this.repo.getPendingExpensesAgg(orgId);
    return {
      pending: { count: d.pending._count, amount: d.pending._sum.amount || 0 },
      approved: {
        count: d.approved._count,
        amount: d.approved._sum.amount || 0,
      },
      total: {
        count: d.pending._count + d.approved._count,
        amount: (d.pending._sum.amount || 0) + (d.approved._sum.amount || 0),
      },
    };
  }

  async #getDebtsVsPaid(orgId) {
    const d = await this.repo.getDebtsVsPaidAgg(orgId);
    return {
      active: {
        count: d.active._count,
        amount: d.active._sum.remainingAmount || 0,
      },
      paid: { count: d.paid._count, amount: d.paid._sum.initialAmount || 0 },
    };
  }

  async #getCollectionRate(orgId) {
    const [expected, collected] = await Promise.all([
      this.repo.getCollectionAgg(orgId),
      this.repo.getTransactionsAgg(orgId, ["CONTRIBUTION"]),
    ]);
    const exp = expected._sum.amount || 0;
    const col = collected._sum.amount || 0;
    return exp > 0 ? Math.round((col / exp) * 100) : 0;
  }

  async #getDebtRecoveryRate(orgId) {
    const [totalDebts, recoveredDebts] = await Promise.all([
      this.repo.getCollectionAgg(orgId),
      this.repo.getTransactionsAgg(orgId, ["DEBT_REPAYMENT"]),
    ]);
    const total = totalDebts._sum.amount || 0;
    const recovered = recoveredDebts._sum.amount || 0;
    return total > 0 ? Math.round((recovered / total) * 100) : 0;
  }

  async #getAveragePaymentTime(orgId) {
    // Le repo récupère les paiements récents pour éviter un calcul trop lourd
    const contributions = await this.repo.getContributionPaymentDelay(
      orgId,
      "GLOBAL",
    ); // Utilise la méthode globale du repo si nécessaire, sinon on l'adapte
    if (!contributions || contributions.length === 0) return 0;
    const totalDays = contributions.reduce(
      (sum, c) =>
        sum +
        Math.ceil(
          (new Date(c.paymentDate).getTime() - new Date(c.dueDate).getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      0,
    );
    return Math.round(totalDays / contributions.length);
  }

  async #getExpenseControlRate(orgId) {
    const d = await this.repo.getExpenseControlAgg(orgId);
    if (d.total === 0) return { approvalRate: 0, rejectionRate: 0 };
    return {
      approvalRate: Math.round((d.approved / d.total) * 100),
      rejectionRate: Math.round((d.rejected / d.total) * 100),
    };
  }

  #getWalletHealthStatus(currentBalance, totalIncome) {
    if (totalIncome === 0) return "UNKNOWN";
    const ratio = (currentBalance / totalIncome) * 100;
    if (ratio >= 50) return "HEALTHY";
    if (ratio >= 25) return "WARNING";
    return "CRITICAL";
  }
}
