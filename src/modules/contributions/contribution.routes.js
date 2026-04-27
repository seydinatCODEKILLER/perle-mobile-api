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
  planMembersStatusSchema,
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
  contributionController.getAll,
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
  contributionController.getMyContributions,
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
  contributionController.getMemberContributions,
);

/**
 * @swagger
 * /api/contributions/{organizationId}/plans/{planId}/members-status:
 *   get:
 *     summary: Récupérer le statut de cotisation des membres pour un plan
 *     description: |
 *       Retourne deux listes — les membres qui ont cotisé (PAID ou PARTIAL)
 *       et ceux qui n'ont pas encore cotisé — pour un plan de cotisation donné.
 *       Accessible uniquement aux ADMIN et FINANCIAL_MANAGER.
 *     tags: [Contributions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         description: ID de l'organisation
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: planId
 *         required: true
 *         description: ID du plan de cotisation
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Statut des membres récupéré avec succès
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
 *                   example: Statut des membres récupéré avec succès
 *                 data:
 *                   type: object
 *                   properties:
 *                     planId:
 *                       type: string
 *                       format: uuid
 *                       example: "123e4567-e89b-12d3-a456-426614174000"
 *                     totalMembers:
 *                       type: integer
 *                       example: 42
 *                     paidCount:
 *                       type: integer
 *                       example: 30
 *                     unpaidCount:
 *                       type: integer
 *                       example: 12
 *                     paid:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/PlanMemberEntry'
 *                     unpaid:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/PlanMemberEntry'
 *       403:
 *         description: Accès non autorisé — ADMIN ou FINANCIAL_MANAGER requis
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Organisation ou plan introuvable
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * components:
 *   schemas:
 *     MemberDisplayInfo:
 *       type: object
 *       properties:
 *         firstName:
 *           type: string
 *           nullable: true
 *           example: "Amadou"
 *         lastName:
 *           type: string
 *           nullable: true
 *           example: "Diallo"
 *         email:
 *           type: string
 *           nullable: true
 *           example: "amadou@example.com"
 *         phone:
 *           type: string
 *           nullable: true
 *           example: "+221771234567"
 *         avatar:
 *           type: string
 *           nullable: true
 *         gender:
 *           type: string
 *           nullable: true
 *           enum: [MALE, FEMALE]
 *         hasAccount:
 *           type: boolean
 *           example: true
 *         isProvisional:
 *           type: boolean
 *           example: false
 *
 *     PlanMemberContribution:
 *       type: object
 *       nullable: true
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         status:
 *           type: string
 *           enum: [PENDING, PAID, PARTIAL, OVERDUE, CANCELLED]
 *           example: PAID
 *         amount:
 *           type: number
 *           example: 5000
 *         amountPaid:
 *           type: number
 *           example: 5000
 *         dueDate:
 *           type: string
 *           format: date-time
 *           example: "2024-03-01T00:00:00.000Z"
 *
 *     PlanMemberEntry:
 *       type: object
 *       properties:
 *         membershipId:
 *           type: string
 *           format: uuid
 *           example: "123e4567-e89b-12d3-a456-426614174000"
 *         memberNumber:
 *           type: string
 *           nullable: true
 *           example: "MBR-001"
 *         displayInfo:
 *           $ref: '#/components/schemas/MemberDisplayInfo'
 *         contribution:
 *           $ref: '#/components/schemas/PlanMemberContribution'
 *
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: "Accès non autorisé à cette organisation"
 */
router.get(
  "/:organizationId/plans/:planId/members-status",
  validate(planMembersStatusSchema),
  contributionController.getPlanMembersStatus,
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
  contributionController.getOne,
);

/**
 * @swagger
 * /api/contributions/{organizationId}/contribution/{id}/mark-paid:
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
  "/:organizationId/contribution/:id/mark-paid",
  validate(markAsPaidSchema),
  contributionController.markAsPaid,
);

/**
 * @swagger
 * /api/contributions/{organizationId}/contribution/{id}/partial-payment:
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
  "/:organizationId/contribution/:id/partial-payment",
  validate(addPartialPaymentSchema),
  contributionController.addPartialPayment,
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
  contributionController.cancel,
);

export default router;
