// src/modules/subscriptions/subscription.service.js
import { SubscriptionRepository } from "./subscription.repository.js";
import { ForbiddenError, ConflictError, BadRequestError } from "../../shared/errors/AppError.js";

const subRepo = new SubscriptionRepository();

// ─── Constantes métier ────────────────────────────────────────

const AVAILABLE_PLANS = [
  { id: "free", name: "FREE", displayName: "Gratuit", price: 0, features: { maxMembers: 50 } },
  { id: "basic", name: "BASIC", displayName: "Basique", price: 5000, features: { maxMembers: 200 } },
  { id: "premium", name: "PREMIUM", displayName: "Premium", price: 15000, features: { maxMembers: 500 } },
  { id: "enterprise", name: "ENTERPRISE", displayName: "Entreprise", price: 30000, features: { maxMembers: "Illimité" } },
];

// ─── Helpers privés ───────────────────────────────────────────

const requireMembership = async (userId, organizationId) => {
  const membership = await subRepo.findActiveMembership(userId, organizationId);
  if (!membership) throw new ForbiddenError("Accès non autorisé à cette organisation");
  return membership;
};

const requireAdminMembership = async (userId, organizationId) => {
  const membership = await subRepo.findAdminMembership(userId, organizationId);
  if (!membership) throw new ForbiddenError("Permissions insuffisantes (ADMIN requis)");
  return membership;
};

const calculateEndDate = (planName) => {
  const endDate = new Date();
  if (planName === "FREE") endDate.setFullYear(endDate.getFullYear() + 1);
  else endDate.setMonth(endDate.getMonth() + 1);
  return endDate;
};

const getUsageRecommendations = (usagePercentage) => {
  const recommendations = [];
  if (usagePercentage >= 90) {
    recommendations.push({
      type: "URGENT",
      message: "Approche de la limite de membres. Pensez à mettre à niveau.",
      action: "UPGRADE_PLAN",
    });
  } else if (usagePercentage >= 75) {
    recommendations.push({
      type: "WARNING",
      message: "Plus de 75% de la limite de membres utilisée.",
      action: "CONSIDER_UPGRADE",
    });
  }
  return recommendations;
};

const validatePlanChange = (current, target) => {
  if (current.plan === target.name) {
    throw new ConflictError(`Vous êtes déjà sur le plan ${target.displayName}`);
  }
  
  if (typeof target.features.maxMembers === "number" && current.currentUsage > target.features.maxMembers) {
    throw new ConflictError(
      `Impossible de passer au plan ${target.displayName} : ${current.currentUsage} membres actuels, max ${target.features.maxMembers}.`
    );
  }
};

// ─── Service Class ────────────────────────────────────────────

export class SubscriptionService {

  async getOrganizationSubscription(organizationId, currentUserId) {
    await requireMembership(currentUserId, organizationId);
    return subRepo.getOrCreate(organizationId);
  }

  async updateSubscription(organizationId, currentUserId, data) {
    const adminMembership = await requireAdminMembership(currentUserId, organizationId);
    
    return subRepo.updateWithAudit(organizationId, data, {
      userId: currentUserId,
      membershipId: adminMembership.id,
    });
  }

  async updateSubscriptionStatus(organizationId, currentUserId, status) {
    const adminMembership = await requireAdminMembership(currentUserId, organizationId);
    const existing = await subRepo.getOrCreate(organizationId);

    return subRepo.updateStatusWithAudit(
      organizationId, 
      status, 
      { userId: currentUserId, membershipId: adminMembership.id },
      existing.status
    );
  }

  async checkSubscriptionLimits(organizationId, feature) {
    const subscription = await subRepo.getOrCreate(organizationId);

    if (subscription.status !== "ACTIVE") {
      throw new ConflictError(`Abonnement ${subscription.status.toLowerCase()}`);
    }
    if (subscription.endDate && subscription.endDate < new Date()) {
      throw new ConflictError("Abonnement expiré");
    }

    if (feature === "MEMBERS" && subscription.currentUsage >= subscription.maxMembers) {
      throw new ConflictError(`Limite de membres atteinte (${subscription.maxMembers}). Mettez à niveau.`);
    }

    return {
      hasAccess: true,
      subscription,
      limits: {
        maxMembers: subscription.maxMembers,
        currentUsage: subscription.currentUsage,
        remaining: subscription.maxMembers - subscription.currentUsage,
      },
    };
  }

  async getSubscriptionUsage(organizationId, currentUserId) {
    await requireMembership(currentUserId, organizationId);
    
    const [subscription, counts] = await Promise.all([
      subRepo.getOrCreate(organizationId),
      subRepo.getUsageCounts(organizationId),
    ]);

    const memberUsagePercentage = subscription.maxMembers > 0
      ? Math.round((counts.activeMembersCount / subscription.maxMembers) * 100)
      : 0;

    return {
      subscription,
      usage: {
        members: {
          current: counts.activeMembersCount,
          max: subscription.maxMembers,
          percentage: memberUsagePercentage,
          status: memberUsagePercentage >= 90 ? "HIGH" : memberUsagePercentage >= 75 ? "MEDIUM" : "LOW",
        },
        plans: { current: counts.activePlansCount },
      },
      recommendations: getUsageRecommendations(memberUsagePercentage),
    };
  }

  async changePlan(organizationId, currentUserId, newPlanName) {
    const adminMembership = await requireAdminMembership(currentUserId, organizationId);
    const current = await subRepo.getOrCreate(organizationId);

    const target = AVAILABLE_PLANS.find(p => p.name === newPlanName);
    if (!target) throw new BadRequestError("Plan invalide ou non disponible");

    validatePlanChange(current, target);

    const maxMembers = typeof target.features.maxMembers === "number" ? target.features.maxMembers : 1000;
    const endDate = calculateEndDate(newPlanName);

    const updated = await subRepo.changePlanWithAudit(
      organizationId,
      { plan: newPlanName, maxMembers, price: target.price, endDate },
      { userId: currentUserId, membershipId: adminMembership.id },
      current
    );

    return { 
      success: true, 
      subscription: updated, 
      previousPlan: current.plan, 
      nextBillingDate: updated.endDate 
    };
  }

  async getAvailablePlans() {
    return AVAILABLE_PLANS;
  }
}