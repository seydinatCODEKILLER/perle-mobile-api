import { prisma } from "../../config/database.js";
import { BaseRepository } from "../../shared/base/base.repository.js";

// ✅ Constante renommée pour cohérence avec le modèle Prisma (Membership, pas Member)
const MEMBERSHIP_CONTACT_INCLUDE = {
  include: {
    user: {
      select: {
        prenom: true,
        nom: true,
        phone: true,
        email: true,
      },
    },
  },
};

export class NotificationRepository extends BaseRepository {
  constructor() {
    super(prisma.notification);
  }

  // ─── Écritures ───────────────────────────────────────────────────────

  async createOne({
    organizationId,
    membershipId,
    type,
    title,
    message,
    priority,
    channels,
  }) {
    return prisma.notification.create({
      data: {
        organizationId,
        membershipId: membershipId || null,
        type,
        title,
        message,
        priority,
        channels,
        status: "PENDING",
      },
    });
  }

  async createMany(notifications) {
    return prisma.notification.createMany({ data: notifications });
  }

  // ─── Lectures ───────────────────────────────────────────────────────────

  async listForMembership(
    organizationId,
    membershipId,
    { page, limit, type, status },
  ) {
    const skip = (page - 1) * limit;
    const where = { organizationId, membershipId };

    if (type) where.type = type;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.notification.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async countUnread(organizationId, membershipId) {
    return prisma.notification.count({
      where: {
        organizationId,
        membershipId,
        status: { in: ["PENDING", "SENT"] }, // ✅ Statuts cohérents avec l'enum
      },
    });
  }

  async findByIdForMembership(id, organizationId, membershipId) {
    if (!BaseRepository.isValidId(id)) return null;
    return prisma.notification.findFirst({
      where: { id, organizationId, membershipId },
    });
  }

  async markAsRead(id) {
    // ✅ Ne pas mettre à jour sentAt lors d'un "lu"
    return prisma.notification.update({
      where: { id },
      data: { status: "DELIVERED" },
    });
  }

  async markAllAsRead(organizationId, membershipId) {
    // ✅ Corrigé: PERSISTENT n'existe pas dans l'enum
    return prisma.notification.updateMany({
      where: {
        organizationId,
        membershipId,
        status: { in: ["PENDING", "SENT"] }, // ✅ Statuts valides uniquement
      },
      data: { status: "DELIVERED" }, // ✅ Pas de sentAt
    });
  }

  async updateStatus(id, status) {
    // ✅ sentAt uniquement quand la notification est effectivement envoyée
    const data = { status };
    if (status === "SENT") {
      data.sentAt = new Date();
    }

    return prisma.notification.update({
      where: { id },
      data,
    });
  }

  // ─── Données pour le Service (Requêtes spécifiques au domaine métier) ────

  async getSettings(organizationId) {
    return prisma.organizationSettings.findUnique({
      where: { organizationId },
      select: {
        autoReminders: true,
        reminderDays: true,
        emailNotifications: true,
        smsNotifications: true,
        whatsappNotifications: true,
      },
    });
  }

  async findAdminMembership(organizationId, userId) {
    return prisma.membership.findFirst({
      where: {
        userId,
        organizationId,
        status: "ACTIVE",
        role: { in: ["ADMIN", "FINANCIAL_MANAGER", "SUPER_ADMIN"] },
      },
    });
  }

  async findActiveMembership(organizationId, userId) {
    return prisma.membership.findFirst({
      where: { userId, organizationId, status: "ACTIVE" },
      select: { id: true, role: true },
    });
  }

  // ✅ AJOUT: Méthode manquante pour récupérer un membership par ID
  async findMembershipById(membershipId) {
    return prisma.membership.findFirst({
      where: { id: membershipId },
      ...MEMBERSHIP_CONTACT_INCLUDE,
    });
  }

  // ✅ AJOUT: Méthode manquante pour récupérer un membership avec son organisation
  async findMembershipWithOrg(membershipId) {
    return prisma.membership.findFirst({
      where: { id: membershipId },
      include: {
        user: {
          select: {
            prenom: true,
            nom: true,
            phone: true,
            email: true,
          },
        },
      },
    });
  }

  // ─── Données pour le Cron (Requêtes groupées multi-tenant) ───────────

  async getActiveMemberships(organizationId) {
    return prisma.membership.findMany({
      where: { organizationId, status: "ACTIVE" },
      ...MEMBERSHIP_CONTACT_INCLUDE, // ✅ Corrigé: nom cohérent
    });
  }

  async getUpcomingContributions(organizationId, daysAhead) {
    const from = new Date();
    from.setDate(from.getDate() + daysAhead);
    from.setHours(0, 0, 0, 0);
    const target = new Date(from);
    target.setHours(23, 59, 59, 999);

    return prisma.contribution.findMany({
      where: {
        organizationId,
        status: { in: ["PENDING", "PARTIAL"] },
        dueDate: { gte: from, lte: target },
      },
      include: {
        membership: MEMBERSHIP_CONTACT_INCLUDE, // ✅ Corrigé
        contributionPlan: { select: { name: true } },
      },
    });
  }

  async getUpcomingDebts(organizationId, daysAhead) {
    const from = new Date();
    from.setDate(from.getDate() + daysAhead);
    from.setHours(0, 0, 0, 0);
    const target = new Date(from);
    target.setHours(23, 59, 59, 999);

    return prisma.debt.findMany({
      where: {
        organizationId,
        status: { in: ["ACTIVE", "PARTIALLY_PAID"] },
        dueDate: { gte: from, lte: target },
      },
      include: {
        membership: MEMBERSHIP_CONTACT_INCLUDE, // ✅ Corrigé
      },
    });
  }

  async getActiveOrganizationsWithSettings() {
    return prisma.organization.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        settings: {
          select: {
            autoReminders: true,
            reminderDays: true,
            emailNotifications: true,
            smsNotifications: true,
            whatsappNotifications: true,
          },
        },
      },
    });
  }

  // ─── Anti-Doublon ─────────────────────────────────────────────────────
  async hasRecentReminder(organizationId, membershipId, type, relatedId) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const count = await prisma.notification.count({
      where: {
        organizationId,
        membershipId,
        type,
        relatedId,
        createdAt: { gte: oneDayAgo },
      },
    });
    return count > 0;
  }

  // ─── Données pour les Événements ─────────────────────────────
  async getEventInvitees(eventId) {
    const invitees = await prisma.eventAttendee.findMany({
      where: { eventId, status: "INVITED" },
      select: { membershipId: true },
    });
    return invitees.map((i) => i.membershipId);
  }
}
