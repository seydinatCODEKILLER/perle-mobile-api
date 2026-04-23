import { PushTokenService } from "./push-token.service.js";

const pushTokenService = new PushTokenService();

export class PushTokenController {
  async register(req, res, next) {
    try {
      const result = await pushTokenService.registerToken(
        req.user.id,
        req.validated.body,
      );
      res.status(200).json({
        success: true,
        message: "Token enregistré avec succès",
        data: { id: result.id, token: result.token, platform: result.platform },
      });
    } catch (error) {
      next(error);
    }
  }

  async revoke(req, res, next) {
    try {
      await pushTokenService.revokeToken(req.user.id, req.validated.body.token);
      res.status(200).json({
        success: true,
        message: "Token révoqué avec succès",
        data: null,
      });
    } catch (error) {
      next(error);
    }
  }

  async revokeAll(req, res, next) {
    try {
      await pushTokenService.revokeAllTokens(req.user.id);
      res.status(200).json({
        success: true,
        message: "Tous les tokens révoqués",
        data: null,
      });
    } catch (error) {
      next(error);
    }
  }
}
