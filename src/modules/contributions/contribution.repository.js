import { prisma } from "../../config/database.js";
import { BaseRepository } from "../../shared/base/base.repository.js";

export class ContributionRepository extends BaseRepository {
  constructor() {
    super(prisma.contribution);
  }

  // ─── Membership ───────────────────────────────────────────────

  async findActiveMembership(userId, organizationId, roles = []) {
    return prisma.membership.findFirst({
      where: {
        userId,
        organizationId,
        status: "ACTIVE",
        ...(roles.length && { role: { in: roles } }),
      },
    });
  }

  // ─── Contribution Reads ───────────────────────────────────────

  async findWithDetails(whereClause, skip, take) {
    const [contributions, total] = await Promise.all([
      prisma.contribution.findMany({
        where: whereClause,
        skip,
        take,
        orderBy: { dueDate: "asc" },
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
                  gender: true,
                },
              },
            },
          },
          contributionPlan: true,
          partialPayments: { orderBy: { paymentDate: "desc" } },
          transaction: {
            include: {
              wallet: { select: { currentBalance: true, currency: true } },
            },
          },
        },
      }),
      prisma.contribution.count({ where: whereClause }),
    ]);

    return { contributions, total };
  }

  async findByIdWithDetails(contributionId, organizationId) {
    return prisma.contribution.findUnique({
      where: { id: contributionId },
      include: {
        membership: {
          include: {
            user: {
              select: {
                prenom: true,
                nom: true,
                email: true,
                phone: true,
                gender: true,
              },
            },
          },
        },
        contributionPlan: true,
        partialPayments: { orderBy: { paymentDate: "desc" } },
        transaction: {
          include: {
            wallet: { select: { currentBalance: true, currency: true } },
          },
        },
      },
    });
  }

  async findById(contributionId, include = {}) {
    return prisma.contribution.findUnique({
      where: { id: contributionId },
      include,
    });
  }

  async findMemberContributions(
    organizationId,
    membershipId,
    whereClause,
    skip,
    take,
  ) {
    const [contributions, total] = await Promise.all([
      prisma.contribution.findMany({
        where: { organizationId, membershipId, ...whereClause },
        include: {
          contributionPlan: {
            select: {
              id: true,
              name: true,
              amount: true,
              amountMale: true,
              amountFemale: true,
              differentiateByGender: true,
              frequency: true,
            },
          },
          partialPayments: { orderBy: { paymentDate: "desc" } },
        },
        skip,
        take,
        orderBy: { dueDate: "desc" },
      }),
      prisma.contribution.count({
        where: { organizationId, membershipId, ...whereClause },
      }),
    ]);

    return { contributions, total };
  }

  async findMyContributions(where, skip, take) {
    const [contributions, total] = await Promise.all([
      prisma.contribution.findMany({
        where,
        skip,
        take,
        orderBy: { dueDate: "desc" },
        include: {
          contributionPlan: {
            select: { id: true, name: true, amount: true, frequency: true },
          },
          membership: {
            include: {
              user: { select: { prenom: true, nom: true, avatar: true } },
            },
          },
        },
      }),
      prisma.contribution.count({ where }),
    ]);

    return { contributions, total };
  }

  async aggregateMemberTotals(organizationId, membershipId, whereClause) {
    return prisma.contribution.aggregate({
      where: { organizationId, membershipId, ...whereClause },
      _sum: { amount: true, amountPaid: true },
    });
  }

  async aggregateTotals(where) {
    return prisma.contribution.aggregate({
      where,
      _sum: { amount: true, amountPaid: true },
    });
  }

  // ─── Contribution Mutations ───────────────────────────────────

  async updateContribution(contributionId, data) {
    return prisma.contribution.update({
      where: { id: contributionId },
      data,
      include: { contributionPlan: true },
    });
  }

  async updateContributionInTx(tx, contributionId, data) {
    return tx.contribution.update({
      where: { id: contributionId },
      data,
      include: { contributionPlan: true },
    });
  }

  async linkTransaction(tx, contributionId, transactionId) {
    return tx.contribution.update({
      where: { id: contributionId },
      data: { transactionId },
    });
  }

  // ─── Wallet ───────────────────────────────────────────────────

  async findWallet(tx, organizationId) {
    return (tx || prisma).organizationWallet.findUnique({
      where: { organizationId },
    });
  }

  async updateWalletInTx(tx, walletId, data) {
    return tx.organizationWallet.update({
      where: { id: walletId },
      data,
    });
  }

  // ─── Transaction ──────────────────────────────────────────────

  async createTransactionInTx(tx, data) {
    return tx.transaction.create({ data });
  }

  // ─── Partial Payment ──────────────────────────────────────────

  async createPartialPaymentInTx(tx, data) {
    return tx.partialPayment.create({ data });
  }

  // ─── Notification ─────────────────────────────────────────────

  async createNotification(data) {
    return prisma.notification.create({ data });
  }

  // ─── Audit Log ────────────────────────────────────────────────

  async createAuditLog(data) {
    return prisma.auditLog.create({ data });
  }

  async createAuditLogInTx(tx, data) {
    return tx.auditLog.create({ data });
  }

  async getPlanMembersStatus(organizationId, planId) {
    // Tous les membres actifs de l'organisation
    const members = await prisma.membership.findMany({
      where: { organizationId, status: "ACTIVE" },
      include: {
        user: {
          select: {
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

    // Toutes les cotisations de ce plan
    const contributions = await prisma.contribution.findMany({
      where: { organizationId, contributionPlanId: planId },
      select: {
        id: true,
        membershipId: true,
        status: true,
        amount: true,
        amountPaid: true,
        dueDate: true,
      },
    });

    // Map membershipId -> contribution
    const contribByMember = new Map(
      contributions.map((c) => [c.membershipId, c]),
    );

    const paid = [];
    const unpaid = [];

    for (const member of members) {
      const contribution = contribByMember.get(member.id);
      const displayInfo =
        member.userId && member.user
          ? {
              firstName: member.user.prenom,
              lastName: member.user.nom,
              email: member.user.email,
              phone: member.user.phone,
              avatar: member.user.avatar,
              gender: member.user.gender,
              hasAccount: true,
              isProvisional: false,
            }
          : {
              firstName: member.provisionalFirstName,
              lastName: member.provisionalLastName,
              email: member.provisionalEmail,
              phone: member.provisionalPhone,
              avatar: member.provisionalAvatar,
              gender: member.provisionalGender,
              hasAccount: false,
              isProvisional: true,
            };

      const entry = {
        membershipId: member.id,
        memberNumber: member.memberNumber,
        displayInfo,
        contribution: contribution ?? null,
      };

      if (contribution && ["PAID", "PARTIAL"].includes(contribution.status)) {
        paid.push(entry);
      } else {
        unpaid.push(entry);
      }
    }

    return {
      planId,
      totalMembers: members.length,
      paidCount: paid.length,
      unpaidCount: unpaid.length,
      paid,
      unpaid,
    };
  }
}
