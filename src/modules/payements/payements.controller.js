import { PaymentService } from "./payment.service.js";

const paymentService = new PaymentService();

export class PaymentController {

  // POST /api/payments/:organizationId/wave/initiate
  async initiate(req, res, next) {
    try {
      const result = await paymentService.initiateWavePayment(
        req.validated.params.organizationId,
        req.validated.body,
        req.user.id,
      );
      res.status(201).json({
        success: true,
        message: "Session Wave créée. Redirigez le client vers paymentUrl.",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/payments/:organizationId/wave/status/:sessionId
  async checkStatus(req, res, next) {
    try {
      const result = await paymentService.checkPaymentStatus(
        req.validated.params.organizationId,
        req.validated.params.sessionId,
        req.user.id,
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/payments/wave/webhook  ⚠️ Pas de protect() — appelé par Wave
  async webhook(req, res) {
    try {
      const signature = req.headers["x-wave-signature"] || "";
      const timestamp = req.headers["x-wave-timestamp"] || "";

      const result = await paymentService.handleWebhook(
        req.body,
        signature,
        timestamp,
      );

      res.status(200).json(result);
    } catch (error) {
      // ✅ Toujours 200 à Wave — sinon Wave retente en boucle
      console.error("[WEBHOOK WAVE] Erreur:", error.message);
      res.status(200).json({ received: true });
    }
  }
}