// src/modules/dashboards/member.dashboard.service.js

export class MemberDashboardService {
  constructor(repo) {
    this.repo = repo;
  }

  async getDashboardData(organizationId, membershipId) {
    const [
      kpis,
      contributions,
      overdueContributions,
      upcomingContributions,
      personalDebts,
      recentPayments,
      recentRepayments,
      history,
      personalStats,
    ] = await Promise.all([
      this.#getMemberKPIs(organizationId, membershipId),
      this.repo.getActiveContributionsList(organizationId, membershipId),
      this.#getOverdueContributions(organizationId, membershipId),
      this.#getUpcomingContributions(organizationId, membershipId),
      this.#getPersonalDebts(organizationId, membershipId),
      this.repo.getRecentMemberPaymentsList(organizationId, membershipId),
      this.repo.getRecentMemberRepaymentsList(organizationId, membershipId),
      this.#getPaymentHistory(organizationId, membershipId),
      this.#getPersonalStatistics(organizationId, membershipId),
    ]);

    const memberInfo = await this.#getMemberInfo(membershipId);

    return {
      role: "MEMBER",
      organizationId,
      membershipId,
      generatedAt: new Date(),
      memberInfo,
      kpis,
      contributions: {
        active: contributions,
        overdue: overdueContributions,
        upcoming: upcomingContributions,
      },
      debts: personalDebts,
      recentActivities: {
        payments: recentPayments,
        repayments: recentRepayments,
      },
      history,
      statistics: personalStats,
    };
  }

  // --- FORMATTERS PRIVÉS ---

  async #getMemberKPIs(orgId, memberId) {
    const [contributions, overdueAmount] = await Promise.all([
      this.repo.getMemberContributionsAgg(orgId, memberId),
      this.repo.getMemberOverdueContributionsAgg(orgId, memberId),
    ]);

    const totalDue = contributions._sum.amount || 0;
    const totalPaid = contributions._sum.amountPaid || 0;
    const overdueTotal =
      (overdueAmount._sum.amount || 0) - (overdueAmount._sum.amountPaid || 0);

    return {
      totalDue,
      totalPaid,
      totalRemaining: totalDue - totalPaid,
      overdueAmount: overdueTotal,
    };
  }

  // Correction du KPI ci-dessus pour être strictement lié au membre :
  async #getPersonalStatistics(orgId, memberId) {
    const [txAgg, paidContributions] = await Promise.all([
      this.repo.getMemberTransactionsAgg(orgId, memberId),
      this.repo.getContributionPaymentDelay(orgId, memberId),
    ]);

    let onTimePayments = 0;
    paidContributions.forEach((c) => {
      const daysDiff = Math.ceil(
        (new Date(c.paymentDate).getTime() - new Date(c.dueDate).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      if (daysDiff <= 7) onTimePayments++;
    });

    const avgDelay =
      paidContributions.length === 0
        ? 0
        : Math.round(
            paidContributions.reduce(
              (sum, c) =>
                sum +
                Math.ceil(
                  (new Date(c.paymentDate).getTime() -
                    new Date(c.dueDate).getTime()) /
                    (1000 * 60 * 60 * 24),
                ),
              0,
            ) / paidContributions.length,
          );

    return {
      totalTransactions: txAgg._count,
      averagePaymentDelay: avgDelay,
      paymentRegularityRate:
        paidContributions.length > 0
          ? Math.round((onTimePayments / paidContributions.length) * 100)
          : 0,
      totalContributions: paidContributions.length,
      onTimePayments,
      latePayments: paidContributions.length - onTimePayments,
    };
  }

  async #getOverdueContributions(orgId, memberId) {
    const today = new Date();
    const contributions = await this.repo.getOverdueContributionsList(
      orgId,
      memberId,
    );
    return contributions.map((c) => {
      const daysLate = Math.ceil(
        (today.getTime() - new Date(c.dueDate).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      return {
        id: c.id,
        planName: c.contributionPlan.name,
        dueDate: c.dueDate,
        amount: c.amount,
        remaining: c.amount - c.amountPaid,
        daysLate,
        status: c.status,
      };
    });
  }

  async #getUpcomingContributions(orgId, memberId) {
    const today = new Date();
    const contributions = await this.repo.getUpcomingContributionsList(
      orgId,
      memberId,
    );
    return contributions.map((c) => ({
      id: c.id,
      planName: c.contributionPlan.name,
      dueDate: c.dueDate,
      amount: c.amount,
      amountPaid: c.amountPaid,
      remaining: c.amount - c.amountPaid,
      daysUntilDue: Math.ceil(
        (new Date(c.dueDate).getTime() - today.getTime()) /
          (1000 * 60 * 60 * 24),
      ),
    }));
  }

  async #getPersonalDebts(orgId, memberId) {
    const [list, agg] = await Promise.all([
      this.repo.getPersonalDebtsList(orgId, memberId),
      this.repo.getPersonalDebtsAgg(orgId, memberId),
    ]);
    return {
      list: list.map((d) => ({
        id: d.id,
        title: d.title,
        initialAmount: d.initialAmount,
        remainingAmount: d.remainingAmount,
        status: d.status,
        startDate: d.createdAt,
        dueDate: d.dueDate,
        percentagePaid:
          d.initialAmount > 0
            ? Math.round(
                ((d.initialAmount - d.remainingAmount) / d.initialAmount) * 100,
              )
            : 0,
      })),
      aggregates: {
        activeDebtsCount: agg._count,
        totalDebtRemaining: agg._sum.remainingAmount || 0,
      },
    };
  }

  async #getPaymentHistory(orgId, memberId, limit = 20) {
    const [contributions, debts] = await Promise.all([
      this.repo.getContributionsForHistory(orgId, memberId, limit),
      this.repo.getPersonalDebtsForHistory(orgId, memberId, limit),
    ]);

    const history = [
      ...contributions.map((c) => ({
        date: c.paymentDate || c.updatedAt,
        type: "CONTRIBUTION",
        label: `Cotisation: ${c.contributionPlan.name}`,
        amount: c.amountPaid,
        status: c.status,
      })),
      ...debts.map((d) => ({
        date: d.updatedAt,
        type: "DEBT_SETTLEMENT",
        label: `Dette soldée: ${d.title}`,
        amount: d.initialAmount - d.remainingAmount,
        status: "PAID",
      })),
    ];

    return history
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, limit);
  }

  async #getMemberInfo(membershipId) {
    const m = await this.repo.findMemberInfo(membershipId);
    if (!m) return null;
    return {
      memberNumber: m.memberNumber,
      fullName: `${m.user.prenom} ${m.user.nom}`,
      email: m.user.email,
      phone: m.user.phone,
      avatar: m.user.avatar,
      joinDate: m.joinDate,
      status: m.status,
      role: m.role,
      profile: m.profile,
    };
  }
}
