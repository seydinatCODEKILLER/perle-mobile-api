import { Router } from "express";
import { PushTokenController } from "./push-token.controller.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { protect } from "../../shared/middlewares/auth.middleware.js";
import { registerTokenSchema, revokeTokenSchema } from "./push-token.schema.js";

const router = Router();
const pushTokenController = new PushTokenController();

router.use(protect());

/**
 * @swagger
 * /api/push-tokens/register:
 *   post:
 *     summary: Enregistrer un token Expo Push
 *     tags: [PushTokens]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *                 example: "ExponentPushToken[xxxxxx]"
 *               platform:
 *                 type: string
 *                 enum: [ios, android]
 *               deviceName:
 *                 type: string
 *                 example: "iPhone de Moussa"
 */
router.post(
  "/register",
  validate(registerTokenSchema),
  pushTokenController.register,
);

/**
 * @swagger
 * /api/push-tokens/revoke:
 *   delete:
 *     summary: Révoquer un token spécifique (logout d'un device)
 */
router.delete(
  "/revoke",
  validate(revokeTokenSchema),
  pushTokenController.revoke,
);

/**
 * @swagger
 * /api/push-tokens/revoke-all:
 *   delete:
 *     summary: Révoquer tous les tokens (logout global)
 */
router.delete("/revoke-all", pushTokenController.revokeAll);

export default router;