import { WalletService } from "./wallet.service.js";

const walletService = new WalletService();

export class WalletController {
  async getOrCreate(req, res, next) {
    try {
      const result = await walletService.getOrCreateWallet(
        req.validated.params.organizationId,
        req.user.id
      );
      res.status(200).json({
        success: true,
        message: "Portefeuille récupéré avec succès",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getOne(req, res, next) {
    try {
      const result = await walletService.getWalletById(
        req.validated.params.walletId,
        req.validated.params.organizationId,
        req.user.id
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getStats(req, res, next) {
    try {
      const result = await walletService.getWalletStats(
        req.validated.params.organizationId,
        req.user.id
      );
      res.status(200).json({
        success: true,
        message: "Statistiques du portefeuille récupérées avec succès",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async reconcile(req, res, next) {
    try {
      const { expectedBalance, note } = req.validated.body;
      
      const result = await walletService.reconcileWallet(
        req.validated.params.organizationId,
        req.user.id,
        expectedBalance,
        note
      );
      res.status(200).json({
        success: true,
        message: "Portefeuille réconcilié avec succès",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}