import { prisma } from "../../config/database.js";
import { BaseRepository } from "../../shared/base/base.repository.js";

const ORG_INCLUDE = {
  organization: { select: { id: true, name: true, currency: true } },
};

export class SubscriptionRepository extends BaseRepository {
  constructor() {
    super(prisma.subscription);
  }

  // ─── Membership ─────────────────────────────────────────────

  async findActiveMembership(userId, organizationId) {
    return prisma.membership.findFirst({
      where: { userId, organizationId, status: "ACTIVE" },
    });
  }

  async findAdminMembership(userId, organizationId) {
    return prisma.membership.findFirst({
      where: { userId, organizationId, status: "ACTIVE", role: "ADMIN" },
    });
  }

  // ─── Lectures ───────────────────────────────────────────────

  async findByOrganizationId(organizationId) {
    return prisma.subscription.findUnique({
      where: { organizationId },
      include: ORG_INCLUDE,
    });
  }

  async getUsageCounts(organizationId) {
    const [activeMembersCount, activePlansCount] = await Promise.all([
      prisma.membership.count({ where: { organizationId, status: "ACTIVE" } }),
      prisma.contributionPlan.count({ where: { organizationId, isActive: true } }),
    ]);

    return { activeMembersCount, activePlansCount };
  }

  // ─── Écritures Transactionnelles ────────────────────────────

  async getOrCreate(organizationId) {
    let subscription = await this.findByOrganizationId(organizationId);
    
    if (!subscription) {
      subscription = await prisma.subscription.create({
        data: {
          organizationId,
          plan: "FREE",
          status: "ACTIVE",
          startDate: new Date(),
          maxMembers: 50,
          currentUsage: 0,
          price: 0,
          currency: "XOF",
        },
        include: ORG_INCLUDE,
      });
    }

    return subscription;
  }

  async updateWithAudit(organizationId, data, auditData) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.subscription.update({
        where: { organizationId },
        data,
        include: ORG_INCLUDE,
      });

      await tx.auditLog.create({
        data: {
          action: "UPDATE_SUBSCRIPTION",
          resource: "subscription",
          resourceId: updated.id,
          userId: auditData.userId,
          organizationId,
          membershipId: auditData.membershipId,
          details: data,
        },
      });

      return updated;
    });
  }

  async updateStatusWithAudit(organizationId, status, auditData, previousStatus) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.subscription.update({
        where: { organizationId },
        data: { status },
        include: ORG_INCLUDE,
      });

      await tx.auditLog.create({
        data: {
          action: "UPDATE_SUBSCRIPTION_STATUS",
          resource: "subscription",
          resourceId: updated.id,
          userId: auditData.userId,
          organizationId,
          membershipId: auditData.membershipId,
          details: { previousStatus, newStatus: status },
        },
      });

      return updated;
    });
  }

  async changePlanWithAudit(organizationId, planData, auditData, oldSubscription) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.subscription.update({
        where: { organizationId },
        data: {
          plan: planData.plan,
          maxMembers: planData.maxMembers,
          price: planData.price,
          status: "ACTIVE",
          startDate: new Date(),
          endDate: planData.endDate,
        },
        include: ORG_INCLUDE,
      });

      await tx.auditLog.create({
        data: {
          action: "CHANGE_SUBSCRIPTION_PLAN",
          resource: "subscription",
          resourceId: updated.id,
          userId: auditData.userId,
          organizationId,
          membershipId: auditData.membershipId,
          details: {
            oldPlan: oldSubscription.plan,
            newPlan: updated.plan,
            oldPrice: oldSubscription.price,
            newPrice: updated.price,
            oldMaxMembers: oldSubscription.maxMembers,
            newMaxMembers: updated.maxMembers,
          },
        },
      });

      return updated;
    });
  }
}