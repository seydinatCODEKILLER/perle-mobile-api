import { MembershipRepository } from "./membership.repository.js";
import MediaUploader from "../../shared/utils/uploader.js";
import { prisma } from "../../config/database.js";
import {
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from "../../shared/errors/AppError.js";

const membershipRepo = new MembershipRepository();

// ─── Helpers privés ───────────────────────────────────────────
const generateLoginId = () =>
  Math.random().toString(36).substring(2, 10).toUpperCase();

const generateMemberNumber = async (organizationId) => {
  const org = await prisma.organization.update({
    where: { id: organizationId },
    data: { memberCounter: { increment: 1 } },
    select: { memberCounter: true },
  });
  return `MBR${organizationId.slice(-6)}${org.memberCounter.toString().padStart(3, "0")}`;
};

export class MembershipService {
  // ─── Créer un membre ─────────────────────────────────────────
  async createMembership(
    organizationId,
    currentUserId,
    membershipData,
    avatarFile,
  ) {
    const currentMembership = await membershipRepo.findAuthorizedMembership(
      currentUserId,
      organizationId,
      ["ADMIN", "FINANCIAL_MANAGER"],
    );

    if (!currentMembership) {
      throw new ForbiddenError(
        "Permissions insuffisantes pour ajouter un membre",
      );
    }

    await this.#checkSubscriptionLimits(organizationId);

    if (membershipData.memberType === "existing" && membershipData.phone) {
      return this.#createWithUser(
        organizationId,
        currentUserId,
        currentMembership.id,
        membershipData,
      );
    }

    if (
      membershipData.memberType === "provisional" &&
      membershipData.provisionalData
    ) {
      return this.#createProvisional(
        organizationId,
        currentUserId,
        currentMembership.id,
        membershipData,
        avatarFile,
      );
    }

    throw new ConflictError(
      "Données invalides. Veuillez spécifier le type de membre (existing ou provisional).",
    );
  }

  async #createWithUser(
    organizationId,
    currentUserId,
    currentMembershipId,
    data,
  ) {
    const user = await prisma.user.findUnique({ where: { phone: data.phone } });
    if (!user)
      throw new NotFoundError(
        "Aucun utilisateur trouvé avec ce numéro de téléphone",
      );

    const existingMembership = await membershipRepo.findUserMembershipInOrg(
      user.id,
      organizationId,
    );
    if (existingMembership)
      throw new ConflictError(
        "Cet utilisateur est déjà membre de cette organisation",
      );

    const membership = await prisma.membership.create({
      data: {
        userId: user.id,
        organizationId,
        role: data.role || "MEMBER",
        memberNumber: await generateMemberNumber(organizationId),
        loginId: generateLoginId(),
      },
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
        organization: { select: { id: true, name: true } },
      },
    });

    await membershipRepo.updateSubscriptionUsage(organizationId, 1);

    await prisma.auditLog.create({
      data: {
        action: "CREATE_MEMBERSHIP",
        resource: "membership",
        resourceId: membership.id,
        userId: currentUserId,
        organizationId,
        membershipId: currentMembershipId,
        details: {
          userId: membership.userId,
          role: membership.role,
          memberNumber: membership.memberNumber,
          type: "with_account",
        },
      },
    });

    return membership;
  }

  async #createProvisional(
    organizationId,
    currentUserId,
    currentMembershipId,
    data,
    avatarFile,
  ) {
    const { provisionalData } = data;
    let avatarUrl = null;
    let avatarPrefix = null;

    const [existingUser, existingProvisional] = await Promise.all([
      prisma.user.findUnique({ where: { phone: provisionalData.phone } }),
      membershipRepo.findProvisionalByPhone(
        organizationId,
        provisionalData.phone,
      ),
    ]);

    if (existingUser)
      throw new ConflictError(
        "Ce numéro de téléphone est déjà associé à un compte utilisateur",
      );
    if (existingProvisional)
      throw new ConflictError(
        "Ce numéro est déjà utilisé par un membre provisoire de cette organisation",
      );

    const uploader = new MediaUploader();

    try {
      if (avatarFile) {
        avatarPrefix = `member_${organizationId}_${provisionalData.phone}_${Date.now()}`;
        avatarUrl = await uploader.upload(
          avatarFile,
          "organizations/members/avatars",
          avatarPrefix,
        );
      }

      const membership = await prisma.membership.create({
        data: {
          userId: null,
          organizationId,
          role: data.role || "MEMBER",
          memberNumber: await generateMemberNumber(organizationId),
          loginId: generateLoginId(),
          provisionalFirstName: provisionalData.firstName,
          provisionalLastName: provisionalData.lastName,
          provisionalPhone: provisionalData.phone,
          provisionalEmail: provisionalData.email || null,
          provisionalAvatar: avatarUrl,
          provisionalGender: provisionalData.gender || null,
        },
        include: { organization: { select: { id: true, name: true } } },
      });

      await membershipRepo.updateSubscriptionUsage(organizationId, 1);

      await prisma.auditLog.create({
        data: {
          action: "CREATE_MEMBERSHIP",
          resource: "membership",
          resourceId: membership.id,
          userId: currentUserId,
          organizationId,
          membershipId: currentMembershipId,
          details: {
            role: membership.role,
            memberNumber: membership.memberNumber,
            type: "provisional",
            phone: membership.provisionalPhone,
            hasAvatar: !!avatarUrl,
          },
        },
      });

      return membership;
    } catch (error) {
      if (avatarUrl && avatarPrefix) await uploader.rollback(avatarPrefix);
      throw error;
    }
  }

  // ─── Obtenir les infos d'affichage (Helper Public) ───────────
  getMemberDisplayInfo(membership) {
    if (membership.userId && membership.user) {
      return {
        id: membership.id,
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
      id: membership.id,
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

  // ─── Récupérer un membre par ID ──────────────────────────────
  async getMembershipById(organizationId, membershipId, currentUserId) {
    await this.#checkOrgAccess(organizationId, currentUserId);

    const membership = await membershipRepo.findWithDetails(membershipId);
    if (!membership) throw new NotFoundError("Membre");
    if (membership.organizationId !== organizationId)
      throw new ForbiddenError(
        "Ce membre n'appartient pas à cette organisation",
      );

    return {
      ...membership,
      displayInfo: this.getMemberDisplayInfo(membership),
    };
  }

  // ─── Récupérer les membres d'une organisation ────────────────
  async getOrganizationMembers(organizationId, currentUserId, filters) {
    await this.#checkOrgAccess(organizationId, currentUserId);

    const { status, role, search, gender, page = 1, limit = 10 } = filters;
    const skip = (page - 1) * limit;

    const whereClause = {
      ...(status && { status }),
      ...(role && { role }),
      ...(gender && {
        OR: [{ user: { gender } }, { provisionalGender: gender }],
      }),
      ...(search && {
        OR: [
          { memberNumber: { contains: search, mode: "insensitive" } },
          {
            user: {
              OR: [
                { prenom: { contains: search, mode: "insensitive" } },
                { nom: { contains: search, mode: "insensitive" } },
                { phone: { contains: search, mode: "insensitive" } },
              ],
            },
          },
          { provisionalFirstName: { contains: search, mode: "insensitive" } },
          { provisionalLastName: { contains: search, mode: "insensitive" } },
          { provisionalPhone: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const { memberships, total } = await membershipRepo.findWithFilters(
      organizationId,
      { whereClause, skip, take: limit },
    );

    return {
      members: memberships.map((m) => ({
        ...m,
        displayInfo: this.getMemberDisplayInfo(m),
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  // ─── Mise à jour (Rôle classique) ────────────────────────────
  async updateMembership(
    organizationId,
    membershipId,
    currentUserId,
    updateData,
  ) {
    await this.#checkAdminAccess(
      organizationId,
      currentUserId,
      "modifier un membre",
    );

    const existing = await membershipRepo.findWithDetails(membershipId);
    if (!existing || existing.organizationId !== organizationId)
      throw new NotFoundError("Membre");

    const updated = await prisma.membership.update({
      where: { id: membershipId },
      data: updateData,
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
    });

    await this.#createAuditLog(
      organizationId,
      currentUserId,
      existing.id,
      "UPDATE_MEMBERSHIP",
      updateData,
    );
    return updated;
  }

  // ─── Mise à jour membre provisoire ───────────────────────────
  async updateProvisionalMember(
    organizationId,
    membershipId,
    currentUserId,
    updateData,
  ) {
    const currentMembership = await membershipRepo.findAuthorizedMembership(
      currentUserId,
      organizationId,
      [
        "ADMIN",
        "FINANCIAL_MANAGER",
        "PRESIDENT",
        "VICE_PRESIDENT",
        "SECRETARY_GENERAL",
        "ORGANIZER",
      ],
    );
    if (!currentMembership)
      throw new ForbiddenError("Permissions insuffisantes");

    const membership = await prisma.membership.findUnique({
      where: { id: membershipId },
    });
    if (!membership || membership.organizationId !== organizationId)
      throw new NotFoundError("Membre");
    if (membership.userId !== null)
      throw new ConflictError(
        "Ce membre a un compte. Modifiez son profil utilisateur.",
      );

    const updated = await prisma.membership.update({
      where: { id: membershipId },
      data: {
        ...(updateData.firstName && {
          provisionalFirstName: updateData.firstName,
        }),
        ...(updateData.lastName && {
          provisionalLastName: updateData.lastName,
        }),
        ...(updateData.email !== undefined && {
          provisionalEmail: updateData.email,
        }),
        ...(updateData.phone && { provisionalPhone: updateData.phone }),
      },
    });

    await this.#createAuditLog(
      organizationId,
      currentUserId,
      membershipId,
      "UPDATE_PROVISIONAL_MEMBER",
      updateData,
    );
    return updated;
  }

  // ─── Mise à jour du statut ───────────────────────────────────
  async updateMembershipStatus(
    organizationId,
    membershipId,
    currentUserId,
    status,
  ) {
    await this.#checkAdminAccess(
      organizationId,
      currentUserId,
      "modifier le statut d'un membre",
    );

    const existing = await membershipRepo.findWithDetails(membershipId);
    if (!existing || existing.organizationId !== organizationId)
      throw new NotFoundError("Membre");

    const updated = await prisma.membership.update({
      where: { id: membershipId },
      data: { status },
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
    });

    await this.#createAuditLog(
      organizationId,
      currentUserId,
      membershipId,
      "UPDATE_MEMBERSHIP_STATUS",
      { status },
    );
    return updated;
  }

  // ─── Mise à jour du rôle ─────────────────────────────────────
  async updateMembershipRole(
    organizationId,
    membershipId,
    currentUserId,
    role,
  ) {
    if (!role) throw new ConflictError("Le rôle est requis");

    const currentMembership = await this.#checkAdminAccess(
      organizationId,
      currentUserId,
      "modifier le rôle d'un membre",
    );
    const existing = await prisma.membership.findUnique({
      where: { id: membershipId },
    });

    if (!existing || existing.organizationId !== organizationId)
      throw new NotFoundError("Membre");
    if (existing.userId === currentUserId)
      throw new ForbiddenError("Vous ne pouvez pas modifier votre propre rôle");

    const updated = await prisma.membership.update({
      where: { id: membershipId },
      data: { role },
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
    });

    await this.#createAuditLog(
      organizationId,
      currentUserId,
      membershipId,
      "UPDATE_MEMBERSHIP_ROLE",
      { role },
    );
    return updated;
  }

  // ─── Suppression ─────────────────────────────────────────────
  async deleteMembership(organizationId, membershipId, currentUserId) {
    await this.#checkAdminAccess(
      organizationId,
      currentUserId,
      "supprimer un membre",
    );

    const existing = await prisma.membership.findUnique({
      where: { id: membershipId },
      include: {
        user: { select: { id: true, prenom: true, nom: true, email: true } },
      },
    });

    if (!existing || existing.organizationId !== organizationId)
      throw new NotFoundError("Membre");
    if (existing.userId === currentUserId)
      throw new ForbiddenError("Vous ne pouvez pas vous supprimer vous-même");

    const deleted = await prisma.membership.delete({
      where: { id: membershipId },
      include: {
        user: { select: { id: true, prenom: true, nom: true, email: true } },
      },
    });

    await membershipRepo.updateSubscriptionUsage(organizationId, -1);
    await this.#createAuditLog(
      organizationId,
      currentUserId,
      membershipId,
      "DELETE_MEMBERSHIP",
      {
        userId: deleted.userId,
        role: deleted.role,
        wasProvisional: deleted.userId === null,
      },
    );

    return deleted;
  }

  // ─── Helpers Privés (Permissions & Utils) ────────────────────
  async #checkOrgAccess(organizationId, userId) {
    const membership = await membershipRepo.findActiveMembership(
      userId,
      organizationId,
    );
    if (!membership)
      throw new ForbiddenError("Accès non autorisé à cette organisation");
  }

  async #checkAdminAccess(organizationId, userId, action) {
    const membership = await membershipRepo.findAuthorizedMembership(
      userId,
      organizationId,
      ["ADMIN"],
    );
    if (!membership)
      throw new ForbiddenError(`Permissions insuffisantes pour ${action}`);
    return membership;
  }

  async #checkSubscriptionLimits(organizationId) {
    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
    });
    if (!subscription)
      throw new NotFoundError("Abonnement non trouvé pour cette organisation");

    const memberCount = await prisma.membership.count({
      where: { organizationId, status: "ACTIVE" },
    });
    if (memberCount >= subscription.maxMembers) {
      throw new ConflictError(
        `Limite de membres atteinte (${subscription.maxMembers}). Veuillez mettre à niveau votre abonnement.`,
      );
    }
  }

  async #createAuditLog(organizationId, userId, membershipId, action, details) {
    await prisma.auditLog.create({
      data: {
        action,
        resource: "membership",
        resourceId: membershipId,
        userId,
        organizationId,
        membershipId,
        details,
      },
    });
  }
}
