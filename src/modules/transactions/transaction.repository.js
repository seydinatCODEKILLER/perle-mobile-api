import { prisma } from "../../config/database.js";
import { BaseRepository } from "../../shared/base/base.repository.js";

export class TransactionRepository extends BaseRepository {
  constructor() {
    super(prisma.transaction);
  }

  async findWithFilters(organizationId, whereClause, skip, take) {
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { organizationId, ...whereClause },
        skip,
        take,
        orderBy: { createdAt: "desc" },
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
                  avatar: true,
                  gender: true,
                },
              },
            },
          },
          // ✅ CORRIGÉ : wallet est une relation directe de Transaction, PAS de Membership
          wallet: {
            select: {
              id: true,
              currency: true,
              currentBalance: true,
            },
          },
        },
      }),
      prisma.transaction.count({ where: { organizationId, ...whereClause } }),
    ]);
    return { transactions, total };
  }

  async findByIdWithDetails(transactionId, organizationId) {
    return prisma.transaction.findUnique({
      where: { id: transactionId, organizationId },
      include: {
        membership: {
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
        },
        // ✅ CORRIGÉ ici aussi
        wallet: {
          select: {
            id: true,
            currency: true,
            currentBalance: true,
          },
        },
      },
    });
  }

  async search(organizationId, searchTerm) {
    return prisma.transaction.findMany({
      where: {
        organizationId,
        OR: [
          { reference: { contains: searchTerm, mode: "insensitive" } },
          { description: { contains: searchTerm, mode: "insensitive" } },
          {
            membership: {
              user: {
                OR: [
                  { prenom: { contains: searchTerm, mode: "insensitive" } },
                  { nom: { contains: searchTerm, mode: "insensitive" } },
                  { phone: { contains: searchTerm, mode: "insensitive" } },
                ],
              },
            },
          },
        ],
      },
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
              },
            },
          },
        },
        // ✅ CORRIGÉ ici aussi
        wallet: { select: { id: true, currentBalance: true, currency: true } },
      },
      take: 50,
      orderBy: { createdAt: "desc" },
    });
  }

  async findMemberTransactions(
    organizationId,
    extraWhere,
    whereClause,
    skip,
    take,
  ) {
    const [transactions, total, totals] = await Promise.all([
      prisma.transaction.findMany({
        where: { organizationId, ...extraWhere, ...whereClause },
        include: {
          organization: { select: { id: true, name: true, currency: true } },
          wallet: {
            select: { id: true, currentBalance: true, currency: true },
          },
        },
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
      prisma.transaction.count({
        where: { organizationId, ...extraWhere, ...whereClause },
      }),
      prisma.transaction.aggregate({
        where: { organizationId, ...extraWhere, ...whereClause },
        _sum: { amount: true },
      }),
    ]);
    return { transactions, total, totals };
  }

  async getWallet(organizationId) {
    return prisma.organizationWallet.findUnique({ where: { organizationId } });
  }

  async aggregateByType(organizationId, whereClause) {
    return prisma.transaction.groupBy({
      by: ["type"],
      where: { organizationId, ...whereClause },
      _sum: { amount: true },
      _count: { id: true },
    });
  }

  async calculateActuals(organizationId) {
    const [income, expenses] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          organizationId,
          paymentStatus: "COMPLETED",
          type: { in: ["CONTRIBUTION", "DEBT_REPAYMENT", "DONATION", "OTHER"] },
        },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: { organizationId, status: { in: ["APPROVED", "PAID"] } },
        _sum: { amount: true },
      }),
    ]);
    return {
      income: income._sum.amount || 0,
      expenses: expenses._sum.amount || 0,
    };
  }

  // ✅ AJOUT : On le met ici pour respecter l'architecture
  async requireMembership(userId, organizationId, roles = []) {
    return prisma.membership.findFirst({
      where: {
        userId,
        organizationId,
        status: "ACTIVE",
        ...(roles.length && { role: { in: roles } }),
      },
    });
  }
}
