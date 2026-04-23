import { prisma } from "../../config/database.js";
import { BaseRepository } from "../../shared/base/base.repository.js";

export class ContributionPlanRepository extends BaseRepository {
  constructor() {
    super(prisma.contributionPlan);
  }

  // ─── Contribution Plans ───────────────────────────────────────

  async createPlan(data) {
    return prisma.contributionPlan.create({ data });
  }

  async findPlanByIdAndOrg(planId, organizationId) {
    return prisma.contributionPlan.findFirst({
      where: { id: planId, organizationId },
    });
  }

  async findByIdWithDetails(planId, organizationId) {
    return prisma.contributionPlan.findFirst({
      where: { id: planId, organizationId },
      include: {
        _count: { select: { contributions: true } },
        contributions: {
          include: {
            membership: {
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
            },
          },
          orderBy: [{ status: "asc" }, { dueDate: "desc" }],
        },
      },
    });
  }

  async findWithFilters(organizationId, { isActive, search, page, limit }) {
    const skip = (page - 1) * limit;
    const where = {
      organizationId,
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [plans, total] = await Promise.all([
      prisma.contributionPlan.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { contributions: true } } },
      }),
      prisma.contributionPlan.count({ where }),
    ]);

    return { plans, total };
  }

  async updatePlan(planId, data) {
    return prisma.contributionPlan.update({
      where: { id: planId },
      data,
    });
  }

  async togglePlanStatus(planId, isActive) {
    return prisma.contributionPlan.update({
      where: { id: planId },
      data: { isActive },
    });
  }

  // ─── Membership ───────────────────────────────────────────────

  async requireMembership(userId, organizationId, roles = []) {
    return prisma.membership.findFirst({
      where: {
        userId,
        organizationId,
        status: "ACTIVE",
        ...(roles.length && { role: { in: roles } }),
      },
    });
  }

  async findMemberForAssignment(membershipId) {
    return prisma.membership.findUnique({
      where: { id: membershipId },
      include: { user: { select: { gender: true, prenom: true, nom: true } } },
    });
  }

  async findActiveMembers(organizationId) {
    return prisma.membership.findMany({
      where: { organizationId, status: "ACTIVE" },
      include: { user: { select: { gender: true, prenom: true, nom: true } } },
    });
  }

  // ─── Contributions ────────────────────────────────────────────

  async findActivePlan(planId, organizationId) {
    return prisma.contributionPlan.findFirst({
      where: { id: planId, organizationId, isActive: true },
    });
  }

  async countContributionsForPeriod(planId, organizationId, dueDateRange) {
    return prisma.contribution.count({
      where: {
        contributionPlanId: planId,
        organizationId,
        dueDate: dueDateRange,
      },
    });
  }

  async deleteContributionsForPeriod(planId, organizationId, dueDateRange) {
    return prisma.contribution.deleteMany({
      where: {
        contributionPlanId: planId,
        organizationId,
        dueDate: dueDateRange,
      },
    });
  }

  async findExistingContributionForPeriod(
    membershipId,
    planId,
    organizationId,
    dueDateRange,
  ) {
    return prisma.contribution.findFirst({
      where: {
        membershipId,
        contributionPlanId: planId,
        organizationId,
        dueDate: dueDateRange,
      },
    });
  }

  async createContribution(data) {
    return prisma.contribution.create({
      data,
      include: {
        membership: {
          include: {
            user: {
              select: { prenom: true, nom: true, gender: true },
            },
          },
        },
        contributionPlan: {
          select: { name: true, frequency: true },
        },
      },
    });
  }

  async createManyContributions(tx, data) {
    return tx.contribution.createMany({ data });
  }

  async deleteManyContributions(tx, planId, organizationId, dueDateRange) {
    return tx.contribution.deleteMany({
      where: {
        contributionPlanId: planId,
        organizationId,
        dueDate: dueDateRange,
      },
    });
  }

  async findContributionWithMember(contributionId) {
    return prisma.contribution.findUnique({
      where: { id: contributionId },
      include: {
        membership: {
          include: { user: { select: { prenom: true, nom: true } } },
        },
      },
    });
  }

  async updateContributionStatus(contributionId, status) {
    return prisma.contribution.update({
      where: { id: contributionId },
      data: { status },
    });
  }

  // ─── Audit Log ────────────────────────────────────────────────

  async createAuditLog(data) {
    return prisma.auditLog.create({ data });
  }

  async createAuditLogInTx(tx, data) {
    return tx.auditLog.create({ data });
  }

  async markOverdue() {
    return prisma.contribution.updateMany({
      where: {
        status: { in: ["PENDING", "PARTIAL"] },
        dueDate: { lt: new Date() },
      },
      data: { status: "OVERDUE" },
    });
  }
}
