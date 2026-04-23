
const LABELS = {
  ACTIVE: "Actif",
  INACTIVE: "Inactif",
  SUSPENDED: "Suspendu",
};
const METHODS = {
  CASH: "Espèces",
  MOBILE_MONEY: "Mobile Money",
  BANK_TRANSFER: "Virement",
  CHECK: "Chèque",
  CREDIT_CARD: "Carte bancaire",
  INTERNAL: "Interne",
};
const CATEGORIES = {
  EVENT: "Événement",
  SOCIAL: "Social",
  ADMINISTRATIVE: "Administratif",
  MAINTENANCE: "Maintenance",
  DONATION: "Don",
  INVESTMENT: "Investissement",
  OPERATIONAL: "Opérationnel",
  OTHER: "Autre",
};

export class AdminDashboardService {
  constructor(repo) {
    this.repo = repo;
  }

  async getDashboardData(organizationId) {
    const [
      activeMembers,
      totalCollected,
      pendingContributions,
      activeDebts,
      overdueContributions,
      walletOverview,
      expensesOverview,
      financialSummary,
      paymentMethodsDistribution,
      monthlyRevenue,
      monthlyExpenses,
      memberStatusDistribution,
      subscriptionInfo,
    ] = await Promise.all([
      this.#getActiveMembersCount(organizationId),
      this.#getTotalCollected(organizationId),
      this.#getPendingContributions(organizationId),
      this.#getActiveDebts(organizationId),
      this.#getOverdueContributions(organizationId),
      this.#getWalletOverview(organizationId),
      this.#getExpensesOverview(organizationId),
      this.#getFinancialSummary(organizationId),
      this.#getPaymentMethodsDistribution(organizationId),
      this.#getMonthlyRevenue(organizationId),
      this.#getMonthlyExpenses(organizationId),
      this.#getMemberStatusDistribution(organizationId),
      this.#getSubscriptionInfo(organizationId),
    ]);

    return {
      role: "ADMIN",
      organizationId,
      generatedAt: new Date(),
      kpis: {
        activeMembers,
        totalCollected,
        pendingContributions,
        activeDebts,
        overdueContributions,
      },
      financialOverview: {
        wallet: walletOverview,
        summary: financialSummary,
        paymentMethods: paymentMethodsDistribution,
        expenses: expensesOverview,
      },
      charts: {
        monthlyRevenue,
        monthlyExpenses,
        paymentMethods: paymentMethodsDistribution,
        memberStatus: memberStatusDistribution,
      },
      subscription: subscriptionInfo,
      recentActivities: await this.repo.getRecentActivities(organizationId),
    };
  }

  // --- FORMATTERS PRIVÉS ---

  async #getActiveMembersCount(orgId) {
    const value = await this.repo.getMemberCounts(orgId);
    const trend = await this.repo.getMemberTrend(orgId);
    return { value, label: "Membres actifs", icon: "👥", trend };
  }

  async #getTotalCollected(orgId) {
    const result = await this.repo.getTransactionsAgg(orgId, [
      "CONTRIBUTION",
      "DEBT_REPAYMENT",
    ]);
    return {
      value: result._sum.amount || 0,
      label: "Total collecté",
      icon: "💰",
      currency: "XOF",
    };
  }

  async #getPendingContributions(orgId) {
    const r = await this.repo.getPendingContributionsAgg(orgId);
    const totalAmount = r._sum.amount || 0;
    const totalPaid = r._sum.amountPaid || 0;
    return {
      value: r._count,
      label: "Cotisations en attente",
      icon: "⏳",
      details: {
        count: r._count,
        totalAmount,
        totalPaid,
        remaining: totalAmount - totalPaid,
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
    const totalAmount = r._sum.amount || 0;
    const totalPaid = r._sum.amountPaid || 0;
    return {
      value: r._count,
      label: "Cotisations en retard",
      icon: "📅",
      details: {
        count: r._count,
        totalAmount,
        totalPaid,
        remaining: totalAmount - totalPaid,
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
    return {
      exists: true,
      id: w.id,
      currentBalance: w.currentBalance,
      totalIncome: w.totalIncome,
      totalExpenses: w.totalExpenses,
      currency: w.currency,
      lastUpdated: w.lastUpdated,
      netBalance: w.totalIncome - w.totalExpenses,
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
      total: { count: d.total._count, amount: d.total._sum.amount || 0 },
      byCategory: d.byCategory.map((c) => ({
        category: c.category,
        label: CATEGORIES[c.category] || c.category,
        amount: c._sum.amount || 0,
        count: c._count.id,
      })),
    };
  }

  async #getFinancialSummary(orgId) {
    const [expected, collected, debts, expensesAgg] = await Promise.all([
      this.repo.getCollectionAgg(orgId),
      this.repo.getTransactionsAgg(orgId, ["CONTRIBUTION", "DEBT_REPAYMENT"]),
      this.repo.getActiveDebtsAgg(orgId),
      this.repo.getExpensesOverviewAgg(orgId), // Utilisé pour récupérer le total proprement
    ]);
    const totalExpenses = expensesAgg.total._sum.amount || 0;
    const expectedAmount = expected._sum.amount || 0;
    const collectedAmount = collected._sum.amount || 0;
    return {
      expectedAmount,
      collectedAmount,
      remainingAmount: expectedAmount - collectedAmount,
      remainingDebts: debts._sum.remainingAmount || 0,
      totalExpenses,
      netBalance: collectedAmount - totalExpenses,
    };
  }

  async #getPaymentMethodsDistribution(orgId) {
    const result = await this.repo.getPaymentMethodsDistribution(orgId);
    const total = result.reduce(
      (sum, item) => sum + (item._sum.amount || 0),
      0,
    );
    return result.map((item) => ({
      method: item.paymentMethod,
      name: METHODS[item.paymentMethod] || item.paymentMethod,
      amount: item._sum.amount || 0,
      count: item._count,
      percentage:
        total > 0 ? Math.round(((item._sum.amount || 0) / total) * 100) : 0,
    }));
  }

  async #getMonthlyRevenue(orgId, months = 6) {
    const transactions = await this.repo.getMonthlyRevenueList(orgId, months);
    const monthlyData = {};
    transactions.forEach((t) => {
      const key = t.createdAt.toISOString().slice(0, 7);
      monthlyData[key] = (monthlyData[key] || 0) + t.amount;
    });
    return Object.entries(monthlyData)
      .map(([month, amount]) => ({
        month,
        amount,
        label: new Date(month + "-01").toLocaleDateString("fr-FR", {
          month: "long",
          year: "numeric",
        }),
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  async #getMonthlyExpenses(orgId, months = 6) {
    const expenses = await this.repo.getMonthlyExpensesList(orgId, months);
    const monthlyData = {};
    expenses.forEach((e) => {
      const key = e.expenseDate.toISOString().slice(0, 7);
      monthlyData[key] = (monthlyData[key] || 0) + e.amount;
    });
    return Object.entries(monthlyData)
      .map(([month, amount]) => ({
        month,
        amount,
        label: new Date(month + "-01").toLocaleDateString("fr-FR", {
          month: "long",
          year: "numeric",
        }),
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  async #getMemberStatusDistribution(orgId) {
    const result = await this.repo.getMemberStatusDistribution(orgId);
    return result.map((item) => ({
      status: item.status,
      count: item._count,
      label: LABELS[item.status] || item.status,
    }));
  }

  async #getSubscriptionInfo(orgId) {
    const data = await this.repo.getSubscriptionInfo(orgId);
    if (!data) return null;
    const { subscription, memberCount } = data;
    return {
      plan: subscription.plan,
      status: subscription.status,
      maxMembers: subscription.maxMembers,
      currentUsage: memberCount,
      usagePercentage: Math.round(
        (memberCount / subscription.maxMembers) * 100,
      ),
      price: subscription.price,
      currency: subscription.currency,
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      daysRemaining: subscription.endDate
        ? Math.ceil(
            (subscription.endDate.getTime() - new Date().getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : null,
    };
  }
}
