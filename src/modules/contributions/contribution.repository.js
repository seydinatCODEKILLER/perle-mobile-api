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

  async findMemberContributions(organizationId, membershipId, whereClause, skip, take) {
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
}