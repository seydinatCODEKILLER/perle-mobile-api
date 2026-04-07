import { prisma } from "../../config/database.js";
import { BaseRepository } from "../../shared/base/base.repository.js";

export class EventRepository extends BaseRepository {
  constructor() {
    super(prisma.event);
  }

  // ─── Permissions & Accès ──────────────────────────────────────
  async findActiveMembership(userId, organizationId) {
    return prisma.membership.findFirst({
      where: { userId, organizationId, status: "ACTIVE" },
      select: { id: true, role: true },
    });
  }

  async findAuthorizedMembership(userId, organizationId, roles) {
    return prisma.membership.findFirst({
      where: { userId, organizationId, status: "ACTIVE", role: { in: roles } },
      select: { id: true, role: true },
    });
  }

  // ─── Lecture Events ──────────────────────────────────────────
  async findEventsForUser(organizationId, currentMembershipId, filters) {
    const { status, type, page = 1, limit = 10 } = filters;
    const skip = (page - 1) * limit;

    const whereClause = {
      organizationId,
      OR: [
        { visibility: "ORGANIZATION_WIDE" },
        {
          visibility: "INVITE_ONLY",
          attendees: { some: { membershipId: currentMembershipId } },
        },
      ],
      // On exclut les brouillons des autres, mais on garde ceux de l'utilisateur (géré par union ou filtre supérieur)
      status: { in: ["PUBLISHED", "ONGOING", "COMPLETED", "CANCELLED"] },
      ...(status && { status }),
      ...(type && { type }),
    };

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where: whereClause,
        include: {
          createdBy: {
            select: {
              user: { select: { prenom: true, nom: true, avatar: true } },
              provisionalFirstName: true,
              provisionalLastName: true,
              provisionalAvatar: true,
            },
          },
          _count: { select: { attendees: true } },
          attendees: {
            where: { membershipId: currentMembershipId },
            select: { status: true },
          },
        },
        skip,
        take: limit,
        orderBy: { startDate: "asc" },
      }),
      prisma.event.count({ where: whereClause }),
    ]);

    return { events, total };
  }

  async findUserDrafts(organizationId, creatorMembershipId) {
    return prisma.event.findMany({
      where: {
        organizationId,
        createdById: creatorMembershipId,
        status: "DRAFT",
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findEventDetails(eventId, organizationId, currentMembershipId) {
    return prisma.event.findFirst({
      where: {
        id: eventId,
        organizationId,
        OR: [
          { visibility: "ORGANIZATION_WIDE" },
          {
            visibility: "INVITE_ONLY",
            attendees: { some: { membershipId: currentMembershipId } },
          },
        ],
      },
      include: {
        createdBy: {
          select: {
            id: true,
            role: true,
            user: { select: { prenom: true, nom: true, avatar: true } },
            provisionalFirstName: true,
            provisionalLastName: true,
            provisionalAvatar: true,
          },
        },
        attendees: {
          include: {
            membership: {
              select: {
                user: { select: { prenom: true, nom: true, avatar: true } },
                provisionalFirstName: true,
                provisionalLastName: true,
                provisionalAvatar: true,
              },
            },
          },
          orderBy: { respondedAt: "desc" },
        },
        _count: { select: { expenses: true } },
      },
    });
  }

  // ─── Écriture & Mise à jour ──────────────────────────────────
  async createEvent(data) {
    return prisma.event.create({ data });
  }

  async createInvitees(eventId, membershipIds) {
    if (!membershipIds || membershipIds.length === 0) return;
    const data = membershipIds.map((membershipId) => ({
      eventId,
      membershipId,
      status: "INVITED",
    }));
    await prisma.eventAttendee.createMany({ data });
  }

  async updateEvent(eventId, data) {
    return prisma.event.update({ where: { id: eventId }, data });
  }

  async deleteEvent(eventId) {
    // Le cascade du schéma supprimera les EventAttendees automatiquement
    return prisma.event.delete({ where: { id: eventId } });
  }

  // ─── RSVP (Participation) ────────────────────────────────────
  async upsertAttendee(eventId, membershipId, status) {
    return prisma.eventAttendee.upsert({
      where: { eventId_membershipId: { eventId, membershipId } },
      update: { status, respondedAt: new Date() },
      create: { eventId, membershipId, status, respondedAt: new Date() },
    });
  }

  async isUserInvited(eventId, membershipId) {
    const attendee = await prisma.eventAttendee.findUnique({
      where: { eventId_membershipId: { eventId, membershipId } },
    });
    return attendee && attendee.status === "INVITED";
  }

  async countGoingAttendees(eventId) {
    return prisma.eventAttendee.count({ where: { eventId, status: "GOING" } });
  }

  // ─── Pour le système de notifications ────────────────────────
  async getInviteesMembershipIds(eventId) {
    const attendees = await prisma.eventAttendee.findMany({
      where: { eventId, status: "INVITED" },
      select: { membershipId: true },
    });
    return attendees.map((a) => a.membershipId);
  }
}
