import { prisma } from "../../config/database.js";
import { BaseRepository } from "../../shared/base/base.repository.js";

export class OrganizationRepository extends BaseRepository {
  constructor() {
    super(prisma.organization);
  }

  // ─── Organization ─────────────────────────────────────────────

  async countActiveByOwner(ownerId) {
    return prisma.organization.count({
      where: { ownerId, isActive: true },
    });
  }

  async findOwnerPermissions(ownerId) {
    return prisma.user.findUnique({
      where: { id: ownerId },
      select: { canCreateOrganization: true },
    });
  }

  async findByIdWithDetails(organizationId, userId) {
    const [organization, membership] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId, isActive: true },
        include: {
          owner: {
            select: { id: true, prenom: true, nom: true, email: true, phone: true },
          },
          settings: true,
          subscription: true,
          wallet: true,
          _count: {
            select: {
              members: { where: { status: "ACTIVE" } },
              contributionPlans: { where: { isActive: true } },
              contributions: { where: { status: { in: ["PAID", "PARTIAL"] } } },
              debts: { where: { status: { in: ["ACTIVE", "PARTIALLY_PAID"] } } },
            },
          },
        },
      }),
      prisma.membership.findFirst({
        where: { userId, organizationId, status: "ACTIVE" },
        select: {
          id: true,
          role: true,
          joinDate: true,
          status: true,
          loginId: true,
          memberNumber: true,
          createdAt: true,
          profile: true,
        },
      }),
    ]);

    return { organization, membership };
  }

  async findUserOrganizations(userId) {
    return prisma.membership.findMany({
      where: {
        userId,
        status: "ACTIVE",
        organization: { isActive: true },
      },
      include: {
        organization: {
          include: {
            owner: {
              select: { id: true, prenom: true, nom: true, email: true },
            },
            settings: true,
            subscription: true,
            wallet: true,
            _count: {
              select: { members: { where: { status: "ACTIVE" } } },
            },
          },
        },
      },
      orderBy: { organization: { createdAt: "desc" } },
    });
  }

  async findInactiveOrganizations(userId, { page, limit }) {
    const skip = (page - 1) * limit;

    const where = {
      isActive: false,
      members: { some: { userId, status: "ACTIVE" } },
    };

    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        include: {
          owner: {
            select: { id: true, prenom: true, nom: true, email: true },
          },
          subscription: true,
          members: {
            where: { userId, status: "ACTIVE" },
            select: { role: true, status: true, joinDate: true },
            take: 1,
          },
          _count: {
            select: { members: { where: { status: "ACTIVE" } } },
          },
        },
        skip,
        take: limit,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.organization.count({ where }),
    ]);

    return { organizations, total };
  }

  async searchOrganizations(userId, { search, type, page, limit }) {
    const skip = (page - 1) * limit;

    const where = {
      members: { some: { userId, status: "ACTIVE" } },
      isActive: true,
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      }),
      ...(type && { type }),
    };

    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        include: {
          owner: {
            select: { id: true, prenom: true, nom: true, email: true },
          },
          subscription: true,
          _count: {
            select: { members: { where: { status: "ACTIVE" } } },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.organization.count({ where }),
    ]);

    return { organizations, total };
  }

  async findByIdWithLogo(organizationId) {
    return prisma.organization.findUnique({
      where: { id: organizationId },
      select: { logo: true },
    });
  }

  async findByIdWithWallet(organizationId) {
    return prisma.organization.findUnique({
      where: { id: organizationId },
      include: { owner: true, wallet: true },
    });
  }

  async findByIdWithSettings(organizationId) {
    return prisma.organization.findUnique({
      where: { id: organizationId },
      include: { settings: true },
    });
  }

  async updateOrganization(organizationId, data) {
    return prisma.organization.update({
      where: { id: organizationId, isActive: true },
      data,
      include: {
        owner: {
          select: { id: true, prenom: true, nom: true, email: true },
        },
        settings: true,
        subscription: true,
      },
    });
  }

  async updateSettings(settingsId, data) {
    return prisma.organizationSettings.update({
      where: { id: settingsId },
      data,
    });
  }

  async setActiveStatus(organizationId, isActive) {
    return prisma.organization.update({
      where: { id: organizationId },
      data: { isActive },
      include: {
        owner: { select: { id: true, prenom: true, nom: true, email: true } },
      },
    });
  }

  // ─── Membership ───────────────────────────────────────────────

  async findAdminMembership(userId, organizationId) {
    return prisma.membership.findFirst({
      where: {
        userId,
        organizationId,
        status: "ACTIVE",
        role: { in: ["ADMIN"] },
      },
    });
  }

  async findActiveMembership(userId, organizationId) {
    return prisma.membership.findFirst({
      where: { userId, organizationId, status: "ACTIVE" },
    });
  }

  // ─── Wallet ───────────────────────────────────────────────────

  async updateWalletBalance(organizationId, data) {
    return prisma.organizationWallet.update({
      where: { organizationId },
      data,
    });
  }

  // ─── Audit Log ────────────────────────────────────────────────

  async createAuditLog(data) {
    return prisma.auditLog.create({ data });
  }

  async createAuditLogInTx(tx, data) {
    return tx.auditLog.create({ data });
  }

  // ─── Stats ────────────────────────────────────────────────────

  async getStats(organizationId) {
    const [
      memberCount,
      activeContributions,
      totalContributions,
      pendingContributions,
      totalDebts,
      recentTransactions,
      wallet,
      totalIncome,
      totalExpenses,
    ] = await Promise.all([
      prisma.membership.count({ where: { organizationId, status: "ACTIVE" } }),
      prisma.contributionPlan.count({ where: { organizationId, isActive: true } }),
      prisma.contribution.aggregate({
        where: { organizationId },
        _sum: { amount: true },
      }),
      prisma.contribution.count({ where: { organizationId, status: "PENDING" } }),
      prisma.debt.aggregate({
        where: { organizationId, status: "ACTIVE" },
        _sum: { remainingAmount: true },
      }),
      prisma.transaction.count({
        where: {
          organizationId,
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.organizationWallet.findUnique({
        where: { organizationId },
        select: {
          currentBalance: true,
          totalIncome: true,
          totalExpenses: true,
          currency: true,
        },
      }),
      prisma.transaction.aggregate({
        where: {
          organizationId,
          paymentStatus: "COMPLETED",
          type: { in: ["CONTRIBUTION", "DEBT_REPAYMENT", "DONATION"] },
        },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: { organizationId, status: { in: ["APPROVED", "PAID"] } },
        _sum: { amount: true },
      }),
    ]);

    return {
      members: memberCount,
      activeContributionPlans: activeContributions,
      totalContributions: totalContributions._sum.amount || 0,
      pendingContributions,
      activeDebts: totalDebts._sum.remainingAmount || 0,
      recentTransactions,
      financial: {
        currentBalance: wallet?.currentBalance || 0,
        totalIncome: totalIncome._sum.amount || 0,
        totalExpenses: totalExpenses._sum.amount || 0,
        currency: wallet?.currency || "XOF",
        netBalance:
          (totalIncome._sum.amount || 0) - (totalExpenses._sum.amount || 0),
      },
    };
  }
}