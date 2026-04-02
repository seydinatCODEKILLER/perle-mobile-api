// src/modules/subscriptions/subscription.routes.js
import { Router } from "express";
import { SubscriptionController } from "./subscription.controller.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { protect } from "../../shared/middlewares/auth.middleware.js";
import {
  orgParamSchema,
  updateSubscriptionSchema,
  updateSubscriptionStatusSchema,
  changePlanSchema,
} from "./subscription.schema.js";

const router = Router();
const subController = new SubscriptionController();

// Toutes les routes nécessitent d'être authentifiées
router.use(protect());

// ─── Routes spécifiques AVANT la route paramétrée globale ────

/**
 * @swagger
 * /api/subscriptions/organizations/{organizationId}/plans:
 *   get:
 *     summary: Récupérer les plans d'abonnement disponibles
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Plans disponibles
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
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "free"
 *                       name:
 *                         type: string
 *                         enum: [FREE, BASIC, PREMIUM, ENTERPRISE]
 *                       displayName:
 *                         type: string
 *                         example: "Gratuit"
 *                       price:
 *                         type: number
 *                         example: 0
 *                       features:
 *                         type: object
 *                         properties:
 *                           maxMembers:
 *                             type: integer
 *                             example: 50
 */
router.get(
  "/organizations/:organizationId/plans",
  validate(orgParamSchema),
  subController.getAvailablePlans
);

/**
 * @swagger
 * /api/subscriptions/organizations/{organizationId}/usage:
 *   get:
 *     summary: Voir l'utilisation de l'abonnement
 *     description: Retourne les statistiques d'utilisation (membres, plans) et des recommandations de mise à niveau si nécessaire.
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Utilisation de l'abonnement
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
 *                     subscription:
 *                       $ref: '#/components/schemas/Subscription'
 *                     usage:
 *                       type: object
 *                       properties:
 *                         members:
 *                           type: object
 *                           properties:
 *                             current:
 *                               type: integer
 *                             max:
 *                               type: integer
 *                             percentage:
 *                               type: integer
 *                             status:
 *                               type: string
 *                               enum: [LOW, MEDIUM, HIGH]
 *                     recommendations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             enum: [WARNING, URGENT]
 *                           message:
 *                             type: string
 *                           action:
 *                             type: string
 *       403:
 *         description: Accès non autorisé
 */
router.get(
  "/organizations/:organizationId/usage",
  validate(orgParamSchema),
  subController.getUsage
);

/**
 * @swagger
 * /api/subscriptions/organizations/{organizationId}/status:
 *   patch:
 *     summary: Mettre à jour le statut de l'abonnement
 *     description: Permet de suspendre, réactiver ou annuler un abonnement (Admin uniquement).
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
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
 *                 enum: [ACTIVE, INACTIVE, SUSPENDED, CANCELLED, EXPIRED]
 *                 example: "SUSPENDED"
 *     responses:
 *       200:
 *         description: Statut mis à jour
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Subscription'
 *       400:
 *         description: Statut invalide
 *       403:
 *         description: Permissions insuffisantes (Admin requis)
 */
router.patch(
  "/organizations/:organizationId/status",
  validate(updateSubscriptionStatusSchema),
  subController.updateSubscriptionStatus
);

/**
 * @swagger
 * /api/subscriptions/organizations/{organizationId}/change-plan:
 *   post:
 *     summary: Changer de plan d'abonnement
 *     description: Change le plan de l'organisation. Vérifie automatiquement si le nombre de membres actuels est compatible avec le nouveau plan.
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
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
 *               - plan
 *             properties:
 *               plan:
 *                 type: string
 *                 enum: [FREE, BASIC, PREMIUM, ENTERPRISE]
 *                 example: "PREMIUM"
 *     responses:
 *       200:
 *         description: Plan changé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                     subscription:
 *                       $ref: '#/components/schemas/Subscription'
 *                     previousPlan:
 *                       type: string
 *                       example: "FREE"
 *                     nextBillingDate:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Plan invalide
 *       403:
 *         description: Permissions insuffisantes
 *       409:
 *         description: Conflit (Déjà sur ce plan, ou limite de membres dépassée pour le nouveau plan)
 */
router.post(
  "/organizations/:organizationId/change-plan",
  validate(changePlanSchema),
  subController.changePlan
);

// ─── Routes globales ─────────────────────────────────────────

/**
 * @swagger
 * /api/subscriptions/organizations/{organizationId}:
 *   get:
 *     summary: Récupérer l'abonnement d'une organisation
 *     description: Retourne les détails de l'abonnement actuel. Si aucun abonnement n'existe, un abonnement FREE par défaut est automatiquement créé.
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Détails de l'abonnement
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Subscription'
 *       403:
 *         description: Accès non autorisé à cette organisation
 */
router.get(
  "/organizations/:organizationId",
  validate(orgParamSchema),
  subController.getSubscription
);

/**
 * @swagger
 * /api/subscriptions/organizations/{organizationId}:
 *   put:
 *     summary: Mettre à jour l'abonnement
 *     description: Met à jour les champs configurables de l'abonnement (prix personnalisé, dates, limites). Pour un changement standard de plan, préférez l'endpoint dédié.
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
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
 *               plan:
 *                 type: string
 *                 enum: [FREE, BASIC, PREMIUM, ENTERPRISE]
 *               maxMembers:
 *                 type: integer
 *                 example: 250
 *               price:
 *                 type: number
 *                 example: 10000
 *               currency:
 *                 type: string
 *                 example: "XOF"
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Abonnement mis à jour
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Subscription'
 *       400:
 *         description: Données invalides ou aucun champ fourni
 *       403:
 *         description: Permissions insuffisantes
 */
router.put(
  "/organizations/:organizationId",
  validate(updateSubscriptionSchema),
  subController.updateSubscription
);

export default router;