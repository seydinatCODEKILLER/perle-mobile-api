import { Router } from "express";
import { AuthController } from "./auth.controller.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { protect, restrictTo } from "../../shared/middlewares/auth.middleware.js";
import { uploadSingle } from "../../shared/middlewares/upload.middleware.js";
import { sanitizeBody } from "../../shared/middlewares/sanitize.middleware.js";
import {
  loginSchema,
  registerSchema,
  refreshTokenSchema,
  updateProfileSchema,
  updateCanCreateOrgSchema,
} from "./auth.schema.js";
import {
  authLimiter,
  registerLimiter,
  refreshTokenLimiter,
} from "../../config/rateLimiter.js";

const router = Router();
const authController = new AuthController();

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "507f1f77bcf86cd799439011"
 *         prenom:
 *           type: string
 *           example: "Jean"
 *         nom:
 *           type: string
 *           example: "Dupont"
 *         email:
 *           type: string
 *           example: "jean.dupont@email.com"
 *         phone:
 *           type: string
 *           example: "+221781234567"
 *         avatar:
 *           type: string
 *           example: "https://example.com/avatar.jpg"
 *         role:
 *           type: string
 *           enum: [SUPER_ADMIN, ADMIN, MEMBER]
 *           example: "MEMBER"
 *         gender:
 *           type: string
 *           enum: [MALE, FEMALE]
 *           example: "MALE"
 *         isActive:
 *           type: boolean
 *           example: true
 *         canCreateOrganization:
 *           type: boolean
 *           example: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         lastLoginAt:
 *           type: string
 *           format: date-time
 *
 *     AuthResponse:
 *       type: object
 *       properties:
 *         user:
 *           $ref: '#/components/schemas/User'
 *         accessToken:
 *           type: string
 *           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *         refreshToken:
 *           type: string
 *           example: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0..."
 *
 *     RefreshTokenResponse:
 *       type: object
 *       properties:
 *         accessToken:
 *           type: string
 *           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *
 *     RefreshTokenRequest:
 *       type: object
 *       required:
 *         - refreshToken
 *       properties:
 *         refreshToken:
 *           type: string
 *           example: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0..."
 *
 *     RegisterRequest:
 *       type: object
 *       required:
 *         - prenom
 *         - nom
 *         - email
 *         - password
 *       properties:
 *         prenom:
 *           type: string
 *           minLength: 2
 *           example: "Jean"
 *         nom:
 *           type: string
 *           minLength: 2
 *           example: "Dupont"
 *         email:
 *           type: string
 *           format: email
 *           example: "jean.dupont@email.com"
 *         password:
 *           type: string
 *           format: password
 *           minLength: 8
 *           example: "MonMotDePasse123!"
 *         phone:
 *           type: string
 *           example: "+221781234567"
 *         gender:
 *           type: string
 *           enum: [MALE, FEMALE]
 *           example: "MALE"
 *
 *     LoginRequest:
 *       type: object
 *       required:
 *         - phone
 *         - password
 *       properties:
 *         phone:
 *           type: string
 *           example: "781254695"
 *         password:
 *           type: string
 *           format: password
 *           example: "Liverpool040"
 *
 *     UpdateProfileRequest:
 *       type: object
 *       properties:
 *         prenom:
 *           type: string
 *           minLength: 2
 *           example: "Jean"
 *         nom:
 *           type: string
 *           minLength: 2
 *           example: "Dupont"
 *         phone:
 *           type: string
 *           example: "+221781234567"
 *         gender:
 *           type: string
 *           enum: [MALE, FEMALE]
 *           example: "FEMALE"
 *
 *     UpdateCanCreateOrgRequest:
 *       type: object
 *       required:
 *         - userId
 *         - canCreateOrganization
 *       properties:
 *         userId:
 *           type: string
 *           example: "507f1f77bcf86cd799439011"
 *         canCreateOrganization:
 *           type: boolean
 *           example: true
 *
 *     Success:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Opération réussie"
 *         data:
 *           type: object
 *
 *     Error:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: "Une erreur est survenue"
 *         error:
 *           type: string
 *           example: "Détails de l'erreur"
 *
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

// ─── Routes publiques ─────────────────────────────────────────

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Inscription d'un nouvel utilisateur
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/RegisterRequest'
 *               - type: object
 *                 properties:
 *                   avatar:
 *                     type: string
 *                     format: binary
 *                     description: Image d'avatar (optionnelle, max 5MB)
 *     responses:
 *       201:
 *         description: Utilisateur créé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Données invalides ou mot de passe faible
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Email ou téléphone déjà utilisé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  "/register",
  registerLimiter,
  uploadSingle("avatar"),
  validate(registerSchema),
  authController.register
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Connexion avec téléphone et mot de passe
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Connexion réussie
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Données invalides
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Identifiants incorrects
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Compte désactivé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  "/login",
  authLimiter,
  validate(loginSchema),
  authController.login
);

/**
 * @swagger
 * /api/auth/refresh-token:
 *   post:
 *     summary: Rafraîchir l'access token
 *     description: Permet d'obtenir un nouveau access token en utilisant un refresh token valide
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshTokenRequest'
 *     responses:
 *       200:
 *         description: Token rafraîchi avec succès
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/RefreshTokenResponse'
 *       400:
 *         description: Refresh token manquant
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Refresh token invalide, révoqué ou expiré
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  "/refresh-token",
  refreshTokenLimiter,
  validate(refreshTokenSchema),
  authController.refreshToken
);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Déconnexion
 *     description: Révoque le refresh token fourni pour empêcher sa réutilisation.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshTokenRequest'
 *     responses:
 *       200:
 *         description: Déconnexion réussie
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Refresh token manquant
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  "/logout",
  validate(refreshTokenSchema),
  authController.logout
);

// ─── Routes protégées ─────────────────────────────────────────

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Profil de l'utilisateur connecté
 *     description: Récupérer les informations de l'utilisateur connecté avec ses memberships actifs
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Informations utilisateur récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         description: Non authentifié
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Utilisateur non trouvé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/me", protect(), authController.getCurrentUser);

/**
 * @swagger
 * /api/auth/profile:
 *   put:
 *     summary: Mettre à jour le profil
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/UpdateProfileRequest'
 *               - type: object
 *                 properties:
 *                   avatar:
 *                     type: string
 *                     format: binary
 *                     description: Nouvelle image d'avatar (optionnelle, max 5MB)
 *     responses:
 *       200:
 *         description: Profil mis à jour avec succès
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/User'
 *       400:
 *         description: Données invalides
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Non authentifié
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put(
  "/profile",
  protect(),
  uploadSingle("avatar"),
  sanitizeBody,
  validate(updateProfileSchema),
  authController.updateProfile
);

/**
 * @swagger
 * /api/auth/revoke-all-tokens:
 *   post:
 *     summary: Révoquer tous les tokens (déconnecter tous les appareils)
 *     description: Déconnecte l'utilisateur de tous ses appareils en révoquant tous ses refresh tokens
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tous les refresh tokens ont été révoqués
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Erreur lors de la révocation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Non authentifié
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  "/revoke-all-tokens",
  protect(),
  authController.revokeAllTokens
);

/**
 * @swagger
 * /api/auth/can-create-org:
 *   patch:
 *     summary: Modifier le droit de création d'organisation (Admin seulement)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateCanCreateOrgRequest'
 *     responses:
 *       200:
 *         description: Droit de création mis à jour avec succès
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Données invalides
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Non authentifié
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Permissions insuffisantes
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.patch(
  "/can-create-org",
  protect(),
  restrictTo("SUPER_ADMIN", "ADMIN"),
  validate(updateCanCreateOrgSchema),
  authController.updateCanCreateOrganization
);

export default router;