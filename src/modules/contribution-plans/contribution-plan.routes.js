import { Router } from "express";
import { ContributionPlanController } from "./contribution-plan.controller.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { protect } from "../../shared/middlewares/auth.middleware.js";
import {
  createPlanSchema,
  updatePlanSchema,
  getPlanSchema,
  listPlansSchema,
  generateContributionsSchema,
  assignToMemberSchema,
} from "./contribution-plan.schema.js";

const router = Router();
const planController = new ContributionPlanController();

router.use(protect());

// ─── Routes sans :id ──────────────────────────────────────────

/**
 * @swagger
 * /api/contribution-plans/{organizationId}:
 *   post:
 *     summary: Créer un nouveau plan de cotisation
 *     tags: [Contribution Plans]
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
 *               - name
 *               - amount
 *               - frequency
 *               - startDate
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Cotisation Mensuelle Générale"
 *               description:
 *                 type: string
 *                 example: "Cotisation de base pour tous les membres"
 *               amount:
 *                 type: number
 *                 description: Montant par défaut (utilisé si pas de différence par genre)
 *                 example: 5000
 *               amountMale:
 *                 type: number
 *                 description: Montant spécifique pour les hommes (optionnel)
 *                 example: 5000
 *               amountFemale:
 *                 type: number
 *                 description: Montant spécifique pour les femmes (optionnel)
 *                 example: 2500
 *               frequency:
 *                 type: string
 *                 enum: [WEEKLY, MONTHLY, QUARTERLY, YEARLY, CUSTOM]
 *                 example: "MONTHLY"
 *               currency:
 *                 type: string
 *                 default: "XOF"
 *                 example: "XOF"
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-01-01T00:00:00.000Z"
 *               endDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-12-31T00:00:00.000Z"
 *               isActive:
 *                 type: boolean
 *                 default: true
 *                 example: true
 *     responses:
 *       201:
 *         description: Plan créé avec succès
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
 *                   example: "Plan créé avec succès"
 *                 data:
 *                   type: object
 *       400:
 *         description: Données invalides
 *       403:
 *         description: Permissions insuffisantes
 */
router.post(
  "/:organizationId",
  validate(createPlanSchema),
  planController.create
);

/**
 * @swagger
 * /api/contribution-plans/{organizationId}:
 *   get:
 *     summary: Récupérer tous les plans de cotisation d'une organisation
 *     tags: [Contribution Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filtrer par statut actif/inactif
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Rechercher par nom de plan
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
 *     responses:
 *       200:
 *         description: Liste des plans
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
 *                     plans:
 *                       type: array
 *                       items:
 *                         type: object
 *                     pagination:
 *                       type: object
 *       403:
 *         description: Accès non autorisé
 */
router.get(
  "/:organizationId",
  validate(listPlansSchema),
  planController.getAll
);

// ─── Routes avec :id ──────────────────────────────────────────

/**
 * @swagger
 * /api/contribution-plans/{organizationId}/plans/{id}:
 *   get:
 *     summary: Récupérer un plan de cotisation spécifique
 *     tags: [Contribution Plans]
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
 *         description: ID du plan de cotisation
 *     responses:
 *       200:
 *         description: Détails du plan
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
 *                     name:
 *                       type: string
 *                     amount:
 *                       type: number
 *                     frequency:
 *                       type: string
 *       404:
 *         description: Plan non trouvé
 */
router.get(
  "/:organizationId/plans/:id",
  validate(getPlanSchema),
  planController.getOne
);

/**
 * @swagger
 * /api/contribution-plans/{organizationId}/plans/{id}:
 *   put:
 *     summary: Mettre à jour un plan de cotisation
 *     tags: [Contribution Plans]
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
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               amount:
 *                 type: number
 *               amountMale:
 *                 type: number
 *               amountFemale:
 *                 type: number
 *               frequency:
 *                 type: string
 *                 enum: [WEEKLY, MONTHLY, QUARTERLY, YEARLY, CUSTOM]
 *               currency:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Plan mis à jour
 *       400:
 *         description: Données invalides
 *       403:
 *         description: Permissions insuffisantes
 *       404:
 *         description: Plan non trouvé
 */
router.put(
  "/:organizationId/plans/:id",
  validate(updatePlanSchema),
  planController.update
);

/**
 * @swagger
 * /api/contribution-plans/{organizationId}/plans/{id}/toggle-status:
 *   patch:
 *     summary: Activer/désactiver un plan de cotisation
 *     tags: [Contribution Plans]
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
 *         description: Statut modifié avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   example: "Statut du plan mis à jour"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     isActive:
 *                       type: boolean
 *       404:
 *         description: Plan non trouvé
 */
router.patch(
  "/:organizationId/plans/:id/toggle-status",
  validate(getPlanSchema),
  planController.toggleStatus
);

/**
 * @swagger
 * /api/contribution-plans/{organizationId}/plans/{id}/generate-contributions:
 *   post:
 *     summary: Générer des cotisations pour tous les membres
 *     description: |
 *       Crée une contribution en attente (PENDING) pour chaque membre actif de l'organisation 
 *       assigné à ce plan, en fonction de la fréquence et des montants définis.
 *     tags: [Contribution Plans]
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
 *         description: ID du plan de cotisation
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               force:
 *                 type: boolean
 *                 description: Forcer la génération même si des cotisations existent déjà pour la période en cours
 *                 default: false
 *               dueDateOffset:
 *                 type: integer
 *                 description: Décalage en jours pour la date d'échéance (par rapport à la date de génération)
 *                 default: 30
 *     responses:
 *       200:
 *         description: Cotisations générées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   example: "X cotisations générées"
 *                 data:
 *                   type: object
 *                   properties:
 *                     generatedCount:
 *                       type: integer
 *                     skippedCount:
 *                       type: integer
 *       403:
 *         description: Permissions insuffisantes
 */
router.post(
  "/:organizationId/plans/:id/generate-contributions",
  validate(generateContributionsSchema),
  planController.generateContributions
);

/**
 * @swagger
 * /api/contribution-plans/{organizationId}/plans/{id}/assign-to-member:
 *   post:
 *     summary: Assigner un plan à un membre spécifique
 *     tags: [Contribution Plans]
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
 *         description: ID du plan de cotisation
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - membershipId
 *             properties:
 *               membershipId:
 *                 type: string
 *                 description: ID du membership auquel assigner le plan
 *                 example: "60d5ec49f1201a4a9c2e2f1a"
 *     responses:
 *       201:
 *         description: Plan assigné au membre avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   example: "Plan assigné au membre"
 *                 data:
 *                   type: object
 *       400:
 *         description: membershipId manquant ou invalide
 *       409:
 *         description: Le membre est déjà assigné à ce plan
 */
router.post(
  "/:organizationId/plans/:id/assign-to-member",
  validate(assignToMemberSchema),
  planController.assignToMember
);

export default router;