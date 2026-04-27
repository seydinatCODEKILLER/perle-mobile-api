import { Router } from "express";
import { NotificationController } from "./notification.controller.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { protect } from "../../shared/middlewares/auth.middleware.js";
import {
  sendNotificationSchema,
  getNotificationSchema,
  listNotificationsSchema,
  orgParamSchema,
} from "./notification.schema.js";

const router = Router();
const notificationController = new NotificationController();

// Toutes les routes nécessitent d'être authentifiées
router.use(protect());

// ─── Routes spécifiques (AVANT /:id pour éviter les conflits) ──

/**
 * @swagger
 * /api/notifications/{organizationId}/unread-count:
 *   get:
 *     summary: Récupérer le nombre de notifications non lues
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     description: Retourne le nombre de notifications PENDING ou SENT pour l'utilisateur connecté dans cette organisation.
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de l'organisation
 *     responses:
 *       200:
 *         description: Nombre de non lues récupéré avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     count:
 *                       type: integer
 *                       example: 5
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Membre non trouvé ou inactif dans cette organisation
 */
router.get(
  "/:organizationId/unread-count",
  validate(orgParamSchema),
  notificationController.getUnreadCount,
);

/**
 * @swagger
 * /api/notifications/{organizationId}/read-all:
 *   patch:
 *     summary: Marquer toutes les notifications comme lues
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     description: Passe le statut de toutes les notifications de l'utilisateur (PENDING/SENT) à DELIVERED.
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de l'organisation
 *     responses:
 *       200:
 *         description: Toutes les notifications ont été marquées comme lues
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Toutes les notifications ont été marquées comme lues"
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Accès non autorisé
 */
router.patch(
  "/:organizationId/read-all",
  validate(orgParamSchema),
  notificationController.markAllAsRead,
);

/**
 * @swagger
 * /api/notifications/{organizationId}/send:
 *   post:
 *     summary: Envoyer une notification manuelle (Réservé aux admins)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Permet à un administrateur d'envoyer une notification.
 *       - Si `sendToAll` est true, la notification est envoyée à tous les membres actifs.
 *       - Si `sendToAll` est false, `membershipId` est requis pour cibler un membre spécifique.
 *       Les canaux (EMAIL, SMS, etc.) sont définis automatiquement selon les paramètres de l'organisation.
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
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - title
 *               - message
 *               - priority
 *               - sendToAll
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [CONTRIBUTION_REMINDER, DEBT_REMINDER, PAYMENT_CONFIRMATION, MEMBERSHIP_UPDATE, SYSTEM_ALERT]
 *                 example: "SYSTEM_ALERT"
 *               title:
 *                 type: string
 *                 example: "Assemblée Générale"
 *               message:
 *                 type: string
 *                 example: "Chers membres, l'AG aura lieu ce samedi à 10h."
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, URGENT]
 *                 default: "MEDIUM"
 *               sendToAll:
 *                 type: boolean
 *                 example: true
 *               membershipId:
 *                 type: string
 *                 description: "Requis si sendToAll est false. ID du membre ciblé."
 *     responses:
 *       200:
 *         description: Notification envoyée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   description: Réponse si sendToAll = true
 *                   properties:
 *                     success:
 *                       type: boolean
 *                     data:
 *                       type: object
 *                       properties:
 *                         message:
 *                           type: string
 *                           example: "Notification envoyée à 15 membre(s)"
 *                         count:
 *                           type: integer
 *                           example: 15
 *                 - type: object
 *                   description: Réponse si sendToAll = false
 *                   properties:
 *                     success:
 *                       type: boolean
 *                     data:
 *                       $ref: '#/components/schemas/Notification'
 *       400:
 *         description: "Données invalides (ex: membershipId manquant)"
 *       403:
 *         description: Permissions insuffisantes (non-admin)
 *       404:
 *         description: Membre cible non trouvé
 */
router.post(
  "/:organizationId/send",
  validate(sendNotificationSchema),
  notificationController.send,
);

// ─── Routes avec paramètres dynamiques ─────────────────────────

/**
 * @swagger
 * /api/notifications/{organizationId}:
 *   get:
 *     summary: Liste des notifications de l'utilisateur connecté
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de l'organisation
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 50
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [CONTRIBUTION_REMINDER, DEBT_REMINDER, PAYMENT_CONFIRMATION, MEMBERSHIP_UPDATE, SYSTEM_ALERT]
 *         description: Filtrer par type de notification
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, SENT, FAILED, DELIVERED]
 *         description: Filtrer par statut
 *     responses:
 *       200:
 *         description: Liste paginée des notifications
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Notification'
 *                     total:
 *                       type: integer
 *                       example: 42
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 10
 *                     totalPages:
 *                       type: integer
 *                       example: 5
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Accès non autorisé
 */
router.get(
  "/:organizationId",
  validate(listNotificationsSchema),
  notificationController.getMyNotifications,
);

/**
 * @swagger
 * /api/notifications/{organizationId}/{id}/read:
 *   patch:
 *     summary: Marquer une notification spécifique comme lue
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Passe le statut d'une notification individuelle à DELIVERED.
 *       L'opération est idempotente (rien ne se passe si c'est déjà DELIVERED).
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de l'organisation
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la notification
 *     responses:
 *       200:
 *         description: Notification marquée comme lue
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Notification'
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Accès non autorisé (la notification n'appartient pas à cet utilisateur)
 *       404:
 *         description: Notification non trouvée
 */
router.patch(
  "/:organizationId/:id/read",
  validate(getNotificationSchema),
  notificationController.markAsRead,
);

/**
 * @swagger
 * /api/notifications/{organizationId}/{id}:
 *   delete:
 *     summary: Supprimer une notification spécifique
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     description: Supprime définitivement une notification appartenant à l'utilisateur connecté.
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de l'organisation
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la notification
 *     responses:
 *       200:
 *         description: Notification supprimée avec succès
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
 *                   example: "Notification supprimée avec succès"
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Accès non autorisé (la notification n'appartient pas à cet utilisateur)
 *       404:
 *         description: Notification non trouvée
 */
router.delete(
  "/:organizationId/:id",
  validate(getNotificationSchema), // On réutilise le schéma qui valide déjà organizationId et id
  notificationController.delete,
);

export default router;
