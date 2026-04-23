import { NotificationRepository } from "./notification.repository.js";
import { ChannelRegistry } from "./notification.channels.js"; // ✅ Import corrigé
import { ForbiddenError, NotFoundError } from "../../shared/errors/AppError.js";

const notifRepo = new NotificationRepository();

// ✅ Helper corrigé : plus d'underscore, plus de faute de frappe
const getMemberContact = (membership) => {
  if (membership?.user) {
    return {
      id: membership.id,
      prenom: membership.user.prenom,
      nom: membership.user.nom,
      phone: membership.user.phone, // ✅ Corrigé: _membership → membership
      email: membership.user.email,
    };
  }
  return {
    id: membership.id,
    prenom: membership.provisionalFirstName || "Membre",
    nom: membership.provisionalLastName || "",
    phone: membership.provisionalPhone || null,
    email: membership.provisionalEmail || null, // ✅ Corrigé: provincial → provisional
  };
};

export class NotificationService {
  // ─── Récupérer les canaux selon OrganizationSettings ──────────────────────
  async resolveChannels(organizationId) {
    const settings = await notifRepo.getSettings(organizationId);
    if (!settings) return ["IN_APP"];

    const channels = ["IN_APP"];
    if (settings.emailNotifications) channels.push("EMAIL");
    if (settings.smsNotifications) channels.push("SMS");
    if (settings.whatsappNotifications) channels.push("WHATSAPP");

    return channels;
  }

  // ─── Dispatcher les canaux ────────────────────────────────────────────────
  async dispatchChannels(notification, contact, channels) {
    let globalSuccess = true;

    for (const channelName of channels) {
      const channel = ChannelRegistry[channelName];
      if (!channel) continue;

      try {
        await channel.send(notification, contact);
      } catch (error) {
        console.error(`[NOTIF] Échec canal ${channelName}:`, error.message);
        globalSuccess = false;
      }
    }

    if (notification.id) {
      const status = globalSuccess ? "SENT" : "FAILED";
      await notifRepo.updateStatus(notification.id, status).catch(() => {});
    }

    return globalSuccess;
  }

  // ─── Envoyer une notification manuelle ───────────────────────────────────
  async send(organizationId, currentUserId, data) {
    // ✅ AJOUT: Vérification des permissions admin
    const adminMembership = await notifRepo.findAdminMembership(
      organizationId,
      currentUserId,
    );
    if (!adminMembership) {
      throw new ForbiddenError(
        "Seuls les administrateurs peuvent envoyer des notifications",
      );
    }

    const channels = await this.resolveChannels(organizationId);

    // Envoi à tous les membres de l'organisation
    if (data.sendToAll) {
      const memberships = await notifRepo.getActiveMemberships(organizationId);

      const notifications = memberships.map((m) => ({
        organizationId,
        membershipId: m.id,
        type: data.type,
        title: data.title,
        message: data.message,
        priority: data.priority,
        channels,
        status: "PENDING",
      }));

      await notifRepo.createMany(notifications);

      for (const membership of memberships) {
        const contact = getMemberContact(membership);
        const notif = { id: null, title: data.title, message: data.message };
        await this.dispatchChannels(notif, contact, channels).catch(() => {});
      }

      return {
        message: `Notification envoyée à ${memberships.length} membre(s)`,
        count: memberships.length,
      };
    }

    // Envoi à un membre spécifique
    // ✅ Corrigé: utilisation de la méthode existante
    const membership = await notifRepo.findMembershipById(data.membershipId);
    if (!membership || membership.organizationId !== organizationId) {
      throw new NotFoundError("Membre non trouvé dans cette organisation");
    }

    const notification = await notifRepo.createOne({
      organizationId,
      membershipId: membership.id,
      type: data.type,
      title: data.title,
      message: data.message,
      priority: data.priority,
      channels,
    });

    const contact = getMemberContact(membership);
    await this.dispatchChannels(notification, contact, channels);

    return notification;
  }

  // ─── Mes notifications (self-service) ────────────────────────────────────
  async getMyNotifications(organizationId, currentUserId, query) {
    const membership = await notifRepo.findActiveMembership(
      organizationId,
      currentUserId,
    );
    if (!membership) throw new ForbiddenError("Accès non autorisé");

    return notifRepo.listForMembership(organizationId, membership.id, {
      page: query.page,
      limit: query.limit,
      type: query.type,
      status: query.status,
    });
  }

  async getUnreadCount(organizationId, currentUserId) {
    const membership = await notifRepo.findActiveMembership(
      organizationId,
      currentUserId,
    );
    if (!membership) return { count: 0 };

    return {
      count: await notifRepo.countUnread(organizationId, membership.id),
    };
  }

  async markAsRead(organizationId, notificationId, currentUserId) {
    const membership = await notifRepo.findActiveMembership(
      organizationId,
      currentUserId,
    );
    if (!membership) throw new ForbiddenError("Accès non autorisé");

    const notification = await notifRepo.findByIdForMembership(
      notificationId,
      organizationId,
      membership.id,
    );
    if (!notification) throw new NotFoundError("Notification");
    if (notification.status === "DELIVERED") return notification; // Idempotent

    return notifRepo.markAsRead(notificationId);
  }

  async markAllAsRead(organizationId, currentUserId) {
    const membership = await notifRepo.findActiveMembership(
      organizationId,
      currentUserId,
    );
    if (!membership) throw new ForbiddenError("Accès non autorisé");

    await notifRepo.markAllAsRead(organizationId, membership.id);
    return { message: "Toutes les notifications ont été marquées comme lues" };
  }

  // ─── Rappels automatiques (Cron) ─────────────────────────────────────────
  async sendContributionReminders(organizationId, daysAhead) {
    const contributions = await notifRepo.getUpcomingContributions(
      organizationId,
      daysAhead,
    );
    if (contributions.length === 0) return 0;

    const channels = await this.resolveChannels(organizationId);
    let count = 0;

    for (const contribution of contributions) {
      const { membership, contributionPlan } = contribution;

      // ✅ SÉCURITÉ : On vérifie si on a DÉJÀ envoyé ce rappel précis
      const alreadySent = await notifRepo.hasRecentReminder(
        organizationId,
        membership.id,
        "CONTRIBUTION_REMINDER",
        contribution.id,
      );
      if (alreadySent) continue; // On passe à la suivante

      const contact = getMemberContact(membership);
      const remaining = contribution.amount - contribution.amountPaid;

      const notification = await notifRepo.createOne({
        organizationId,
        membershipId: membership.id,
        type: "CONTRIBUTION_REMINDER",
        title: "Rappel de cotisation",
        message: `Bonjour ${contact.prenom}, votre cotisation "${contributionPlan.name}" de ${remaining} XOF est due dans ${daysAhead} jour(s).`,
        priority: daysAhead <= 1 ? "HIGH" : "MEDIUM",
        channels,
        // ✅ AJOUT : On lie la notification à la cotisation
        relatedId: contribution.id,
        relatedType: "CONTRIBUTION",
      });

      await this.dispatchChannels(notification, contact, channels).catch(
        () => {},
      );
      count++;
    }

    return count; // Ne retourne QUE les nouveaux rappels envoyés
  }

  async sendDebtReminders(organizationId, daysAhead) {
    const debts = await notifRepo.getUpcomingDebts(organizationId, daysAhead);
    if (debts.length === 0) return 0;

    const channels = await this.resolveChannels(organizationId);
    let count = 0;

    for (const debt of debts) {
      const { membership } = debt;

      // ✅ SÉCURITÉ : On vérifie si on a DÉJÀ envoyé ce rappel précis
      const alreadySent = await notifRepo.hasRecentReminder(
        organizationId,
        membership.id,
        "DEBT_REMINDER",
        debt.id,
      );
      if (alreadySent) continue;

      const contact = getMemberContact(membership);

      const notification = await notifRepo.createOne({
        organizationId,
        membershipId: membership.id,
        type: "DEBT_REMINDER",
        title: "Rappel de remboursement",
        message: `Bonjour ${contact.prenom}, votre dette "${debt.title}" de ${debt.remainingAmount} XOF est due dans ${daysAhead} jour(s).`,
        priority: daysAhead <= 1 ? "HIGH" : "MEDIUM",
        channels,
        // ✅ AJOUT : On lie la notification à la dette
        relatedId: debt.id,
        relatedType: "DEBT",
      });

      await this.dispatchChannels(notification, contact, channels).catch(
        () => {},
      );
      count++;
    }

    return count;
  }

  async processDailyReminders() {
    const organizations = await notifRepo.getActiveOrganizationsWithSettings();

    let stats = { orgsProcessed: 0, contribReminders: 0, debtReminders: 0 };

    for (const org of organizations) {
      try {
        if (!org.settings?.autoReminders) continue;

        const reminderDays = org.settings.reminderDays || [1, 3, 7];

        for (const days of reminderDays) {
          const [c, d] = await Promise.all([
            this.sendContributionReminders(org.id, days),
            this.sendDebtReminders(org.id, days),
          ]);

          stats.contribReminders += c;
          stats.debtReminders += d;
        }

        stats.orgsProcessed++;
      } catch (error) {
        // On isole l'erreur d'une org pour ne pas tuer le cron global
        console.error(`[CRON] Erreur org ${org.id}:`, error.message);
      }
    }

    return stats;
  }

  // ─── Notifications automatiques métier ────────────────────────────────────
  async sendPaymentConfirmation(
    organizationId,
    membershipId,
    { title, amount },
  ) {
    // ✅ Corrigé: utilisation de membershipId (pas data.membershipId)
    const membership = await notifRepo.findMembershipById(membershipId);
    if (!membership) return;

    const contact = getMemberContact(membership);
    const channels = await this.resolveChannels(organizationId);

    const notification = await notifRepo.createOne({
      organizationId,
      membershipId,
      type: "PAYMENT_CONFIRMATION",
      title: "Paiement confirmé",
      message: `Bonjour ${contact.prenom}, votre paiement de ${amount} XOF pour "${title}" a bien été enregistré.`,
      priority: "MEDIUM",
      channels,
    });

    await this.dispatchChannels(notification, contact, channels).catch(
      () => {},
    );
  }

  async sendMembershipUpdate(organizationId, membershipId, message) {
    // ✅ Corrigé: utilisation de membershipId (pas data.membershipId)
    const membership = await notifRepo.findMembershipById(membershipId);
    if (!membership) return;

    const contact = getMemberContact(membership);
    const channels = await this.resolveChannels(organizationId);

    const notification = await notifRepo.createOne({
      organizationId,
      membershipId,
      type: "MEMBERSHIP_UPDATE",
      title: "Mise à jour de votre compte",
      message:
        message || `Bonjour ${contact.prenom}, votre profil a été mis à jour.`,
      priority: "MEDIUM",
      channels,
    });

    await this.dispatchChannels(notification, contact, channels).catch(
      () => {},
    );
  }

  // ─── Notifications Événements ─────────────────────────────────
  async notifyEventPublished(organizationId, eventId, eventTitle, visibility) {
    const channels = await this.resolveChannels(organizationId);
    let targetMembershipIds = [];

    if (visibility === "INVITE_ONLY") {
      targetMembershipIds = await notifRepo.getEventInvitees(eventId);
    } else {
      const memberships = await notifRepo.getActiveMemberships(organizationId);
      targetMembershipIds = memberships.map((m) => m.id);
    }

    const notifications = targetMembershipIds.map((membershipId) => ({
      organizationId,
      membershipId,
      type: "EVENT_CREATED",
      title: "Nouvel événement",
      message: `Un nouvel événement "${eventTitle}" a été publié.`,
      priority: "MEDIUM",
      channels,
      status: "PENDING",
      relatedId: eventId,
      relatedType: "EVENT",
    }));

    if (notifications.length > 0) {
      await notifRepo.createMany(notifications);
    }
  }

    async notifyEventCancelled(organizationId, eventId, eventTitle, visibility) {
    const channels = await this.resolveChannels(organizationId);
    let targetMembershipIds = [];

    if (visibility === "INVITE_ONLY") {
      targetMembershipIds = await notifRepo.getEventInvitees(eventId);
    } else {
      const memberships = await notifRepo.getActiveMemberships(organizationId);
      targetMembershipIds = memberships.map(m => m.id);
    }

    const notifications = targetMembershipIds.map(membershipId => ({
      organizationId,
      membershipId,
      type: "EVENT_CANCELLED",
      title: "Événement annulé",
      message: `L'événement "${eventTitle}" a été annulé par l'organisateur.`,
      priority: "HIGH",
      channels,
      status: "PENDING",
      relatedId: eventId,
      relatedType: "EVENT",
    }));

    if (notifications.length > 0) {
      await notifRepo.createMany(notifications);
    }
  }
}
