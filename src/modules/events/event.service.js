import { EventRepository } from "./event.repository.js";
import MediaUploader from "../../shared/utils/uploader.js";
import {
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from "../../shared/errors/AppError.js";
import { NotificationService } from "../notifications/notification.service.js";

const eventRepo = new EventRepository();
const notifService = new NotificationService();
const uploader = new MediaUploader();

const getCreatorDisplayInfo = (createdBy) => {
  if (createdBy?.user) {
    return {
      firstName: createdBy.user.prenom,
      lastName: createdBy.user.nom,
      avatar: createdBy.user.avatar,
      hasAccount: true,
    };
  }
  return {
    firstName: createdBy.provisionalFirstName,
    lastName: createdBy.provisionalLastName,
    avatar: createdBy.provisionalAvatar,
    hasAccount: false,
  };
};

const getAttendeeDisplayInfo = (attendee) => {
  const m = attendee.membership;
  if (m?.user) {
    return {
      firstName: m.user.prenom,
      lastName: m.user.nom,
      avatar: m.user.avatar,
      hasAccount: true,
    };
  }
  return {
    firstName: m.provisionalFirstName,
    lastName: m.provisionalLastName,
    avatar: m.provisionalAvatar,
    hasAccount: false,
  };
};

export class EventService {
  // ─── Création ────────────────────────────────────────────────
  async createEvent(organizationId, currentUserId, eventData, coverFile) {
    const creator = await eventRepo.findAuthorizedMembership(
      currentUserId,
      organizationId,
      [
        "ADMIN",
        "PRESIDENT",
        "VICE_PRESIDENT",
        "SECRETARY_GENERAL",
        "ORGANIZER",
      ],
    );
    if (!creator)
      throw new ForbiddenError(
        "Permissions insuffisantes pour créer un événement",
      );

    let coverImageUrl = null;
    let coverPrefix = null;

    try {
      if (coverFile) {
        coverPrefix = `event_${organizationId}_${Date.now()}`;
        coverImageUrl = await uploader.upload(
          coverFile,
          "organizations/events/covers",
          coverPrefix,
        );
      }

      const event = await eventRepo.createEvent({
        organizationId,
        createdById: creator.id,
        title: eventData.title,
        description: eventData.description || null,
        type: eventData.type,
        visibility: eventData.visibility,
        status: "DRAFT", // Toujours brouillon à la création
        startDate: new Date(eventData.startDate),
        endDate: eventData.endDate ? new Date(eventData.endDate) : null,
        location: eventData.location || null,
        locationUrl: eventData.locationUrl || null,
        isOnline: eventData.isOnline || false,
        meetingLink: eventData.meetingLink || null,
        maxParticipants: eventData.maxParticipants || null,
        estimatedBudget: eventData.estimatedBudget || null,
        coverImage: coverImageUrl,
      });

      if (eventData.visibility === "INVITE_ONLY" && eventData.inviteeIds) {
        await eventRepo.createInvitees(event.id, eventData.inviteeIds);
      }

      return event;
    } catch (error) {
      if (coverImageUrl && coverPrefix) await uploader.rollback(coverPrefix);
      throw error;
    }
  }

  // ─── Publication ─────────────────────────────────────────────
  async publishEvent(organizationId, eventId, currentUserId) {
    const event = await this.#getEventAndCheckOwnership(
      organizationId,
      eventId,
      currentUserId,
      "publier",
    );
    if (event.status !== "DRAFT")
      throw new ConflictError("Seul un brouillon peut être publié");

    await eventRepo.updateEvent(eventId, { status: "PUBLISHED" });

    // Déclencher les notifications de manière asynchrone
    notifService
      .notifyEventPublished(
        organizationId,
        event.id,
        event.title,
        event.visibility,
      )
      .catch((err) => console.error("[EVENT_NOTIF_ERROR]", err.message));

    return {
      success: true,
      message: "Événement publié et notifications envoyées",
    };
  }

  // ─── Lecture ─────────────────────────────────────────────────
  async getMyEvents(organizationId, currentUserId, filters) {
    const membership = await eventRepo.findActiveMembership(
      currentUserId,
      organizationId,
    );
    if (!membership) throw new ForbiddenError("Accès non autorisé");

    const publicEvents = await eventRepo.findEventsForUser(
      organizationId,
      membership.id,
      filters,
    );
    const userDrafts = await eventRepo.findUserDrafts(
      organizationId,
      membership.id,
    );

    const allEvents = [...userDrafts, ...publicEvents.events];

    return {
      events: allEvents,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: publicEvents.total + userDrafts.length,
        pages: Math.ceil(
          (publicEvents.total + userDrafts.length) / filters.limit,
        ),
      },
    };
  }

  async getEventById(organizationId, eventId, currentUserId) {
    const membership = await eventRepo.findActiveMembership(
      currentUserId,
      organizationId,
    );
    if (!membership) throw new ForbiddenError("Accès non autorisé");

    const event = await eventRepo.findEventDetails(
      eventId,
      organizationId,
      membership.id,
    );
    if (!event)
      throw new NotFoundError("Événement non trouvé ou vous n'avez pas accès");

    return {
      ...event,
      creatorDisplayInfo: getCreatorDisplayInfo(event.createdBy),
      myAttendanceStatus:
        event.attendees.length > 0 ? event.attendees[0].status : null,
      formattedAttendees: event.attendees.map((a) => ({
        ...a,
        displayInfo: getAttendeeDisplayInfo(a),
      })),
    };
  }

  // ── Mise à jour & Suppression ────────────────────────────────
  async updateEvent(
    organizationId,
    eventId,
    currentUserId,
    updateData,
    coverFile,
  ) {
    const event = await this.#getEventAndCheckOwnership(
      organizationId,
      eventId,
      currentUserId,
      "modifier",
    );
    if (["COMPLETED", "CANCELLED"].includes(event.status)) {
      throw new ConflictError(
        "Impossible de modifier un événement terminé ou annulé",
      );
    }

    if (coverFile) {
      const uploader = new MediaUploader();
      const prefix = `event_${organizationId}_${Date.now()}`;

      // 1. Upload de la nouvelle image
      updateData.coverImage = await uploader.upload(
        coverFile,
        "organizations/events/covers",
        prefix,
      );

      // 2. Suppression de l'ancienne image sur Cloudinary
      if (event.coverImage) {
        // On l'appelle de manière asynchrone sans "await" pour ne pas ralentir
        // la réponse de l'API pour l'utilisateur (non-bloquant)
        uploader.deleteByUrl(event.coverImage).catch((err) => {
          console.error(`[EVENT_IMAGE_DELETE_ERROR] ${err.message}`);
        });
      }
    }

    if (updateData.startDate)
      updateData.startDate = new Date(updateData.startDate);
    if (updateData.endDate) updateData.endDate = new Date(updateData.endDate);

    return eventRepo.updateEvent(eventId, updateData);
  }

  async deleteEvent(organizationId, eventId, currentUserId) {
    await this.#getEventAndCheckOwnership(
      organizationId,
      eventId,
      currentUserId,
      "supprimer",
    );
    return eventRepo.deleteEvent(eventId);
  }

  // ─── RSVP (Réponse à l'invitation) ──────────────────────────
  async rsvpEvent(organizationId, eventId, currentUserId, responseStatus) {
    const membership = await eventRepo.findActiveMembership(
      currentUserId,
      organizationId,
    );
    if (!membership) throw new ForbiddenError("Accès non autorisé");

    const event = await eventRepo.findById(eventId);
    if (!event || event.organizationId !== organizationId)
      throw new NotFoundError("Événement");
    if (!["PUBLISHED", "ONGOING"].includes(event.status))
      throw new ConflictError(
        "Les inscriptions sont closes pour cet événement",
      );

    if (event.visibility === "INVITE_ONLY") {
      const isInvited = await eventRepo.isUserInvited(eventId, membership.id);
      if (!isInvited)
        throw new ForbiddenError(
          "Vous n'êtes pas invité à cet événement privé",
        );
    }

    if (responseStatus === "GOING" && event.maxParticipants) {
      const currentCount = await eventRepo.countGoingAttendees(eventId);
      if (currentCount >= event.maxParticipants)
        throw new ConflictError("L'événement est complet");
    }

    return eventRepo.upsertAttendee(eventId, membership.id, responseStatus);
  }

  // ─── Annulation ──────────────────────────────────────────────
  async cancelEvent(organizationId, eventId, currentUserId) {
    const event = await this.#getEventAndCheckOwnership(
      organizationId,
      eventId,
      currentUserId,
      "annuler",
    );

    // Règles métier d'annulation
    if (event.status === "DRAFT") {
      throw new ConflictError(
        "Un brouillon ne peut pas être annulé, utilisez la suppression.",
      );
    }
    if (["COMPLETED", "CANCELLED"].includes(event.status)) {
      throw new ConflictError(
        "Cet événement est déjà terminé ou a déjà été annulé.",
      );
    }

    await eventRepo.updateEvent(eventId, { status: "CANCELLED" });

    // Déclencher les notifications d'annulation
    notifService
      .notifyEventCancelled(
        organizationId,
        event.id,
        event.title,
        event.visibility,
      )
      .catch((err) => console.error("[EVENT_CANCEL_ERROR]", err.message));

    return {
      success: true,
      message: "Événement annulé et notifications envoyées aux participants",
    };
  }

  // ─── Privé ───────────────────────────────────────────────────
  async #getEventAndCheckOwnership(
    organizationId,
    eventId,
    currentUserId,
    action,
  ) {
    const membership = await eventRepo.findActiveMembership(
      currentUserId,
      organizationId,
    );
    if (!membership) throw new ForbiddenError("Accès non autorisé");

    const event = await eventRepo.findById(eventId);

    if (!event || event.organizationId !== organizationId)
      throw new NotFoundError("Événement introuvable");

    const isAdmin = ["ADMIN", "PRESIDENT"].includes(membership.role);
    if (event.createdById !== membership.id && !isAdmin) {
      throw new ForbiddenError(
        `Vous n'êtes pas autorisé à ${action} cet événement`,
      );
    }
    return event;
  }
}
