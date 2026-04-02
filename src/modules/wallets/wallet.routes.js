import { Router } from "express";
import { WalletController } from "./wallet.controller.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { protect } from "../../shared/middlewares/auth.middleware.js";
import {
  orgParamSchema,
  walletIdParamSchema,
  reconcileSchema,
} from "./wallet.schema.js";

const router = Router();
const walletController = new WalletController();

router.use(protect());

/**
 * @swagger
 * /api/wallet/{organizationId}:
 *   get:
 *     summary: Récupérer ou créer le portefeuille de l'organisation
 *     description: |
 *       Si le portefeuille n'existe pas, il est automatiquement créé (uniquement si l'utilisateur est ADMIN).
 *       Sinon, retourne les informations du portefeuille existant.
 *     tags: [Wallet]
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
 *         description: Portefeuille récupéré ou créé avec succès
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
 *                     id:
 *                       type: string
 *                     currentBalance:
 *                       type: number
 *                     currency:
 *                       type: string
 *                     totalIncome:
 *                       type: number
 *                     totalExpenses:
 *                       type: number
 *                     organization:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *       403:
 *         description: Accès non autorisé (seul un admin peut créer un portefeuille)
 */
router.get(
  "/:organizationId",
  validate(orgParamSchema),
  walletController.getOrCreate
);

/**
 * @swagger
 * /api/wallet/{organizationId}/stats:
 *   get:
 *     summary: Récupérer les statistiques du portefeuille
 *     description: Calcule et retourne les vrais revenus et dépenses basés sur les transactions et dépenses validées, comparés aux compteurs du wallet.
 *     tags: [Wallet]
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
 *         description: Statistiques du portefeuille
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
 *                       properties:
 *                         id:
 *                           type: string
 *                         currentBalance:
 *                           type: number
 *                         totalIncome:
 *                           type: number
 *                         totalExpenses:
 *                           type: number
 *                     stats:
 *                       type: object
 *                       properties:
 *                         incomeTotal:
 *                           type: number
 *                         incomeCount:
 *                           type: integer
 *                         expensesTotal:
 *                           type: number
 *                         expensesCount:
 *                           type: integer
 *                         netBalance:
 *                           type: number
 *       403:
 *         description: Accès non autorisé
 */
router.get(
  "/:organizationId/stats",
  validate(orgParamSchema),
  walletController.getStats
);

/**
 * @swagger
 * /api/wallet/{organizationId}/{walletId}:
 *   get:
 *     summary: Récupérer un portefeuille par son ID
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: walletId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Portefeuille récupéré avec succès
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
 *                     currentBalance:
 *                       type: number
 *                     currency:
 *                       type: string
 *       403:
 *         description: Accès non autorisé à cette organisation
 *       404:
 *         description: Portefeuille non trouvé
 */
router.get(
  "/:organizationId/:walletId",
  validate(walletIdParamSchema),
  walletController.getOne
);

/**
 * @swagger
 * /api/wallet/{organizationId}/reconcile:
 *   post:
 *     summary: Réconcilier le portefueille avec un solde attendu
 *     description: |
 *       Si une différence est détectée entre le solde actuel et le solde attendu, une transaction d'ajustement est créée 
 *       (revenu si positif, dépense si négatif) pour corriger le solde. Réservé aux ADMIN et FINANCIAL_MANAGER.
 *     tags: [Wallet]
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
 *               - expectedBalance
 *             properties:
 *               expectedBalance:
 *                 type: number
 *                 description: Solde attendu après réconciliation
 *                 example: 150000
 *               note:
 *                 type: string
 *                 description: Note explicative optionnelle
 *                 example: "Correction erreur de caisse du 15/03"
 *     responses:
 *       200:
 *         description: Portefeuille réconcilié avec succès
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
 *                     reconciled:
 *                       type: boolean
 *                     previousBalance:
 *                       type: number
 *                     newBalance:
 *                       type: number
 *                     difference:
 *                       type: number
 *       400:
 *         description: Données invalides (solde négatif)
 *       403:
 *         description: Permissions financières insuffisantes
 */
router.post(
  "/:organizationId/reconcile",
  validate(reconcileSchema),
  walletController.reconcile
);

export default router;