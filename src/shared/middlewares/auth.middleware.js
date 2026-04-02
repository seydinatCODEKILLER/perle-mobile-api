import { prisma } from "../../config/database.js";
import { JwtService } from "../../config/jwt.js";
import {
  UnauthorizedError,
  ForbiddenError,
  AppError,
} from "../errors/AppError.js";

const jwtService = new JwtService();

// ─── Protect — vérifie le JWT et attache req.user ────────────
export const protect = () => async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedError("Token manquant ou format invalide");
    }

    const token = header.split(" ")[1];
    const decoded = jwtService.verify(token);

    const currentUser = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        canCreateOrganization: true,
      },
    });

    if (!currentUser) {
      throw new UnauthorizedError(
        "Le token appartient à un utilisateur qui n'existe plus."
      );
    }

    if (!currentUser.isActive) {
      throw new ForbiddenError("Votre compte a été désactivé.");
    }

    req.user = currentUser;
    next();
  } catch (err) {
    next(
      err instanceof AppError
        ? err
        : new UnauthorizedError("Token invalide ou session expirée")
    );
  }
};

// ─── RestrictTo — restriction par rôle global ────────────────
export const restrictTo =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          "Vous n'avez pas la permission d'effectuer cette action."
        )
      );
    }
    next();
  };

// ─── CheckOrganizationAccess — vérifie le membership ─────────
export const checkOrganizationAccess = () => async (req, _res, next) => {
  try {
    const organizationId =
      req.params.organizationId || req.body.organizationId;

    if (!organizationId) return next();

    // SUPER_ADMIN a accès à tout
    if (req.user.role === "SUPER_ADMIN") return next();

    const membership = await prisma.membership.findFirst({
      where: {
        userId: req.user.id,
        organizationId,
        status: "ACTIVE",
      },
    });

    if (!membership) {
      return next(
        new ForbiddenError("Accès non autorisé à cette organisation.")
      );
    }

    req.membership = membership;
    next();
  } catch (error) {
    next(new ForbiddenError("Erreur de vérification d'accès."));
  }
};

// ─── HasOrgRole — restriction par rôle dans l'organisation ───
export const hasOrgRole =
  (...roles) =>
  (req, _res, next) => {
    if (!req.membership) {
      return next(new ForbiddenError("Membership introuvable."));
    }

    if (!roles.includes(req.membership.role)) {
      return next(
        new ForbiddenError(
          "Votre rôle dans cette organisation ne vous permet pas cette action."
        )
      );
    }

    next();
  };