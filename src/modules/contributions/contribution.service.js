import { ContributionRepository } from "./contribution.repository.js";
import { prisma } from "../../config/database.js";
import {
  ForbiddenError,
  NotFoundError,
  ConflictError,
  BadRequestError,
} from "../../shared/errors/AppError.js";

const contribRepo = new ContributionRepository();

export class ContributionService {
  // ─── Helpers privés ───────────────────────────────────────────
  async #checkAccess(userId, organizationId, roles = []) {
    const membership = await contribRepo.findActiveMembership(
      userId,
      organizationId,
      roles,
    );
    if (!membership)
      throw new ForbiddenError("Accès non autorisé à cette organisation");
    return membership;
  }

  async #getContributionOrFail(contributionId, organizationId, include = {}) {
    const contribution = await contribRepo.findById(contributionId, include);
    if (!contribution || contribution.organizationId !== organizationId) {
      throw new NotFoundError("Cotisation non trouvée dans cette organisation");
    }
    return contribution;
  }

  #remaining(contribution) {
    return contribution.amount - contribution.amountPaid;
  }

  #getMemberDisplayInfo(membership) {
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
  }

  async #sendPaymentNotification(contribution, amount) {
    try {
      await contribRepo.createNotification({
        organizationId: contribution.organizationId,
        membershipId: contribution.membershipId,
        type: "PAYMENT_CONFIRMATION",
        title: "Paiement confirmé",
        message: `Paiement de ${amount} XOF pour "${contribution.contributionPlan.name}"`,
        priority: "MEDIUM",
        channels: ["IN_APP"],
        status: "PENDING",
      });
    } catch (error) {
      console.error("Notification error:", error);
    }
  }

  async #sendCancellationNotification(contribution) {
    try {
      await contribRepo.createNotification({
        organizationId: contribution.organizationId,
        membershipId: contribution.membershipId,
        type: "SYSTEM_ALERT",
        title: "Cotisation annulée",
        message: `Votre cotisation "${contribution.contributionPlan.name}" d'un montant de ${contribution.amount.toLocaleString("fr-FR")} XOF a été annulée.`,
        priority: "HIGH",
        channels: ["IN_APP"],
        status: "PENDING",
      });
    } catch (error) {
      console.error("Erreur notification annulation:", error);
    }
  }

  // ─── Lectures ─────────────────────────────────────────────────
  async getContributions(organizationId, currentUserId, filters) {
    await this.#checkAccess(currentUserId, organizationId);

    const {
      status,
      membershipId,
      contributionPlanId,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = filters;
    const skip = (page - 1) * limit;

    const where = {
      organizationId,
      ...(status && { status }),
      ...(membershipId && { membershipId }),
      ...(contributionPlanId && { contributionPlanId }),
      ...(startDate || endDate
        ? {
            dueDate: {
              ...(startDate && { gte: new Date(startDate) }),
              ...(endDate && { lte: new Date(endDate) }),
            },
          }
        : {}),
    };

    const { contributions, total } = await contribRepo.findWithDetails(
      where,
      skip,
      limit,
    );

    const enrichedData = contributions.map((c) => ({
      ...c,
      membership: {
        ...c.membership,
        displayInfo: this.#getMemberDisplayInfo(c.membership),
      },
      remainingAmount: this.#remaining(c),
    }));

    return {
      contributions: enrichedData,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async getContributionById(organizationId, contributionId, currentUserId) {
    await this.#checkAccess(currentUserId, organizationId);

    const contribution = await contribRepo.findByIdWithDetails(
      contributionId,
      organizationId,
    );
    if (!contribution) throw new NotFoundError("Cotisation");

    return {
      ...contribution,
      membership: {
        ...contribution.membership,
        displayInfo: this.#getMemberDisplayInfo(contribution.membership),
      },
      remainingAmount: this.#remaining(contribution),
    };
  }

  async getMemberContributions(
    organizationId,
    membershipId,
    currentUserId,
    filters,
  ) {
    const currentMembership = await this.#checkAccess(
      currentUserId,
      organizationId,
    );

    if (
      currentMembership.role !== "ADMIN" &&
      currentMembership.id !== membershipId
    ) {
      throw new ForbiddenError(
        "Permissions insuffisantes pour voir les cotisations de ce membre",
      );
    }

    const { status, page = 1, limit = 10 } = filters;
    const whereClause = { ...(status && { status }) };

    const [data, totals] = await Promise.all([
      contribRepo.findMemberContributions(
        organizationId,
        membershipId,
        whereClause,
        (page - 1) * limit,
        limit,
      ),
      contribRepo.aggregateMemberTotals(
        organizationId,
        membershipId,
        whereClause,
      ),
    ]);

    return {
      contributions: data.contributions.map((c) => ({
        ...c,
        remainingAmount: c.amount - c.amountPaid,
      })),
      totals: {
        totalAmount: totals._sum.amount || 0,
        totalPaid: totals._sum.amountPaid || 0,
        totalRemaining:
          (totals._sum.amount || 0) - (totals._sum.amountPaid || 0),
      },
      pagination: {
        page,
        limit,
        total: data.total,
        pages: Math.ceil(data.total / limit),
      },
    };
  }

  async getMyContributions(organizationId, currentUserId, filters) {
    const membership = await this.#checkAccess(currentUserId, organizationId);

    const { status, page = 1, limit = 10 } = filters;
    const where = {
      organizationId,
      membershipId: membership.id,
      ...(status && { status }),
    };
    const skip = (page - 1) * limit;

    const [{ contributions, total }, totals] = await Promise.all([
      contribRepo.findMyContributions(where, skip, limit),
      contribRepo.aggregateTotals(where),
    ]);

    return {
      contributions: contributions.map((c) => ({
        ...c,
        remainingAmount: c.amount - c.amountPaid,
      })),
      totals: {
        totalAmount: totals._sum.amount || 0,
        totalPaid: totals._sum.amountPaid || 0,
        totalRemaining:
          (totals._sum.amount || 0) - (totals._sum.amountPaid || 0),
      },
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  // ─── Paiements ────────────────────────────────────────────────
  async markAsPaid(organizationId, contributionId, currentUserId, paymentData) {
    const currentMembership = await this.#checkAccess(
      currentUserId,
      organizationId,
      ["ADMIN", "FINANCIAL_MANAGER"],
    );
    const contribution = await this.#getContributionOrFail(
      contributionId,
      organizationId,
      { contributionPlan: true },
    );

    if (contribution.status === "PAID")
      throw new ConflictError("Cette cotisation est déjà payée");

    const remaining = this.#remaining(contribution);
    if (paymentData.amountPaid !== remaining)
      throw new BadRequestError(`Le montant exact requis est ${remaining}`);

    const result = await prisma.$transaction(async (tx) => {
      const wallet = await contribRepo.findWallet(tx, organizationId);
      if (!wallet)
        throw new NotFoundError("Wallet non trouvé pour cette organisation");

      const updatedContribution = await contribRepo.updateContributionInTx(
        tx,
        contributionId,
        {
          amountPaid: contribution.amount,
          status: "PAID",
          paymentDate: new Date(),
          paymentMethod: paymentData.paymentMethod,
        },
      );

      const transaction = await contribRepo.createTransactionInTx(tx, {
        organizationId,
        membershipId: contribution.membershipId,
        walletId: wallet.id,
        type: "CONTRIBUTION",
        amount: paymentData.amountPaid,
        currency: wallet.currency,
        paymentMethod: paymentData.paymentMethod,
        paymentStatus: "COMPLETED",
        reference: `CONT-${Date.now()}-${contributionId.slice(-6)}`,
        metadata: { contributionId },
      });

      await contribRepo.linkTransaction(tx, contributionId, transaction.id);
      await contribRepo.updateWalletInTx(tx, wallet.id, {
        currentBalance: { increment: paymentData.amountPaid },
        totalIncome: { increment: paymentData.amountPaid },
      });

      return updatedContribution;
    });

    await contribRepo.createAuditLog({
      action: "MARK_CONTRIBUTION_PAID",
      resource: "contribution",
      resourceId: contributionId,
      userId: currentUserId,
      organizationId,
      membershipId: currentMembership.id,
      financialImpact: paymentData.amountPaid,
      details: {
        amount: paymentData.amountPaid,
        contributionPlanName: contribution.contributionPlan.name,
      },
    });

    await this.#sendPaymentNotification(contribution, paymentData.amountPaid);
    return result;
  }

  async addPartialPayment(
    organizationId,
    contributionId,
    currentUserId,
    paymentData,
  ) {
    const currentMembership = await this.#checkAccess(
      currentUserId,
      organizationId,
      ["ADMIN", "FINANCIAL_MANAGER"],
    );
    const contribution = await this.#getContributionOrFail(
      contributionId,
      organizationId,
      { organization: { include: { settings: true } }, contributionPlan: true },
    );

    if (!contribution.organization.settings.allowPartialPayments)
      throw new ForbiddenError("Paiements partiels non autorisés");
    if (
      paymentData.amount <= 0 ||
      paymentData.amount > this.#remaining(contribution)
    )
      throw new BadRequestError("Montant invalide");

    const result = await prisma.$transaction(async (tx) => {
      const wallet = await contribRepo.findWallet(tx, organizationId);
      if (!wallet)
        throw new NotFoundError("Wallet non trouvé pour cette organisation");

      await contribRepo.createPartialPaymentInTx(tx, {
        contributionId,
        amount: paymentData.amount,
        paymentMethod: paymentData.paymentMethod,
        paymentDate: new Date(),
      });

      const newAmountPaid = contribution.amountPaid + paymentData.amount;
      const newStatus =
        newAmountPaid >= contribution.amount ? "PAID" : "PARTIAL";

      const updatedContribution = await contribRepo.updateContributionInTx(
        tx,
        contributionId,
        {
          amountPaid: newAmountPaid,
          status: newStatus,
          ...(newStatus === "PAID" && { paymentDate: new Date() }),
        },
      );

      await contribRepo.createTransactionInTx(tx, {
        organizationId,
        membershipId: contribution.membershipId,
        walletId: wallet.id,
        type: "CONTRIBUTION",
        amount: paymentData.amount,
        currency: wallet.currency,
        paymentMethod: paymentData.paymentMethod,
        paymentStatus: "COMPLETED",
        reference: `PARTIAL-${Date.now()}-${contributionId.slice(-6)}`,
        description: `Paiement partiel pour ${contribution.contributionPlan.name}`,
        metadata: { contributionId, isPartialPayment: true },
      });

      await contribRepo.updateWalletInTx(tx, wallet.id, {
        currentBalance: { increment: paymentData.amount },
        totalIncome: { increment: paymentData.amount },
      });

      return updatedContribution;
    });

    await contribRepo.createAuditLog({
      action: "ADD_PARTIAL_PAYMENT",
      resource: "contribution",
      resourceId: contributionId,
      userId: currentUserId,
      organizationId,
      membershipId: currentMembership.id,
      financialImpact: paymentData.amount,
      details: {
        amount: paymentData.amount,
        newTotalPaid: result.amountPaid,
        contributionPlanName: contribution.contributionPlan.name,
      },
    });

    return result;
  }

  // ─── Annulation ───────────────────────────────────────────────
  async cancelContribution(
    organizationId,
    contributionId,
    currentUserId,
    reason = "",
  ) {
    const currentMembership = await this.#checkAccess(
      currentUserId,
      organizationId,
      ["ADMIN"],
    );
    const contribution = await this.#getContributionOrFail(
      contributionId,
      organizationId,
      { contributionPlan: true },
    );

    if (contribution.status === "CANCELLED")
      throw new ConflictError("Cotisation déjà annulée");

    // 👇 On stocke le résultat au lieu de return directement
    const cancelledContribution = await prisma.$transaction(async (tx) => {
      if (contribution.amountPaid > 0) {
        const wallet = await contribRepo.findWallet(tx, organizationId);
        if (wallet) {
          await contribRepo.updateWalletInTx(tx, wallet.id, {
            currentBalance: { decrement: contribution.amountPaid },
            totalIncome: { decrement: contribution.amountPaid },
          });
        }
      }

      const cancelledContribution = await contribRepo.updateContributionInTx(
        tx,
        contributionId,
        { status: "CANCELLED" },
      );

      await contribRepo.createAuditLogInTx(tx, {
        action: "CANCEL_CONTRIBUTION",
        resource: "contribution",
        resourceId: contributionId,
        userId: currentUserId,
        organizationId,
        membershipId: currentMembership.id,
        financialImpact: -contribution.amountPaid,
        details: {
          reason,
          amountPaid: contribution.amountPaid,
          walletAdjusted: contribution.amountPaid > 0,
        },
      });

      return cancelledContribution;
    });

    // 👇 Notification après la transaction (non bloquante)
    await this.#sendCancellationNotification(contribution);

    return cancelledContribution;
  }

  async getPlanMembersStatus(organizationId, planId, currentUserId) {
    await this.#checkAccess(currentUserId, organizationId, [
      "ADMIN",
      "FINANCIAL_MANAGER",
    ]);
    return contribRepo.getPlanMembersStatus(organizationId, planId);
  }
}
