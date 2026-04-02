import { Router } from "express";
import { MembershipController } from "./membership.controller.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { protect } from "../../shared/middlewares/auth.middleware.js";
import { uploadSingle } from "../../shared/middlewares/upload.middleware.js";
import { parseNestedFormData } from "../../shared/middlewares/parseFormData.middleware.js";
import {
  createMembershipSchema,
  getMembersSchema,
  membershipParamSchema,
  updateMembershipSchema,
  updateProvisionalMemberSchema,
  updateMembershipStatusSchema,
  updateMembershipRoleSchema,
} from "./membership.schema.js";

const router = Router();
const membershipController = new MembershipController();

router.use(protect());

// ─── Routes sans :id ──────────────────────────────────────────

/**
 * @swagger
 * /api/membership/{organizationId}/members:
 *   post:
 *     summary: Ajouter un nouveau membre à une organisation
 *     description: |
 *       Permet d'ajouter un membre de deux façons :
 *       - `existing` : Lie un utilisateur existant via son numéro de téléphone.
 *       - `provisional` : Crée un membre temporaire (sans compte) avec des données manuelles.
 *       Nécessite un rôle ADMIN ou FINANCIAL_MANAGER.
 *     tags: [Memberships]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de l'organisation
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             oneOf:
 *               - type: object
 *                 required:
 *                   - memberType
 *                   - phone
 *                 properties:
 *                   memberType:
 *                     type: string
 *                     enum: [existing]
 *                     example: "existing"
 *                   phone:
 *                     type: string
 *                     description: Téléphone de l'utilisateur existant
 *                     example: "781234567"
 *                   role:
 *                     type: string
 *                     enum: [ADMIN, FINANCIAL_MANAGER, MEMBER, PRESIDENT, VICE_PRESIDENT, SECRETARY_GENERAL, ORGANIZER]
 *                     default: "MEMBER"
 *                   avatar:
 *                     type: string
 *                     format: binary
 *                     description: Non utilisé pour les membres existants
 *               - type: object
 *                 required:
 *                   - memberType
 *                   - provisionalData
 *                 properties:
 *                   memberType:
 *                     type: string
 *                     enum: [provisional]
 *                     example: "provisional"
 *                   provisionalData:
 *                     type: string
 *                     description: "Objet JSON stringifié contenant les données du membre provisoire"
 *                     example: '{"firstName": "Amadou", "lastName": "Diallo", "phone": "789001122", "gender": "MALE"}'
 *                   role:
 *                     type: string
 *                     enum: [ADMIN, FINANCIAL_MANAGER, MEMBER, PRESIDENT, VICE_PRESIDENT, SECRETARY_GENERAL, ORGANIZER]
 *                     default: "MEMBER"
 *                   avatar:
 *                     type: string
 *                     format: binary
 *                     description: Image d'avatar du membre provisoire (max 5MB)
 *     responses:
 *       201:
 *         description: Membre ajouté avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Membre ajouté avec succès"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     role:
 *                       type: string
 *                     memberNumber:
 *                       type: string
 *                       example: "MBRabc123001"
 *                     loginId:
 *                       type: string
 *       400:
 *         description: Données invalides
 *       403:
 *         description: Permissions insuffisantes
 *       409:
 *         description: Conflit (Utilisateur déjà membre, téléphone déjà utilisé, limite d'abonnement atteinte)
 */
router.post(
  "/:organizationId/members",
  uploadSingle("avatar"),
  parseNestedFormData,
  validate(createMembershipSchema),
  membershipController.create
);

/**
 * @swagger
 * /api/membership/{organizationId}/members:
 *   get:
 *     summary: Récupérer tous les membres d'une organisation
 *     description: |
 *       Retourne la liste des membres (avec compte ou provisoires) avec leurs données d'affichage unifiées (`displayInfo`).
 *       Supporte la pagination et le filtrage.
 *     tags: [Memberships]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, SUSPENDED]
 *         description: Filtrer par statut
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [ADMIN, FINANCIAL_MANAGER, MEMBER, PRESIDENT, VICE_PRESIDENT, SECRETARY_GENERAL, ORGANIZER]
 *         description: Filtrer par rôle
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Recherche par nom, prénom, téléphone ou numéro de membre
 *       - in: query
 *         name: gender
 *         schema:
 *           type: string
 *           enum: [MALE, FEMALE]
 *         description: Filtrer par genre
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Liste des membres récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     members:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           displayInfo:
 *                             type: object
 *                             description: "Données unifiées (qu'il ait un compte ou non)"
 *                             properties:
 *                               firstName:
 *                                 type: string
 *                               lastName:
 *                                 type: string
 *                               phone:
 *                                 type: string
 *                               hasAccount:
 *                                 type: boolean
 *                               isProvisional:
 *                                 type: boolean
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         pages:
 *                           type: integer
 *       403:
 *         description: Accès non autorisé à cette organisation
 */
router.get(
  "/:organizationId/members",
  validate(getMembersSchema),
  membershipController.getAll
);

// ─── Routes avec :id ──────────────────────────────────────────

/**
 * @swagger
 * /api/membership/{organizationId}/members/{id}:
 *   get:
 *     summary: Récupérer un membre spécifique
 *     description: Retourne les détails complets d'un membership, enrichis avec les infos d'affichage (`displayInfo`) et les compteurs (contributions, dettes).
 *     tags: [Memberships]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du membership
 *     responses:
 *       200:
 *         description: Détails du membre
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     role:
 *                       type: string
 *                     displayInfo:
 *                       type: object
 *                     profile:
 *                       type: object
 *                       nullable: true
 *                     _count:
 *                       type: object
 *                       properties:
 *                         contributions:
 *                           type: integer
 *                         debts:
 *                           type: integer
 *       403:
 *         description: Accès non autorisé
 *       404:
 *         description: Membre non trouvé
 */
router.get(
  "/:organizationId/members/:id",
  validate(membershipParamSchema),
  membershipController.getOne
);

/**
 * @swagger
 * /api/membership/{organizationId}/members/{id}:
 *   put:
 *     summary: Mettre à jour les informations d'un membre
 *     description: Permet de modifier le rôle ou le numéro de membre. (Nécessite rôle ADMIN).
 *     tags: [Memberships]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [ADMIN, FINANCIAL_MANAGER, MEMBER, PRESIDENT, VICE_PRESIDENT, SECRETARY_GENERAL, ORGANIZER]
 *               memberNumber:
 *                 type: string
 *               joinDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Membre mis à jour avec succès
 *       403:
 *         description: Permissions insuffisantes
 *       404:
 *         description: Membre non trouvé
 */
router.put(
  "/:organizationId/members/:id",
  validate(updateMembershipSchema),
  membershipController.update
);

/**
 * @swagger
 * /api/membership/{organizationId}/members/{id}/provisional:
 *   put:
 *     summary: Mettre à jour un membre provisoire
 *     description: |
 *       Permet de modifier les données d'un membre qui n'a pas encore de compte utilisateur.
 *       Si le membre possède un compte (`hasAccount: true`), cette route renverra une erreur.
 *     tags: [Memberships]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: "Moussa"
 *               lastName:
 *                 type: string
 *                 example: "Fall"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "moussa@email.com"
 *               phone:
 *                 type: string
 *                 example: "789001122"
 *     responses:
 *       200:
 *         description: Membre provisoire mis à jour
 *       403:
 *         description: Permissions insuffisantes
 *       404:
 *         description: Membre non trouvé
 *       409:
 *         description: Impossible de modifier (le membre a déjà un compte lié)
 */
router.put(
  "/:organizationId/members/:id/provisional",
  validate(updateProvisionalMemberSchema),
  membershipController.updateProvisional
);

/**
 * @swagger
 * /api/membership/{organizationId}/members/{id}/status:
 *   patch:
 *     summary: Mettre à jour le statut d'un membre
 *     description: Active, désactive ou suspend un membre au sein de l'organisation. (Nécessite rôle ADMIN).
 *     tags: [Memberships]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, INACTIVE, SUSPENDED]
 *                 example: "SUSPENDED"
 *     responses:
 *       200:
 *         description: Statut du membre mis à jour avec succès
 *       403:
 *         description: Permissions insuffisantes
 */
router.patch(
  "/:organizationId/members/:id/status",
  validate(updateMembershipStatusSchema),
  membershipController.updateStatus
);

/**
 * @swagger
 * /api/membership/{organizationId}/members/{id}/role:
 *   patch:
 *     summary: Mettre à jour le rôle d'un membre
 *     description: |
 *       Modifie le rôle d'un membre. Un admin ne peut pas modifier son propre rôle.
 *       (Nécessite rôle ADMIN).
 *     tags: [Memberships]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [ADMIN, FINANCIAL_MANAGER, MEMBER, PRESIDENT, VICE_PRESIDENT, SECRETARY_GENERAL, ORGANIZER]
 *                 example: "FINANCIAL_MANAGER"
 *     responses:
 *       200:
 *         description: Rôle du membre mis à jour avec succès
 *       403:
 *         description: Permissions insuffisantes ou tentative de modification de son propre rôle
 */
router.patch(
  "/:organizationId/members/:id/role",
  validate(updateMembershipRoleSchema),
  membershipController.updateRole
);

/**
 * @swagger
 * /api/membership/{organizationId}/members/{id}:
 *   delete:
 *     summary: Supprimer un membre d'une organisation
 *     description: |
 *       Retire définitivement un membre de l'organisation et décrémente le compteur d'abonnement.
 *       Il est impossible de se supprimer soi-même.
 *       (Nécessite rôle ADMIN).
 *     tags: [Memberships]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Membre supprimé avec succès
 *       403:
 *         description: Permissions insuffisantes ou tentative de se supprimer soi-même
 *       404:
 *         description: Membre non trouvé dans cette organisation
 */
router.delete(
  "/:organizationId/members/:id",
  validate(membershipParamSchema),
  membershipController.delete
);

export default router;