import { prisma } from "../../config/database.js";

export class DashboardRepository {
  // ─── Membership & Member Info ───────────────────────────────

  async findActiveMembership(userId, organizationId) {
    return prisma.membership.findFirst({
      where: { userId, organizationId, status: "ACTIVE" },
      select: {
        id: true,
        role: true,
        status: true,
        memberNumber: true,
        userId: true,
      },
    });
  }

  async findMemberInfo(membershipId) {
    return prisma.membership.findUnique({
      where: { id: membershipId },
      include: {
        user: {
          select: {
            prenom: true,
            nom: true,
            email: true,
            phone: true,
            avatar: true,
          },
        },
        profile: true,
      },
    });
  }

  // ─── Members (Admin) ────────────────────────────────────────

  async getMemberCounts(organizationId) {
    return prisma.membership.count({
      where: { organizationId, status: "ACTIVE" },
    });
  }

  async getMemberTrend(organizationId) {
    const today = new Date();
    const lastMonth = new Date(today);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const [current, previous] = await Promise.all([
      prisma.membership.count({
        where: { organizationId, status: "ACTIVE", createdAt: { lte: today } },
      }),
      prisma.membership.count({
        where: {
          organizationId,
          status: "ACTIVE",
          createdAt: { lte: lastMonth },
        },
      }),
    ]);
    return previous === 0
      ? 0
      : Math.round(((current - previous) / previous) * 100);
  }

  async getMemberStatusDistribution(organizationId) {
    return prisma.membership.groupBy({
      by: ["status"],
      where: { organizationId },
      _count: true,
    });
  }

  // ─── Contributions ──────────────────────────────────────────

  async getPendingContributionsAgg(organizationId) {
    return prisma.contribution.aggregate({
      where: { organizationId, status: { in: ["PENDING", "PARTIAL"] } },
      _sum: { amount: true, amountPaid: true },
      _count: true,
    });
  }

  async getOverdueContributionsAgg(organizationId) {
    return prisma.contribution.aggregate({
      where: { organizationId, status: "OVERDUE" },
      _sum: { amount: true, amountPaid: true },
      _count: true,
    });
  }

  async getCollectionAgg(organizationId) {
    return prisma.contribution.aggregate({
      where: { organizationId },
      _sum: { amount: true },
    });
  }

  async getContributionPaymentDelay(organizationId, membershipId = null) {
    return prisma.contribution.findMany({
      where: {
        organizationId,
        ...(membershipId && { membershipId }),
        status: "PAID",
        paymentDate: { not: null },
      },
      select: { dueDate: true, paymentDate: true },
      take: 50,
    });
  }

  // ✅ NOUVEAU : Agrégats strictement liés au membre (pour le dashboard personnel)
  async getMemberContributionsAgg(organizationId, membershipId) {
    return prisma.contribution.aggregate({
      where: { organizationId, membershipId },
      _sum: { amount: true, amountPaid: true },
      _count: true,
    });
  }

  // ✅ NOUVEAU : Retards strictement liés au membre
  async getMemberOverdueContributionsAgg(organizationId, membershipId) {
    return prisma.contribution.aggregate({
      where: { organizationId, membershipId, status: "OVERDUE" },
      _sum: { amount: true, amountPaid: true },
    });
  }

  async getActiveContributionsList(organizationId, membershipId, limit = 10) {
    return prisma.contribution.findMany({
      where: {
        organizationId,
        membershipId,
        status: { in: ["PENDING", "PARTIAL"] },
      },
      include: {
        contributionPlan: { select: { name: true, frequency: true } },
      },
      orderBy: { dueDate: "asc" },
      take: limit,
    });
  }

  async getOverdueContributionsList(organizationId, membershipId, limit = 10) {
    return prisma.contribution.findMany({
      where: { organizationId, membershipId, status: "OVERDUE" },
      include: { contributionPlan: { select: { name: true } } },
      orderBy: { dueDate: "desc" },
      take: limit,
    });
  }

  async getUpcomingContributionsList(organizationId, membershipId, limit = 5) {
    const today = new Date();
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    return prisma.contribution.findMany({
      where: {
        organizationId,
        membershipId,
        status: { in: ["PENDING", "PARTIAL"] },
        dueDate: { gte: today, lte: nextMonth },
      },
      include: { contributionPlan: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
      take: limit,
    });
  }

  async getContributionsForHistory(organizationId, membershipId, limit = 20) {
    return prisma.contribution.findMany({
      where: {
        organizationId,
        membershipId,
        status: { in: ["PAID", "CANCELLED"] },
      },
      include: { contributionPlan: { select: { name: true } } },
      orderBy: { paymentDate: "desc" },
      take: Math.floor(limit / 2),
    });
  }

  // ─── Debts ──────────────────────────────────────────────────

  async getActiveDebtsAgg(organizationId) {
    return prisma.debt.aggregate({
      where: { organizationId, status: { in: ["ACTIVE", "PARTIALLY_PAID"] } },
      _sum: { remainingAmount: true },
      _count: true,
    });
  }

  async getDebtsToRecoverAgg(organizationId) {
    return prisma.debt.aggregate({
      where: {
        organizationId,
        status: { in: ["ACTIVE", "PARTIALLY_PAID", "OVERDUE"] },
      },
      _sum: { remainingAmount: true },
      _count: true,
    });
  }

  async getDebtsVsPaidAgg(organizationId) {
    const [active, paid] = await Promise.all([
      prisma.debt.aggregate({
        where: { organizationId, status: { in: ["ACTIVE", "PARTIALLY_PAID"] } },
        _sum: { remainingAmount: true },
        _count: true,
      }),
      prisma.debt.aggregate({
        where: { organizationId, status: "PAID" },
        _sum: { initialAmount: true },
        _count: true,
      }),
    ]);
    return { active, paid };
  }

  async getPersonalDebtsList(organizationId, membershipId) {
    return prisma.debt.findMany({
      where: {
        organizationId,
        membershipId,
        status: { in: ["ACTIVE", "PARTIALLY_PAID"] },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
  }

  async getPersonalDebtsAgg(organizationId, membershipId) {
    return prisma.debt.aggregate({
      where: {
        organizationId,
        membershipId,
        status: { in: ["ACTIVE", "PARTIALLY_PAID"] },
      },
      _sum: { remainingAmount: true },
      _count: true,
    });
  }

  async getPersonalDebtsForHistory(organizationId, membershipId, limit = 20) {
    return prisma.debt.findMany({
      where: { organizationId, membershipId, status: "PAID" },
      orderBy: { updatedAt: "desc" },
      take: Math.floor(limit / 2),
    });
  }

  async getRecentRepaymentsList(organizationId, limit = 10) {
    return prisma.repayment.findMany({
      where: { debt: { organizationId } },
      include: { debt: { select: { title: true } }, transaction: true },
      orderBy: { paymentDate: "desc" },
      take: limit,
    });
  }

  async getRecentMemberRepaymentsList(
    organizationId,
    membershipId,
    limit = 10,
  ) {
    return prisma.repayment.findMany({
      where: { debt: { organizationId, membershipId } },
      include: { debt: { select: { title: true } } },
      orderBy: { paymentDate: "desc" },
      take: limit,
    });
  }

  // ─── Wallet & Transactions ──────────────────────────────────

  async getWalletOverview(organizationId) {
    return prisma.organizationWallet.findUnique({ where: { organizationId } });
  }

  async getTransactionsAgg(organizationId, types, dateRange = null) {
    return prisma.transaction.aggregate({
      where: {
        organizationId,
        paymentStatus: "COMPLETED",
        type: { in: types },
        ...(dateRange && {
          createdAt: { gte: dateRange.start, lt: dateRange.end },
        }),
      },
      _sum: { amount: true },
      _count: true,
    });
  }

  // ✅ NOUVEAU : Distribution des méthodes de paiement (pour graphique Admin)
  async getPaymentMethodsDistribution(organizationId) {
    return prisma.transaction.groupBy({
      by: ["paymentMethod"],
      where: { organizationId, paymentStatus: "COMPLETED" },
      _sum: { amount: true },
      _count: true,
    });
  }

  async getMonthlyRevenueList(organizationId, months = 6) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    return prisma.transaction.findMany({
      where: {
        organizationId,
        paymentStatus: "COMPLETED",
        type: { in: ["CONTRIBUTION", "DEBT_REPAYMENT"] },
        createdAt: { gte: startDate, lte: endDate },
      },
      select: { amount: true, createdAt: true },
    });
  }

  async getWeeklyRevenueTrend(organizationId, periods = 4) {
    const trends = [];
    const today = new Date();
    for (let i = 0; i < periods; i++) {
      const periodEnd = new Date(today);
      periodEnd.setDate(periodEnd.getDate() - i * 7);
      const periodStart = new Date(periodEnd);
      periodStart.setDate(periodStart.getDate() - 7);
      const result = await prisma.transaction.aggregate({
        where: {
          organizationId,
          paymentStatus: "COMPLETED",
          type: { in: ["CONTRIBUTION", "DEBT_REPAYMENT"] },
          createdAt: { gte: periodStart, lt: periodEnd },
        },
        _sum: { amount: true },
      });
      trends.unshift({
        period: `Semaine ${periods - i}`,
        startDate: periodStart,
        endDate: periodEnd,
        amount: result._sum.amount || 0,
      });
    }
    return trends;
  }

  async getRecentPaymentsList(organizationId, limit = 10) {
    return prisma.transaction.findMany({
      where: {
        organizationId,
        paymentStatus: "COMPLETED",
        type: { in: ["CONTRIBUTION", "DEBT_REPAYMENT"] },
      },
      include: {
        membership: {
          include: { user: { select: { prenom: true, nom: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async getRecentMemberPaymentsList(organizationId, membershipId, limit = 10) {
    return prisma.transaction.findMany({
      where: {
        organizationId,
        membershipId,
        paymentStatus: "COMPLETED",
        type: "CONTRIBUTION",
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async getMemberTransactionsAgg(organizationId, membershipId) {
    return prisma.transaction.aggregate({
      where: { organizationId, membershipId, paymentStatus: "COMPLETED" },
      _count: true,
    });
  }

  // ─── Expenses ───────────────────────────────────────────────

  async getExpensesOverviewAgg(organizationId) {
    const [pending, approved, paid, total, byCategory] = await Promise.all([
      prisma.expense.aggregate({
        where: { organizationId, status: "PENDING" },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.expense.aggregate({
        where: { organizationId, status: "APPROVED" },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.expense.aggregate({
        where: { organizationId, status: "PAID" },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.expense.aggregate({
        where: { organizationId, status: { not: "CANCELLED" } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.expense.groupBy({
        by: ["category"],
        where: { organizationId, status: "PAID" },
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);
    return { pending, approved, paid, total, byCategory };
  }

  async getMonthlyExpensesList(organizationId, months = 6) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    return prisma.expense.findMany({
      where: {
        organizationId,
        status: "PAID",
        expenseDate: { gte: startDate, lte: endDate },
      },
      select: { amount: true, expenseDate: true },
    });
  }

  async getWeeklyExpensesTrend(organizationId, periods = 4) {
    const trends = [];
    const today = new Date();
    for (let i = 0; i < periods; i++) {
      const periodEnd = new Date(today);
      periodEnd.setDate(periodEnd.getDate() - i * 7);
      const periodStart = new Date(periodEnd);
      periodStart.setDate(periodStart.getDate() - 7);
      const result = await prisma.expense.aggregate({
        where: {
          organizationId,
          status: "PAID",
          expenseDate: { gte: periodStart, lt: periodEnd },
        },
        _sum: { amount: true },
        _count: true,
      });
      trends.unshift({
        period: `Semaine ${periods - i}`,
        startDate: periodStart,
        endDate: periodEnd,
        amount: result._sum.amount || 0,
        count: result._count,
      });
    }
    return trends;
  }

  async getPeriodExpensesAgg(organizationId, start, end) {
    return prisma.expense.aggregate({
      where: {
        organizationId,
        status: "PAID",
        expenseDate: { gte: start, lt: end },
      },
      _sum: { amount: true },
      _count: true,
    });
  }

  async getPendingExpensesAgg(organizationId) {
    const [pending, approved] = await Promise.all([
      prisma.expense.aggregate({
        where: { organizationId, status: "PENDING" },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.expense.aggregate({
        where: { organizationId, status: "APPROVED" },
        _sum: { amount: true },
        _count: true,
      }),
    ]);
    return { pending, approved };
  }

  async getRecentExpensesList(organizationId, limit = 10) {
    return prisma.expense.findMany({
      where: { organizationId },
      include: {
        createdBy: {
          include: { user: { select: { prenom: true, nom: true } } },
        },
        approvedBy: {
          include: { user: { select: { prenom: true, nom: true } } },
        },
        transaction: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async getExpenseControlAgg(organizationId) {
    const [total, approved, rejected] = await Promise.all([
      prisma.expense.count({
        where: { organizationId, status: { not: "PENDING" } },
      }),
      prisma.expense.count({
        where: { organizationId, status: { in: ["APPROVED", "PAID"] } },
      }),
      prisma.expense.count({ where: { organizationId, status: "REJECTED" } }),
    ]);
    return { total, approved, rejected };
  }

  // ─── Subscription ───────────────────────────────────────────

  async getSubscriptionInfo(organizationId) {
    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
      include: { organization: { select: { name: true, currency: true } } },
    });
    if (!subscription) return null;
    const memberCount = await prisma.membership.count({
      where: { organizationId, status: "ACTIVE" },
    });
    return { subscription, memberCount };
  }

  // ─── Audit ─────────────────────────────────────────────────

  async getRecentActivities(organizationId, limit = 10) {
    return prisma.auditLog.findMany({
      where: {
        organizationId,
        OR: [
          { action: { contains: "PAYMENT" } },
          { action: { contains: "CONTRIBUTION" } },
          { action: { contains: "DEBT" } },
          { action: { contains: "EXPENSE" } },
          { action: { contains: "MEMBERSHIP" } },
        ],
      },
      include: {
        user: { select: { prenom: true, nom: true } },
        membership: {
          include: { user: { select: { prenom: true, nom: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }
}
