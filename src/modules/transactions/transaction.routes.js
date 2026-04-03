import { Router } from "express";
import { TransactionController } from "./transaction.controller.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { protect } from "../../shared/middlewares/auth.middleware.js";
import {
  listTransactionsSchema,
  searchTransactionsSchema,
  transactionParamSchema,
  memberTransactionsSchema,
  myTransactionsSchema,
  statsByTypeSchema,
  orgParamSchema,
} from "./transaction.schema.js";

const router = Router();
const transactionController = new TransactionController();

router.use(protect());

// ─── Routes de liste & recherche ───────────────────────────────

/**
 * @swagger
 * /api/transactions/{organizationId}:
 *   get:
 *     summary: Lister toutes les transactions avec filtres
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [CONTRIBUTION, DEBT_REPAYMENT, FINE, DONATION, EXPENSE, OTHER]
 *       - in: query
 *         name: paymentMethod
 *         schema:
 *           type: string
 *           enum: [CASH, MOBILE_MONEY, BANK_TRANSFER, CHECK, CREDIT_CARD]
 *       - in: query
 *         name: paymentStatus
 *         schema:
 *           type: string
 *           enum: [PENDING, COMPLETED, FAILED, REFUNDED]
 *       - in: query
 *         name: membershipId
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
 *         description: Liste des transactions
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
 *                     transactions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           type:
 *                             type: string
 *                           amount:
 *                             type: number
 *                           paymentStatus:
 *                             type: string
 *                           membership:
 *                             type: object
 *                             properties:
 *                               displayInfo:
 *                                 type: object
 *                     pagination:
 *                       type: object
 */
router.get(
  "/:organizationId",
  validate(listTransactionsSchema),
  transactionController.getAll,
);

/**
 * @swagger
 * /api/transactions/{organizationId}/search:
 *   get:
 *     summary: Rechercher des transactions par référence ou membre
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: q
 *         required: true
 *         description: Terme de recherche (référence, description, nom, téléphone)
 *         schema:
 *           type: string
 *           minLength: 2
 *     responses:
 *       200:
 *         description: Résultats de la recherche
 *       400:
 *         description: Terme de recherche trop court
 */
router.get(
  "/:organizationId/search",
  validate(searchTransactionsSchema),
  transactionController.search,
);

// ─── Routes Spécifiques (Member & Single) ─────────────────────

/**
 * @swagger
 * /api/transactions/{organizationId}/members/transactions:
 *   get:
 *     summary: Mes transactions (membre connecté)
 *     description: Récupérer l'historique des transactions liées au compte de l'utilisateur connecté.
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [CONTRIBUTION, DEBT_REPAYMENT, FINE, DONATION, EXPENSE, OTHER]
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
 *         description: Mes transactions
 */
router.get(
  "/:organizationId/members/transactions",
  validate(myTransactionsSchema),
  transactionController.getMine,
);

/**
 * @swagger
 * /api/transactions/{organizationId}/members/{membershipId}/transactions:
 *   get:
 *     summary: Transactions d'un membre spécifique
 *     description: "Nécessite un rôle ADMIN pour voir les transactions d'un autre membre."
 *     tags: [Transactions]
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
 *         name: type
 *         schema:
 *           type: string
 *           enum: [CONTRIBUTION, DEBT_REPAYMENT, FINE, DONATION, EXPENSE, OTHER]
 *       - in: query
 *         name: paymentStatus
 *         schema:
 *           type: string
 *           enum: [PENDING, COMPLETED, FAILED, REFUNDED]
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
 *         description: Transactions du membre
 *       403:
 *         description: Permissions insuffisantes
 */
router.get(
  "/:organizationId/members/:membershipId/transactions",
  validate(memberTransactionsSchema),
  transactionController.getMember,
);

/**
 * @swagger
 * /api/transactions/{organizationId}/transaction/{id}:
 *   get:
 *     summary: Voir une transaction spécifique
 *     tags: [Transactions]
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
 *         description: ID de la transaction
 *     responses:
 *       200:
 *         description: Détails de la transaction
 *       404:
 *         description: Transaction non trouvée
 */
router.get(
  "/:organizationId/transaction/:id",
  validate(transactionParamSchema),
  transactionController.getOne,
);

// ─── Routes Outils & Stats ────────────────────────────────────

/**
 * @swagger
 * /api/transactions/{organizationId}/verify-integrity:
 *   get:
 *     summary: Vérifier la cohérence entre le wallet et les transactions
 *     description: "Compare le solde actuel du wallet avec la différence entre les revenus (transactions validées) et les dépenses. Réservé aux administrateurs."
 *     tags: [Transactions]
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
 *         description: Résultat de la vérification de cohérence
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
 *                     wallet:
 *                       type: object
 *                       properties:
 *                         currentBalance:
 *                           type: number
 *                         totalIncome:
 *                           type: number
 *                         totalExpenses:
 *                           type: number
 *                     calculated:
 *                       type: object
 *                       properties:
 *                         income:
 *                           type: number
 *                         expenses:
 *                           type: number
 *                         balance:
 *                           type: number
 *                     isConsistent:
 *                       type: boolean
 *                     discrepancy:
 *                       type: number
 *       403:
 *         description: Accès réservé aux administrateurs
 *       404:
 *         description: Wallet non trouvé
 */
router.get(
  "/:organizationId/verify-integrity",
  validate(orgParamSchema),
  transactionController.verifyIntegrity,
);

/**
 * @swagger
 * /api/transactions/{organizationId}/stats-by-type:
 *   get:
 *     summary: Statistiques groupées par type de transaction
 *     description: "Retourne le détail des montants et du nombre de transactions par type (ex: total des contributions, total des remboursements de dettes)"
 *     tags: [Transactions]
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
 *         description: "Filtrer à partir de cette date"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: "Filtrer jusqu'à cette date"
 *     responses:
 *       200:
 *         description: Statistiques par type
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
 *                     wallet:
 *                       type: object
 *                     byType:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                           totalAmount:
 *                             type: number
 *                           count:
 *                             type: integer
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalTransactions:
 *                           type: integer
 *                         totalAmount:
 *                           type: number
 */
router.get(
  "/:organizationId/stats-by-type",
  validate(statsByTypeSchema),
  transactionController.getStatsByType,
);

export default router;
