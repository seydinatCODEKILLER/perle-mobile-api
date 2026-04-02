import { TransactionService } from "./transaction.service.js";

const transactionService = new TransactionService();

export class TransactionController {
  async getAll(req, res, next) {
    try {
      const result = await transactionService.getTransactions(
        req.validated.params.organizationId,
        req.user.id,
        req.validated.query,
      );
      res
        .status(200)
        .json({
          success: true,
          message: "Transactions récupérées avec succès",
          data: result,
        });
    } catch (error) {
      next(error);
    }
  }

  async getOne(req, res, next) {
    try {
      const result = await transactionService.getTransactionById(
        req.validated.params.organizationId,
        req.validated.params.id,
        req.user.id,
      );
      res
        .status(200)
        .json({
          success: true,
          message: "Transaction récupérée avec succès",
          data: result,
        });
    } catch (error) {
      next(error);
    }
  }

  async search(req, res, next) {
    try {
      const result = await transactionService.searchTransactions(
        req.validated.params.organizationId,
        req.user.id,
        req.validated.query.q,
      );
      res
        .status(200)
        .json({
          success: true,
          message: "Recherche effectuée avec succès",
          data: result,
        });
    } catch (error) {
      next(error);
    }
  }

  async getMember(req, res, next) {
    try {
      const result = await transactionService.getMemberTransactions(
        req.validated.params.organizationId,
        req.validated.params.membershipId,
        req.user.id,
        req.validated.query,
      );
      res
        .status(200)
        .json({
          success: true,
          message: "Transactions du membre récupérées avec succès",
          data: result,
        });
    } catch (error) {
      next(error);
    }
  }

  async getMine(req, res, next) {
    try {
      const result = await transactionService.getMyTransactions(
        req.validated.params.organizationId,
        req.user.id,
        req.validated.query,
      );
      res
        .status(200)
        .json({
          success: true,
          message: "Mes transactions récupérées avec succès",
          data: result,
        });
    } catch (error) {
      next(error);
    }
  }

  async verifyIntegrity(req, res, next) {
    try {
      const result = await transactionService.verifyWalletIntegrity(
        req.validated.params.organizationId,
        req.user.id,
      );
      const message = result.isConsistent
        ? "Le wallet est cohérent avec les transactions"
        : `Incohérence détectée : écart de ${result.discrepancy.toFixed(2)}`;
      res.status(200).json({ success: true, message, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getStatsByType(req, res, next) {
    try {
      const result = await transactionService.getTransactionStatsByType(
        req.validated.params.organizationId,
        req.user.id,
        req.validated.query,
      );
      res
        .status(200)
        .json({
          success: true,
          message: "Statistiques par type récupérées avec succès",
          data: result,
        });
    } catch (error) {
      next(error);
    }
  }
}
