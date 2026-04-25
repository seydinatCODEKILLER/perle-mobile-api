import { AuthRepository } from "./auth.repository.js";
import { JwtService } from "../../config/jwt.js";
import { hashPassword, comparePassword } from "../../shared/utils/hasher.js";
import MediaUploader from "../../shared/utils/uploader.js";
import {
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  NotFoundError,
} from "../../shared/errors/AppError.js";

const authRepo = new AuthRepository();
const jwtService = new JwtService();

// Hash fictif pour neutraliser le timing attack
const DUMMY_HASH =
  "$2b$10$abcdefghijklmnopqrstuuVVmqJZOdEJ.JkpjBnBnNmS6RsOi8jCy";

// ─── Helpers privés ───────────────────────────────────────────

const buildUserPayload = (user) => ({
  id: user.id,
  email: user.email,
  phone: user.phone,
  role: user.role,
  gender: user.gender,
  canCreateOrganization: user.canCreateOrganization,
});

const buildUserResponse = (user) => ({
  id: user.id,
  prenom: user.prenom,
  nom: user.nom,
  email: user.email,
  phone: user.phone,
  role: user.role,
  gender: user.gender,
  avatar: user.avatar,
  isActive: user.isActive,
  canCreateOrganization: user.canCreateOrganization,
  createdAt: user.createdAt,
  lastLoginAt: user.lastLoginAt,
});

const createTokens = async (user) => {
  const payload = buildUserPayload(user);
  const accessToken = jwtService.sign(payload);
  const refreshToken = jwtService.signRefresh(payload);

  await authRepo.createRefreshToken({
    token: refreshToken,
    userId: user.id,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 jours
  });

  return { accessToken, refreshToken };
};

// ─── Service ──────────────────────────────────────────────────

export class AuthService {

  // ─── Inscription ──────────────────────────────────────────────
  async register(data, file) {
    const { prenom, nom, email, password, phone, gender } = data;

    // Vérifier les doublons
    const [existingEmail, existingPhone] = await Promise.all([
      email ? authRepo.findByEmail(email) : null,
      authRepo.findByPhone(phone),
    ]);

    if (existingEmail) {
      throw new ConflictError("Un utilisateur avec cet email existe déjà");
    }
    if (existingPhone) {
      throw new ConflictError(
        "Un utilisateur avec ce numéro de téléphone existe déjà"
      );
    }

    const uploader = new MediaUploader();
    let avatarUrl = null;

    if (file) {
      avatarUrl = await uploader.upload(
        file,
        "organizations/avatars",
        `user_${prenom}_${nom}_${Date.now()}`
      );
    }

    try {
      const hashedPassword = await hashPassword(password);

      const user = await authRepo.createUser({
        prenom,
        nom,
        email: email || null,
        password: hashedPassword,
        phone,
        gender: gender || null,
        avatar: avatarUrl,
      });

      // Lier les membres provisoires + générer les tokens en parallèle
      const [{ accessToken, refreshToken }, linkedMemberships] =
        await Promise.all([
          createTokens(user),
          this.#linkProvisionalMembers(phone, user.id),
          authRepo.updateLastLogin(user.id),
        ]);

      return {
        user: buildUserResponse(user),
        accessToken,
        refreshToken,
        linkedMemberships,
      };
    } catch (error) {
      if (avatarUrl) {
        await uploader.deleteByUrl(avatarUrl).catch(() => {});
      }
      throw error;
    }
  }

  // ─── Connexion ────────────────────────────────────────────────
  async login(phone, password) {
    const user = await authRepo.findByPhone(phone);

    // Timing attack neutralisé — toujours appeler comparePassword
    if (!user) {
      await comparePassword(password, DUMMY_HASH);
      throw new UnauthorizedError(
        "Numéro de téléphone ou mot de passe incorrect"
      );
    }

    if (!user.password) {
      throw new UnauthorizedError(
        "Aucun mot de passe défini. Veuillez réinitialiser votre mot de passe."
      );
    }

    const isValid = await comparePassword(password, user.password);
    if (!isValid) {
      throw new UnauthorizedError(
        "Numéro de téléphone ou mot de passe incorrect"
      );
    }

    if (!user.isActive) {
      throw new ForbiddenError("Votre compte a été désactivé.");
    }

    const [{ accessToken, refreshToken }] = await Promise.all([
      createTokens(user),
      authRepo.updateLastLogin(user.id),
    ]);

    return {
      user: buildUserResponse(user),
      accessToken,
      refreshToken,
    };
  }

  // ─── Profil courant ───────────────────────────────────────────
  async getCurrentUser(userId) {
    const user = await authRepo.findByIdWithMemberships(userId);
    if (!user) throw new NotFoundError("Utilisateur");
    return user;
  }

  // ─── Mise à jour du profil ────────────────────────────────────
  async updateProfile(userId, data, file) {
    const user = await authRepo.findById(userId);
    if (!user) throw new NotFoundError("Utilisateur");

    const uploader = new MediaUploader();
    let newAvatarUrl = null;

    if (file) {
      newAvatarUrl = await uploader.upload(
        file,
        "organizations/avatars",
        `user_${userId}_${Date.now()}`
      );
      if (user.avatar) {
        await uploader.deleteByUrl(user.avatar).catch(() => {});
      }
    }

    try {
      return authRepo.updateProfile(userId, {
        ...(data.prenom && { prenom: data.prenom }),
        ...(data.nom && { nom: data.nom }),
        ...(data.phone && { phone: data.phone }),
        ...(data.gender && { gender: data.gender }),
        ...(newAvatarUrl && { avatar: newAvatarUrl }),
      });
    } catch (error) {
      if (newAvatarUrl) {
        await uploader.deleteByUrl(newAvatarUrl).catch(() => {});
      }
      throw error;
    }
  }

  // ─── Refresh token ────────────────────────────────────────────
  async refreshToken(token) {
    const stored = await authRepo.findRefreshToken(token);

    if (!stored) {
      throw new UnauthorizedError("Refresh token invalide");
    }

    if (stored.isRevoked) {
      // Détection réutilisation — révoquer tous les tokens
      await authRepo.revokeAllUserTokens(stored.userId);
      throw new UnauthorizedError(
        "Refresh token révoqué — tous vos appareils ont été déconnectés"
      );
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedError("Refresh token expiré");
    }

    const user = stored.user;
    if (!user.isActive) {
      throw new ForbiddenError("Compte désactivé");
    }

    // Rotation : révoquer l'ancien, créer un nouveau
    const newAccessToken = jwtService.sign(buildUserPayload(user));
    const newRefreshToken = jwtService.signRefresh(buildUserPayload(user));

    await Promise.all([
      authRepo.revokeRefreshToken(token),
      authRepo.createRefreshToken({
        token: newRefreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      }),
    ]);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: buildUserResponse(user),
    };
  }

  // ─── Déconnexion ──────────────────────────────────────────────
  async logout(token) {
    if (token) {
      await authRepo.revokeRefreshToken(token).catch(() => {});
    }
    return { message: "Déconnexion réussie" };
  }

  // ─── Révoquer tous les tokens ─────────────────────────────────
  async revokeAllTokens(userId) {
    await authRepo.revokeAllUserTokens(userId);
    return { message: "Tous les refresh tokens ont été révoqués" };
  }

  // ─── Droit de création d'organisation ────────────────────────
  async updateCanCreateOrganization(userId, canCreateOrganization) {
    const user = await authRepo.findById(userId);
    if (!user) throw new NotFoundError("Utilisateur");

    const updated = await authRepo.updateCanCreateOrganization(
      userId,
      canCreateOrganization
    );

    return {
      message: `Droit de création d'organisation ${
        canCreateOrganization ? "activé" : "désactivé"
      }`,
      user: updated,
    };
  }

  // ─── Lier les membres provisoires (privé) ─────────────────────
  async #linkProvisionalMembers(phone, userId) {
    try {
      const provisionals = await authRepo.findProvisionalMemberships(phone);

      if (provisionals.length === 0) {
        return { linked: 0, memberships: [] };
      }

      const linked = await Promise.all(
        provisionals.map(async (membership) => {
          const updated = await authRepo.linkMembershipToUser(
            membership.id,
            userId
          );

          await authRepo.createAuditLog({
            action: "LINK_PROVISIONAL_MEMBER",
            resource: "membership",
            resourceId: membership.id,
            userId,
            organizationId: membership.organizationId,
            membershipId: membership.id,
            details: {
              phone,
              linkedAt: new Date().toISOString(),
              previousData: {
                firstName: membership.provisionalFirstName,
                lastName: membership.provisionalLastName,
                email: membership.provisionalEmail,
              },
            },
          });

          return {
            id: updated.id,
            organizationId: updated.organizationId,
            organizationName: updated.organization.name,
            organizationType: updated.organization.type,
            role: updated.role,
            memberNumber: updated.memberNumber,
            joinDate: updated.joinDate,
          };
        })
      );

      return { linked: linked.length, memberships: linked };
    } catch (error) {
      console.error("Erreur synchronisation membres provisoires:", error);
      return { linked: 0, memberships: [], error: error.message };
    }
  }
}