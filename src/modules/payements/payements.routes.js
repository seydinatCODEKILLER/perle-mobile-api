import { Router } from "express";
import { PaymentController } from "./payment.controller.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { protect } from "../../shared/middlewares/auth.middleware.js";
import {
  initiatePaymentSchema,
  checkPaymentSchema,
} from "./payment.schema.js";

const router = Router();
const paymentController = new PaymentController();

/**
 * @openapi
 * /api/payments/wave/webhook:
 *   post:
 *     summary: Webhook Wave (réservé à Wave)
 *     description: >
 *       Appelé automatiquement par Wave. Ne pas appeler manuellement.
 *       Vérifie la signature HMAC + anti-replay.
 *     tags: [Payments]
 *     security: []
 *     responses:
 *       200:
 *         description: Webhook reçu
 */
// ⚠️ Webhook AVANT protect() et AVANT /:organizationId
// Wave envoie un seul webhook global, sans organizationId
// L'organisation est retrouvée via les metadata de la transaction
router.post("/wave/webhook", paymentController.webhook);

// ─── Routes protégées (par organisation) ─────────────────────
router.use(protect());

/**
 * @openapi
 * /api/payments/{organizationId}/wave/initiate:
 *   post:
 *     summary: Initier un paiement Wave
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, resourceId]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [CONTRIBUTION, DEBT]
 *               resourceId:
 *                 type: string
 *               successUrl:
 *                 type: string
 *               errorUrl:
 *                 type: string
 *     responses:
 *       201:
 *         description: Session Wave créée
 *       403:
 *         description: Accès non autorisé à cette organisation
 *       409:
 *         description: Session Wave déjà en cours
 */
router.post(
  "/:organizationId/wave/initiate",
  validate(initiatePaymentSchema),
  paymentController.initiate,
);

/**
 * @openapi
 * /api/payments/{organizationId}/wave/status/{sessionId}:
 *   get:
 *     summary: Vérifier le statut d'un paiement Wave
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Statut du paiement
 */
router.get(
  "/:organizationId/wave/status/:sessionId",
  validate(checkPaymentSchema),
  paymentController.checkStatus,
);

export default router;