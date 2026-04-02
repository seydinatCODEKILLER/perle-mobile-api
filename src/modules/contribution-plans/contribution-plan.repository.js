import { prisma } from "../../config/database.js";
import { BaseRepository } from "../../shared/base/base.repository.js";

export class ContributionPlanRepository extends BaseRepository {
  constructor() {
    super(prisma.contributionPlan);
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

  // ─── Lifecycle Helpers ────────────────────────────────────────

  async findActivePlan(planId, organizationId) {
    return prisma.contributionPlan.findFirst({
      where: { id: planId, organizationId, isActive: true },
    });
  }

  async findActiveMembers(organizationId) {
    return prisma.membership.findMany({
      where: { organizationId, status: "ACTIVE" },
      include: { user: { select: { gender: true, prenom: true, nom: true } } },
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

  async findMemberForAssignment(membershipId) {
    return prisma.membership.findUnique({
      where: { id: membershipId },
      include: { user: { select: { gender: true, prenom: true, nom: true } } },
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
}
