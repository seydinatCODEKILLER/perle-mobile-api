import { Router } from "express";
import { DebtController } from "./debt.controller.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { protect } from "../../shared/middlewares/auth.middleware.js";
import {
  createDebtSchema,
  addRepaymentSchema,
  updateDebtStatusSchema,
  cancelDebtSchema,
  debtParamSchema,
  orgParamSchema,
  listDebtsSchema,
  memberDebtsSchema,
  myDebtsSchema,
} from "./debt.schema.js";

const router = Router();
const debtController = new DebtController();

router.use(protect());

// ─── Routes sans :id — AVANT les routes avec :id ─────────────

/**
 * @swagger
 * /api/debts/{organizationId}/summary:
 *   get:
 *     summary: Résumé global des dettes
 *     description: Retourne les statistiques agrégées des dettes de l'organisation (total, payé, restant, etc.)
 *     tags: [Debts]
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
 *         description: Résumé des dettes
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
 *                     totalDebts:
 *                       type: number
 *                     totalAmount:
 *                       type: number
 *                     totalPaid:
 *                       type: number
 *                     totalRemaining:
 *                       type: number
 *       403:
 *         description: Accès non autorisé
 */
router.get(
  "/:organizationId/summary",
  validate(orgParamSchema),
  debtController.getSummary
);

/**
 * @swagger
 * /api/debts/{organizationId}/my-debts:
 *   get:
 *     summary: Mes dettes (membre connecté)
 *     description: Récupérer les dettes de l'utilisateur connecté pour cette organisation
 *     tags: [Debts]
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
 *           enum: [ACTIVE, PARTIALLY_PAID, PAID, OVERDUE, CANCELLED]
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
 *         description: Dettes de l'utilisateur connecté
 */
router.get(
  "/:organizationId/my-debts",
  validate(myDebtsSchema),
  debtController.getMyDebts
);

/**
 * @swagger
 * /api/debts/{organizationId}/members/{membershipId}/debt:
 *   get:
 *     summary: Dettes d'un membre spécifique
 *     tags: [Debts]
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
 *           enum: [ACTIVE, PARTIALLY_PAID, PAID, OVERDUE, CANCELLED]
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
 *         description: Dettes du membre
 */
router.get(
  "/:organizationId/members/:membershipId/debt",
  validate(memberDebtsSchema),
  debtController.getMemberDebts
);

/**
 * @swagger
 * /api/debts/{organizationId}:
 *   get:
 *     summary: Lister les dettes d'une organisation
 *     tags: [Debts]
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
 *           enum: [ACTIVE, PARTIALLY_PAID, PAID, OVERDUE, CANCELLED]
 *       - in: query
 *         name: membershipId
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
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
 *         description: Liste des dettes
 */
router.get(
  "/:organizationId",
  validate(listDebtsSchema),
  debtController.getAll
);

/**
 * @swagger
 * /api/debts/{organizationId}:
 *   post:
 *     summary: Créer une nouvelle dette pour un membre
 *     tags: [Debts]
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
 *               - membershipId
 *               - title
 *               - initialAmount
 *             properties:
 *               membershipId:
 *                 type: string
 *                 description: ID du membership du membre débiteur
 *               title:
 *                 type: string
 *                 example: "Avance sur frais de déplacement"
 *               description:
 *                 type: string
 *                 example: "Avance de juillet pour le voyage à Kaolack"
 *               initialAmount:
 *                 type: number
 *                 example: 50000
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-08-31T00:00:00.000Z"
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, PARTIALLY_PAID, PAID, OVERDUE, CANCELLED]
 *                 default: ACTIVE
 *     responses:
 *       201:
 *         description: Dette créée avec succès
 *       403:
 *         description: Permissions insuffisantes
 */
router.post(
  "/:organizationId",
  validate(createDebtSchema),
  debtController.create
);

// ─── Routes avec :id ──────────────────────────────────────────

/**
 * @swagger
 * /api/debts/{organizationId}/debt/{id}:
 *   get:
 *     summary: Obtenir une dette par ID
 *     tags: [Debts]
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
 *         description: ID de la dette
 *     responses:
 *       200:
 *         description: Détails de la dette
 *       404:
 *         description: Dette non trouvée
 */
router.get(
  "/:organizationId/debt/:id",
  validate(debtParamSchema),
  debtController.getOne
);

/**
 * @swagger
 * /api/debts/{organizationId}/debt/{id}/repayments:
 *   get:
 *     summary: Historique des remboursements
 *     description: Récupérer l'historique complet des remboursements effectués pour cette dette
 *     tags: [Debts]
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
 *         description: Historique des remboursements
 */
router.get(
  "/:organizationId/debt/:id/repayments",
  validate(debtParamSchema),
  debtController.getRepayments
);

/**
 * @swagger
 * /api/debts/{organizationId}/debt/{id}/add-repayment:
 *   post:
 *     summary: Ajouter un remboursement
 *     description: Permet d'enregistrer un paiement partiel ou total sur une dette existante. Met à jour le wallet si applicable.
 *     tags: [Debts]
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
 *                 example: 15000
 *               paymentMethod:
 *                 type: string
 *                 enum: [CASH, MOBILE_MONEY, BANK_TRANSFER, CHECK, CREDIT_CARD]
 *                 example: "MOBILE_MONEY"
 *     responses:
 *       200:
 *         description: Remboursement ajouté avec succès
 *       400:
 *         description: Montant invalide ou supérieur au restant dû
 *       403:
 *         description: Permissions insuffisantes
 */
router.post(
  "/:organizationId/debt/:id/add-repayment",
  validate(addRepaymentSchema),
  debtController.addRepayment
);

/**
 * @swagger
 * /api/debts/{organizationId}/debt/{id}/status:
 *   patch:
 *     summary: Mettre à jour le statut d'une dette
 *     tags: [Debts]
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
 *                 enum: [ACTIVE, PARTIALLY_PAID, PAID, OVERDUE, CANCELLED]
 *                 example: "OVERDUE"
 *     responses:
 *       200:
 *         description: Statut mis à jour
 */
router.patch(
  "/:organizationId/debt/:id/status",
  validate(updateDebtStatusSchema),
  debtController.updateStatus
);

/**
 * @swagger
 * /api/debts/{organizationId}/{id}/cancel:
 *   put:
 *     summary: Annuler une dette (admin uniquement)
 *     description: Annule une dette et ajuste le wallet si des remboursements avaient été effectués.
 *     tags: [Debts]
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
 *                 example: "Erreur de saisie lors de la création"
 *     responses:
 *       200:
 *         description: Dette annulée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 status:
 *                   type: string
 *                   example: "CANCELLED"
 *                 remainingAmount:
 *                   type: number
 *                   example: 0
 *       400:
 *         description: Dette déjà annulée
 *       403:
 *         description: Accès non autorisé (admin requis)
 *       404:
 *         description: Dette non trouvée
 */
router.put(
  "/:organizationId/:id/cancel",
  validate(cancelDebtSchema),
  debtController.cancel
);

export default router;