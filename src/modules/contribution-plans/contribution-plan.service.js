import { ContributionPlanRepository } from "./contribution-plan.repository.js";
import { prisma } from "../../config/database.js";
import {
  NotFoundError,
  ForbiddenError,
} from "../../shared/errors/AppError.js";

const planRepo = new ContributionPlanRepository();

// ─── Helpers ──────────────────────────────────────────────────
const safeFloat = (value) => {
  if (value === null || value === undefined) return null;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
};

const safeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
};

const getMemberDisplayInfo = (membership) => {
  if (!membership) return null;
  if (membership.userId && membership.user) {
    return {
      firstName: membership.user.prenom,
      lastName: membership.user.nom,
      email: membership.user.email,
      phone: membership.user.phone,
      avatar: membership.user.avatar,
      gender: membership.user.gender,
      hasAccount: true,
      isProvisional: false,
    };
  }
  return {
    firstName: membership.provisionalFirstName,
    lastName: membership.provisionalLastName,
    email: membership.provisionalEmail,
    phone: membership.provisionalPhone,
    avatar: membership.provisionalAvatar,
    gender: membership.provisionalGender,
    hasAccount: false,
    isProvisional: true,
  };
};

export class ContributionPlanService {

  // ─── Créer un plan ────────────────────────────────────────────
  async createPlan(organizationId, userId, data) {
    const membership = await planRepo.requireMembership(
      userId, organizationId, ["ADMIN", "FINANCIAL_MANAGER"]
    );
    if (!membership) throw new ForbiddenError("Accès non autorisé");

    const createData = {
      name: data.name,
      description: data.description || null,
      frequency: data.frequency,
      differentiateByGender: data.differentiateByGender || false,
      isActive: data.isActive ?? true,
      startDate: safeDate(data.startDate) || new Date(),
      endDate: safeDate(data.endDate),
      currency: data.currency || "XOF",
      organizationId,
      // ✅ Montants nettoyés selon le mode
      amount: data.differentiateByGender ? null : safeFloat(data.amount),
      amountMale: data.differentiateByGender ? safeFloat(data.amountMale) : null,
      amountFemale: data.differentiateByGender ? safeFloat(data.amountFemale) : null,
    };

    const plan = await prisma.contributionPlan.create({ data: createData });

    await prisma.auditLog.create({
      data: {
        action: "CREATE_CONTRIBUTION_PLAN",
        resource: "contribution_plan",
        resourceId: plan.id,
        userId,
        organizationId,
        membershipId: membership.id,
        details: {
          name: plan.name,
          frequency: plan.frequency,
          differentiateByGender: plan.differentiateByGender,
        },
      },
    });

    return plan;
  }

  // ─── Obtenir un plan par ID ───────────────────────────────────
  async getPlanById(organizationId, planId, userId) {
    const membership = await planRepo.requireMembership(userId, organizationId);
    if (!membership) throw new ForbiddenError("Accès non autorisé");

    const plan = await planRepo.findByIdWithDetails(planId, organizationId);
    if (!plan) throw new NotFoundError("Plan de cotisation");

    // ✅ Enrichir les contributions avec displayInfo
    const enrichedContributions = plan.contributions.map((contribution) => ({
      ...contribution,
      membership: {
        ...contribution.membership,
        displayInfo: getMemberDisplayInfo(contribution.membership),
      },
    }));

    return { ...plan, contributions: enrichedContributions };
  }

  // ─── Lister les plans d'une organisation ──────────────────────
  async getOrganizationPlans(organizationId, userId, filters) {
    const membership = await planRepo.requireMembership(userId, organizationId);
    if (!membership) throw new ForbiddenError("Accès non autorisé");

    const { plans, total } = await planRepo.findWithFilters(
      organizationId,
      filters
    );

    return {
      plans,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        pages: Math.ceil(total / filters.limit),
      },
    };
  }

  // ─── Mettre à jour un plan ────────────────────────────────────
  async updatePlan(organizationId, planId, userId, data) {
    const membership = await planRepo.requireMembership(
      userId, organizationId, ["ADMIN", "FINANCIAL_MANAGER"]
    );
    if (!membership) throw new ForbiddenError("Accès non autorisé");

    const plan = await prisma.contributionPlan.findFirst({
      where: { id: planId, organizationId },
    });
    if (!plan) throw new NotFoundError("Plan de cotisation");

    const updatePayload = {};

    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.frequency !== undefined) updatePayload.frequency = data.frequency;
    if (data.isActive !== undefined) updatePayload.isActive = data.isActive;
    if (data.currency !== undefined) updatePayload.currency = data.currency;
    if (data.startDate !== undefined) updatePayload.startDate = safeDate(data.startDate);
    if (data.endDate !== undefined) updatePayload.endDate = safeDate(data.endDate);

    // ✅ Gestion des montants selon le mode
    const willDifferentiate = data.differentiateByGender ?? plan.differentiateByGender;

    if (data.differentiateByGender !== undefined) {
      updatePayload.differentiateByGender = data.differentiateByGender;

      if (data.differentiateByGender) {
        updatePayload.amountMale = safeFloat(data.amountMale);
        updatePayload.amountFemale = safeFloat(data.amountFemale);
        updatePayload.amount = null;
      } else {
        updatePayload.amount = safeFloat(data.amount);
        updatePayload.amountMale = null;
        updatePayload.amountFemale = null;
      }
    } else {
      // Garder le mode actuel
      if (willDifferentiate) {
        if (data.amountMale !== undefined) updatePayload.amountMale = safeFloat(data.amountMale);
        if (data.amountFemale !== undefined) updatePayload.amountFemale = safeFloat(data.amountFemale);
      } else {
        if (data.amount !== undefined) updatePayload.amount = safeFloat(data.amount);
      }
    }

    const updated = await prisma.contributionPlan.update({
      where: { id: planId },
      data: updatePayload,
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE_CONTRIBUTION_PLAN",
        resource: "contribution_plan",
        resourceId: planId,
        userId,
        organizationId,
        membershipId: membership.id,
        details: { updatedFields: Object.keys(updatePayload) },
      },
    });

    return updated;
  }

  // ─── Toggle statut ────────────────────────────────────────────
  async toggleStatus(organizationId, planId, userId) {
    const membership = await planRepo.requireMembership(
      userId, organizationId, ["ADMIN", "FINANCIAL_MANAGER"]
    );
    if (!membership) throw new ForbiddenError("Accès non autorisé");

    const plan = await prisma.contributionPlan.findFirst({
      where: { id: planId, organizationId },
    });
    if (!plan) throw new NotFoundError("Plan de cotisation");

    const updated = await prisma.contributionPlan.update({
      where: { id: planId },
      data: { isActive: !plan.isActive },
    });

    await prisma.auditLog.create({
      data: {
        action: updated.isActive ? "ACTIVATE_PLAN" : "DEACTIVATE_PLAN",
        resource: "contribution_plan",
        resourceId: planId,
        userId,
        organizationId,
        membershipId: membership.id,
        details: { isActive: updated.isActive },
      },
    });

    return updated;
  }
}