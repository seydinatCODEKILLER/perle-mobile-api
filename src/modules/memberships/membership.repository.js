import { prisma } from "../../config/database.js";
import { BaseRepository } from "../../shared/base/base.repository.js";

export class MembershipRepository extends BaseRepository {
  constructor() {
    super(prisma.membership);
  }

  async findActiveMembership(userId, organizationId) {
    return prisma.membership.findFirst({
      where: { userId, organizationId, status: "ACTIVE" },
    });
  }

  async findAuthorizedMembership(userId, organizationId, roles) {
    return prisma.membership.findFirst({
      where: {
        userId,
        organizationId,
        status: "ACTIVE",
        role: { in: roles },
      },
    });
  }

  async findUserMembershipInOrg(userId, organizationId) {
    return prisma.membership.findFirst({
      where: { userId, organizationId },
    });
  }

  async findProvisionalByPhone(organizationId, phone) {
    return prisma.membership.findFirst({
      where: {
        organizationId,
        provisionalPhone: phone,
        userId: null,
      },
    });
  }

  async findWithDetails(membershipId) {
    return prisma.membership.findUnique({
      where: { id: membershipId },
      include: {
        user: {
          select: {
            id: true, prenom: true, nom: true, email: true, phone: true, avatar: true, gender: true,
          },
        },
        organization: { select: { id: true, name: true } },
        profile: true,
        _count: { select: { contributions: true, debts: true, transactions: true } },
      },
    });
  }

  async findWithFilters(organizationId, { whereClause, skip, take }) {
    const [memberships, total] = await Promise.all([
      prisma.membership.findMany({
        where: { organizationId, ...whereClause },
        include: {
          user: { select: { id: true, prenom: true, nom: true, email: true, phone: true, avatar: true, gender: true } },
          profile: true,
          _count: { select: { contributions: true, debts: true } },
        },
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
      prisma.membership.count({ where: { organizationId, ...whereClause } }),
    ]);

    return { memberships, total };
  }

  async updateSubscriptionUsage(organizationId, increment) {
    return prisma.subscription.update({
      where: { organizationId },
      data: { currentUsage: { increment } },
    });
  }
}