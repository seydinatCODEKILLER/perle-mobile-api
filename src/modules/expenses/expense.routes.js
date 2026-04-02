// src/modules/expenses/expense.routes.js
import { Router } from "express";
import { ExpenseController } from "./expense.controller.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { protect } from "../../shared/middlewares/auth.middleware.js";
import {
  createExpenseSchema,
  approveExpenseSchema,
  rejectExpenseSchema,
  payExpenseSchema,
  cancelExpenseSchema,
  getExpensesSchema,
  getExpenseByIdSchema,
  getExpenseStatsSchema,
} from "./expense.schema.js";

const router = Router();
const expenseController = new ExpenseController();

// Toutes les routes nécessitent d'être authentifiées
router.use(protect());

// ─── Routes sans /:expenseId — AVANT les routes avec param ────

/**
 * @swagger
 * /api/expenses/{organizationId}:
 *   get:
 *     summary: Lister toutes les dépenses avec filtres
 *     tags: [Expenses]
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
 *           enum: [PENDING, APPROVED, REJECTED, PAID, CANCELLED]
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [EVENT, SOCIAL, ADMINISTRATIVE, MAINTENANCE, DONATION, INVESTMENT, OPERATIONAL, OTHER]
 *       - in: query
 *         name: createdById
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
 *         description: Liste des dépenses avec pagination
 */
router.get(
  "/:organizationId",
  validate(getExpensesSchema),
  expenseController.getAll,
);

/**
 * @swagger
 * /api/expenses/{organizationId}/stats:
 *   get:
 *     summary: Statistiques des dépenses
 *     tags: [Expenses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
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
 *     responses:
 *       200:
 *         description: Statistiques des dépenses
 */
router.get(
  "/:organizationId/stats",
  validate(getExpenseStatsSchema),
  expenseController.getStats,
);

/**
 * @swagger
 * /api/expenses/{organizationId}/create:
 *   post:
 *     summary: Créer une nouvelle dépense
 *     tags: [Expenses]
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
 *               - title
 *               - amount
 *               - category
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               amount:
 *                 type: number
 *               category:
 *                 type: string
 *                 enum: [EVENT, SOCIAL, ADMINISTRATIVE, MAINTENANCE, DONATION, INVESTMENT, OPERATIONAL, OTHER]
 *               expenseDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Dépense créée avec succès
 */
router.post(
  "/:organizationId/create",
  validate(createExpenseSchema),
  expenseController.create,
);

// ─── Routes avec /:expenseId ──────────────────────────────────

/**
 * @swagger
 * /api/expenses/{organizationId}/{expenseId}:
 *   get:
 *     summary: Récupérer une dépense par ID
 *     tags: [Expenses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: expenseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Détails de la dépense
 */
router.get(
  "/:organizationId/:expenseId",
  validate(getExpenseByIdSchema),
  expenseController.getOne,
);

/**
 * @swagger
 * /api/expenses/{organizationId}/{expenseId}/approve:
 *   put:
 *     summary: Approuver une dépense
 *     tags: [Expenses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: expenseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Dépense approuvée
 */
router.put(
  "/:organizationId/:expenseId/approve",
  validate(approveExpenseSchema),
  expenseController.approve,
);

/**
 * @swagger
 * /api/expenses/{organizationId}/{expenseId}/reject:
 *   put:
 *     summary: Rejeter une dépense
 *     tags: [Expenses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: expenseId
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
 *     responses:
 *       200:
 *         description: Dépense rejetée
 */
router.put(
  "/:organizationId/:expenseId/reject",
  validate(rejectExpenseSchema),
  expenseController.reject,
);

/**
 * @swagger
 * /api/expenses/{organizationId}/{expenseId}/pay:
 *   post:
 *     summary: Payer une dépense approuvée
 *     tags: [Expenses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: expenseId
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
 *               - paymentMethod
 *             properties:
 *               paymentMethod:
 *                 type: string
 *                 enum: [CASH, MOBILE_MONEY, BANK_TRANSFER, CHECK, CREDIT_CARD]
 *               reference:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Dépense payée avec succès
 */
router.post(
  "/:organizationId/:expenseId/pay",
  validate(payExpenseSchema),
  expenseController.pay,
);

/**
 * @swagger
 * /api/expenses/{organizationId}/{expenseId}/cancel:
 *   put:
 *     summary: Annuler une dépense (non payée)
 *     tags: [Expenses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: expenseId
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
 *     responses:
 *       200:
 *         description: Dépense annulée
 */
router.put(
  "/:organizationId/:expenseId/cancel",
  validate(cancelExpenseSchema),
  expenseController.cancel,
);

export default router;
