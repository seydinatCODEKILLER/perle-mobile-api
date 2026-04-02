import { prisma } from "../../config/database.js";
import { BaseRepository } from "../../shared/base/base.repository.js";

export class ContributionRepository extends BaseRepository {
  constructor() {
    super(prisma.contribution);
  }

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

  async aggregateMemberTotals(organizationId, membershipId, whereClause) {
    return prisma.contribution.aggregate({
      where: { organizationId, membershipId, ...whereClause },
      _sum: { amount: true, amountPaid: true },
    });
  }
}
