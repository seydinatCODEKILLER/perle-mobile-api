import { Router } from "express";
import { ContributionController } from "./contribution.controller.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { protect } from "../../shared/middlewares/auth.middleware.js";
import {
  listContributionsSchema,
  contributionParamSchema,
  markAsPaidSchema,
  addPartialPaymentSchema,
  memberContributionsSchema,
  myContributionsSchema,
  cancelContributionSchema,
} from "./contribution.schema.js";

const router = Router();
const contributionController = new ContributionController();

router.use(protect());

// ─── Routes LIST ─────────────────────────────────────────────

/**
 * @swagger
 * /api/contributions/{organizationId}:
 *   get:
 *     summary: Récupérer toutes les cotisations d'une organisation
 *     tags: [Contributions]
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
 *           enum: [PENDING, PAID, PARTIAL, OVERDUE, CANCELLED]
 *       - in: query
 *         name: membershipId
 *         schema:
 *           type: string
 *       - in: query
 *         name: contributionPlanId
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
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
 *         description: Liste des cotisations
 */
router.get(
  "/:organizationId",
  validate(listContributionsSchema),
  contributionController.getAll
);

/**
 * @swagger
 * /api/contributions/{organizationId}/my-contributions:
 *   get:
 *     summary: Récupérer les cotisations de l'utilisateur connecté
 *     tags: [Contributions]
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
 *           enum: [PENDING, PAID, PARTIAL, OVERDUE, CANCELLED]
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
 *         description: Cotisations de l'utilisateur connecté
 */
router.get(
  "/:organizationId/my-contributions",
  validate(myContributionsSchema),
  contributionController.getMyContributions
);

/**
 * @swagger
 * /api/contributions/{organizationId}/members/{membershipId}/contributions:
 *   get:
 *     summary: Récupérer les cotisations d'un membre spécifique
 *     tags: [Contributions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: membershipId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, PAID, PARTIAL, OVERDUE, CANCELLED]
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
 *         description: Cotisations du membre
 */
router.get(
  "/:organizationId/members/:membershipId/contributions",
  validate(memberContributionsSchema),
  contributionController.getMemberContributions
);

// ─── Routes SINGLE ──────────────────────────────────────────

/**
 * @swagger
 * /api/contributions/{organizationId}/contribution/{id}:
 *   get:
 *     summary: Récupérer une cotisation spécifique
 *     tags: [Contributions]
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
 *         description: Détails de la cotisation
 */
router.get(
  "/:organizationId/contribution/:id",
  validate(contributionParamSchema),
  contributionController.getOne
);

/**
 * @swagger
 * /api/contributions/{organizationId}/contributions/{id}/mark-paid:
 *   patch:
 *     summary: Marquer une cotisation comme payée
 *     tags: [Contributions]
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
 *               - amountPaid
 *               - paymentMethod
 *             properties:
 *               amountPaid:
 *                 type: number
 *               paymentMethod:
 *                 type: string
 *                 enum: [CASH, MOBILE_MONEY, BANK_TRANSFER, CHECK, CREDIT_CARD]
 *     responses:
 *       200:
 *         description: Cotisation marquée comme payée
 */
router.patch(
  "/:organizationId/contributions/:id/mark-paid",
  validate(markAsPaidSchema),
  contributionController.markAsPaid
);

/**
 * @swagger
 * /api/contributions/{organizationId}/contributions/{id}/partial-payment:
 *   post:
 *     summary: Ajouter un paiement partiel
 *     tags: [Contributions]
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
 *               - amount
 *               - paymentMethod
 *             properties:
 *               amount:
 *                 type: number
 *               paymentMethod:
 *                 type: string
 *                 enum: [CASH, MOBILE_MONEY, BANK_TRANSFER, CHECK, CREDIT_CARD]
 *     responses:
 *       200:
 *         description: Paiement partiel ajouté
 */
router.post(
  "/:organizationId/contributions/:id/partial-payment",
  validate(addPartialPaymentSchema),
  contributionController.addPartialPayment
);

/**
 * @swagger
 * /api/contributions/{organizationId}/{id}/cancel:
 *   patch:
 *     summary: Annuler une cotisation (admin uniquement)
 *     description: Annule une cotisation. Si un paiement avait été effectué, le montant est déduit du wallet de l'organisation.
 *     tags: [Contributions]
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
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Raison de l'annulation
 *     responses:
 *       200:
 *         description: Cotisation annulée avec succès
 *       400:
 *         description: Cotisation déjà annulée
 *       403:
 *         description: Accès non autorisé (admin requis)
 *       404:
 *         description: Cotisation non trouvée
 */
router.put(
  "/:organizationId/:id/cancel",
  validate(cancelContributionSchema),
  contributionController.cancel
);

export default router;