import { prisma } from "../../config/database.js";
import { BaseRepository } from "../../shared/base/base.repository.js";

export class MembershipRepository extends BaseRepository {
  constructor() {
    super(prisma.membership);
  }

  // ─── Membership Lookups ───────────────────────────────────────

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

  async findById(membershipId) {
    return prisma.membership.findUnique({
      where: { id: membershipId },
    });
  }

  async findWithDetails(membershipId) {
    return prisma.membership.findUnique({
      where: { id: membershipId },
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
        organization: { select: { id: true, name: true } },
        profile: true,
        _count: {
          select: {
            contributions: true,
            debts: true,
            transactions: true,
          },
        },
      },
    });
  }

  async findWithDetailsAndUser(membershipId) {
    return prisma.membership.findUnique({
      where: { id: membershipId },
      include: {
        user: { select: { id: true, prenom: true, nom: true, email: true } },
      },
    });
  }

  async findWithFilters(organizationId, { whereClause, skip, take }) {
    const [memberships, total] = await Promise.all([
      prisma.membership.findMany({
        where: { organizationId, ...whereClause },
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

  // ─── Membership Mutations ─────────────────────────────────────

  async createMembership(data) {
    return prisma.membership.create({
      data,
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
        organization: { select: { id: true, name: true } },
      },
    });
  }

  async createProvisionalMembership(data) {
    return prisma.membership.create({
      data,
      include: {
        organization: { select: { id: true, name: true } },
      },
    });
  }

  async updateMembership(membershipId, data) {
    return prisma.membership.update({
      where: { id: membershipId },
      data,
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
    });
  }

  async deleteMembership(membershipId) {
    return prisma.membership.delete({
      where: { id: membershipId },
      include: {
        user: { select: { id: true, prenom: true, nom: true, email: true } },
      },
    });
  }

  // ─── Organization Helpers ─────────────────────────────────────

  async incrementMemberCounter(organizationId) {
    return prisma.organization.update({
      where: { id: organizationId },
      data: { memberCounter: { increment: 1 } },
      select: { memberCounter: true },
    });
  }

  async findUserByPhone(phone) {
    return prisma.user.findUnique({ where: { phone } });
  }

  // ─── Subscription ─────────────────────────────────────────────

  async findSubscription(organizationId) {
    return prisma.subscription.findUnique({ where: { organizationId } });
  }

  async countActiveMembers(organizationId) {
    return prisma.membership.count({
      where: { organizationId, status: "ACTIVE" },
    });
  }

  async updateSubscriptionUsage(organizationId, increment) {
    return prisma.subscription.update({
      where: { organizationId },
      data: { currentUsage: { increment } },
    });
  }

  // ─── Audit Log ────────────────────────────────────────────────

  async createAuditLog(data) {
    return prisma.auditLog.create({ data });
  }
}