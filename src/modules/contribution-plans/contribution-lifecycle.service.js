import { ContributionPlanRepository } from "./contribution-plan.repository.js";
import { prisma } from "../../config/database.js";
import { pushTokenService } from "../push-tokens/push-token.service.js";
import {
  ForbiddenError,
  NotFoundError,
  ConflictError,
  BadRequestError,
} from "../../shared/errors/AppError.js";

const planRepo = new ContributionPlanRepository();

// ─── Pure Helpers ─────────────────────────────────────────────
const getMonthRange = (date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { gte: start, lt: end, from: start, to: end };
};

const calculateDueDate = (frequency, offsetDays = 0) => {
  const d = new Date();
  const map = {
    WEEKLY: () => d.setDate(d.getDate() + 7),
    MONTHLY: () => d.setMonth(d.getMonth() + 1),
    QUARTERLY: () => d.setMonth(d.getMonth() + 3),
    YEARLY: () => d.setFullYear(d.getFullYear() + 1),
  };
  (map[frequency] || (() => d.setDate(d.getDate() + 30)))();
  d.setDate(d.getDate() + offsetDays);
  return d;
};

const resolveAmount = (plan, membership) => {
  const gender = membership.user?.gender || membership.provisionalGender;
  if (plan.differentiateByGender) {
    if (gender === "MALE" && plan.amountMale != null) return plan.amountMale;
    if (gender === "FEMALE" && plan.amountFemale != null)
      return plan.amountFemale;
  }
  if (plan.amount != null) return plan.amount;
  throw new BadRequestError("Aucun montant défini pour ce membre");
};

const checkAccess = async (userId, organizationId, roles = []) => {
  const membership = await planRepo.requireMembership(
    userId,
    organizationId,
    roles,
  );
  if (!membership) throw new ForbiddenError("Accès non autorisé");
  return membership;
};

const formatAmount = (amount, currency = "XOF") =>
  `${amount.toLocaleString("fr-FR")} ${currency}`;

const formatDate = (date) =>
  new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

// ─── Service ──────────────────────────────────────────────────

export class ContributionLifecycleService {
  
  async generateForPlan(organizationId, planId, userId, options = {}) {
    const { force = false, dueDateOffset = 0 } = options;
    const admin = await checkAccess(userId, organizationId, [
      "ADMIN",
      "FINANCIAL_MANAGER",
    ]);

    const plan = await planRepo.findActivePlan(planId, organizationId);
    if (!plan) throw new NotFoundError("Plan invalide ou inactif");

    const dueDate = calculateDueDate(plan.frequency, dueDateOffset);
    const period = getMonthRange(dueDate);
    const dueDateRange = { gte: period.gte, lt: period.lt };

    const existingCount = await planRepo.countContributionsForPeriod(
      planId,
      organizationId,
      dueDateRange,
    );
    if (existingCount > 0 && !force) {
      throw new ConflictError("Cotisations déjà générées pour cette période");
    }

    const members = await planRepo.findActiveMembers(organizationId);
    if (members.length === 0)
      throw new NotFoundError("Aucun membre actif trouvé");

    const result = await prisma.$transaction(async (tx) => {
      if (force && existingCount > 0) {
        await planRepo.deleteManyContributions(
          tx,
          planId,
          organizationId,
          dueDateRange,
        );
      }

      const contributionsData = members.map((member) => ({
        membershipId: member.id,
        contributionPlanId: planId,
        organizationId,
        amount: resolveAmount(plan, member),
        dueDate,
        status: "PENDING",
      }));

      const created = await planRepo.createManyContributions(
        tx,
        contributionsData,
      );
      const provisionalCount = members.filter((m) => !m.userId).length;

      await planRepo.createAuditLogInTx(tx, {
        action: "GENERATE_CONTRIBUTIONS",
        resource: "contribution_plan",
        resourceId: planId,
        userId,
        organizationId,
        membershipId: admin.id,
        details: {
          generatedCount: created.count,
          periodFrom: period.from,
          periodTo: period.to,
          dueDate,
          force,
          totalMembers: members.length,
          provisionalMembers: provisionalCount,
          withAccount: members.length - provisionalCount,
        },
      });

      return {
        generated: created.count,
        dueDate,
        period,
        members,
        stats: {
          total: members.length,
          provisional: provisionalCount,
          withAccount: members.length - provisionalCount,
        },
      };
    });

    const membersWithAccount = result.members.filter((m) => m.userId);
    if (membersWithAccount.length > 0) {
      const userIds = membersWithAccount.map((m) => m.userId);

      pushTokenService
        .sendToUsers(userIds, {
          title: "Nouvelle cotisation",
          body: `Une nouvelle cotisation "${plan.name}" a été générée. Échéance : ${formatDate(result.dueDate)}.`,
          data: {
            type: "CONTRIBUTION_GENERATED",
            planId,
            organizationId,
            dueDate: result.dueDate.toISOString(),
          },
        })
        .catch((err) =>
          console.error("[PUSH] Erreur génération cotisations:", err.message),
        );
    }

    const { members: _, ...finalResult } = result;
    return finalResult;
  }

  async assignPlanToMember(organizationId, planId, membershipId, userId) {
    const admin = await checkAccess(userId, organizationId, [
      "ADMIN",
      "FINANCIAL_MANAGER",
    ]);

    const member = await planRepo.findMemberForAssignment(membershipId);
    if (!member || member.organizationId !== organizationId)
      throw new NotFoundError("Membre non trouvé");

    const plan = await planRepo.findActivePlan(planId, organizationId);
    if (!plan) throw new NotFoundError("Plan invalide ou inactif");

    const dueDate = calculateDueDate(plan.frequency);
    const period = getMonthRange(dueDate);
    const dueDateRange = { gte: period.gte, lt: period.lt };

    const exists = await planRepo.findExistingContributionForPeriod(
      membershipId,
      planId,
      organizationId,
      dueDateRange,
    );
    if (exists)
      throw new ConflictError(
        "Cotisation déjà existante pour ce membre sur cette période",
      );

    const contribution = await planRepo.createContribution({
      membershipId,
      contributionPlanId: planId,
      organizationId,
      amount: resolveAmount(plan, member),
      dueDate,
      status: "PENDING",
    });

    await planRepo.createAuditLog({
      action: "ASSIGN_CONTRIBUTION",
      resource: "contribution",
      resourceId: contribution.id,
      userId,
      organizationId,
      membershipId: admin.id,
      details: {
        membershipId,
        planId,
        amount: contribution.amount,
        dueDate,
        isProvisional: !member.userId,
        memberName: member.userId
          ? `${member.user?.prenom} ${member.user?.nom}`
          : `${member.provisionalFirstName} ${member.provisionalLastName}`,
      },
    });

    // Notification push si le membre a un compte (non bloquant)
    if (member.userId) {
      pushTokenService
        .sendToUser(member.userId, {
          title: "Nouvelle cotisation assignée",
          body: `Une cotisation "${plan.name}" de ${formatAmount(contribution.amount)} vous a été assignée. Échéance : ${formatDate(dueDate)}.`,
          data: {
            type: "CONTRIBUTION_ASSIGNED",
            contributionId: contribution.id,
            planId,
            organizationId,
            dueDate: dueDate.toISOString(),
          },
        })
        .catch((err) =>
          console.error("[PUSH] Erreur assignation cotisation:", err.message),
        );
    }

    return contribution;
  }

  async updateContributionStatus(
    organizationId,
    contributionId,
    userId,
    status,
  ) {
    const admin = await checkAccess(userId, organizationId, [
      "ADMIN",
      "FINANCIAL_MANAGER",
    ]);

    const allowedStatuses = [
      "PENDING",
      "PARTIAL",
      "PAID",
      "OVERDUE",
      "CANCELLED",
    ];
    if (!allowedStatuses.includes(status))
      throw new BadRequestError("Statut invalide");

    const contribution =
      await planRepo.findContributionWithMember(contributionId);
    if (!contribution || contribution.organizationId !== organizationId)
      throw new NotFoundError("Cotisation non trouvée");

    const updated = await planRepo.updateContributionStatus(
      contributionId,
      status,
    );

    await planRepo.createAuditLog({
      action: "UPDATE_CONTRIBUTION_STATUS",
      resource: "contribution",
      resourceId: contributionId,
      userId,
      organizationId,
      membershipId: admin.id,
      details: {
        oldStatus: contribution.status,
        newStatus: status,
        isProvisional: !contribution.membership.userId,
      },
    });

    return updated;
  }
}
