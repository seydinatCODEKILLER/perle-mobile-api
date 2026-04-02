import { env } from "../../config/env.js";
import { AppError } from "../errors/AppError.js";

/**
 * Gestionnaire d'erreur 404 (Route non trouvée)
 */
export const notFoundHandler = (req, res, next) => {
  next(new AppError(`Impossible de trouver ${req.originalUrl} sur ce serveur`, 404));
};

/**
 * Gestionnaire d'erreurs global
 */
export const errorHandler = (err, req, res, next) => {
  // 1. Log pour le développeur
  if (env.NODE_ENV === "development") {
    console.error("❌ ERREUR 💥:", err);
    console.error("Stack:", err.stack);
  } else {
    console.error("❌ ERREUR:", err.message);
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
      errors: err.details || undefined,
    });
  }

  // B. Erreurs de validation Zod (si non catchées par le middleware)
  if (err.name === "ZodError") {
    const message = err.errors.map((e) => e.message).join(", ");
    return res.status(400).json({
      status: "error",
      message: "Erreur de validation des données",
      errors: err.errors,
    });
  }

  // C. Erreurs Prisma (Base de données)
  if (err.code === "P2002") {
    const field = err.meta?.target?.join(", ") || "champ";
    return res.status(409).json({
      status: "error",
      message: `Un enregistrement avec ce ${field} existe déjà.`,
    });
  }

  if (err.code === "P2023") {
    return res.status(400).json({
      status: "error",
      message: "Format d'identifiant invalide.",
    });
  }

  if (err.code === "P2025") {
    return res.status(404).json({
      status: "error",
      message: "Enregistrement introuvable.",
    });
  }

  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      status: "error",
      message: "Token invalide. Veuillez vous reconnecter.",
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      status: "error",
      message: "Token expiré. Veuillez vous reconnecter.",
    });
  }

  return res.status(500).json({
    status: "error",
    message:
      env.NODE_ENV === "production"
        ? "Une erreur interne du serveur est survenue."
        : err.message,
  });
};