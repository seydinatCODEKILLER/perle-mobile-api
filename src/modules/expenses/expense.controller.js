import { ExpenseService } from "./expense.service.js";

const expenseService = new ExpenseService();

export class ExpenseController {
  async create(req, res, next) {
    try {
      const result = await expenseService.createExpense(
        req.validated.params.organizationId,
        req.user.id,
        req.validated.body,
      );
      res.status(201).json({
        success: true,
        message: "Dépense créée avec succès",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async approve(req, res, next) {
    try {
      const { organizationId, expenseId } = req.validated.params;
      const result = await expenseService.approveExpense(
        organizationId,
        expenseId,
        req.user.id,
      );
      res.status(200).json({
        success: true,
        message: "Dépense approuvée avec succès",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async reject(req, res, next) {
    try {
      const { organizationId, expenseId } = req.validated.params;
      const result = await expenseService.rejectExpense(
        organizationId,
        expenseId,
        req.user.id,
        req.validated.body?.reason,
      );
      res.status(200).json({
        success: true,
        message: "Dépense rejetée avec succès",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async pay(req, res, next) {
    try {
      const { organizationId, expenseId } = req.validated.params;
      const result = await expenseService.payExpense(
        organizationId,
        expenseId,
        req.user.id,
        req.validated.body,
      );
      res.status(200).json({
        success: true,
        message: "Dépense payée avec succès",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAll(req, res, next) {
    try {
      const result = await expenseService.getExpenses(
        req.validated.params.organizationId,
        req.user.id,
        req.validated.query,
      );
      res.status(200).json({
        success: true,
        message: "Dépenses récupérées avec succès",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getOne(req, res, next) {
    try {
      const { organizationId, expenseId } = req.validated.params;
      const result = await expenseService.getExpenseById(
        organizationId,
        expenseId,
        req.user.id,
      );
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getStats(req, res, next) {
    try {
      const result = await expenseService.getExpenseStats(
        req.validated.params.organizationId,
        req.user.id,
        req.validated.query,
      );
      res.status(200).json({
        success: true,
        message: "Statistiques des dépenses récupérées avec succès",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async cancel(req, res, next) {
    try {
      const { organizationId, expenseId } = req.validated.params;
      const result = await expenseService.cancelExpense(
        organizationId,
        expenseId,
        req.user.id,
        req.validated.body?.reason,
      );
      res.status(200).json({
        success: true,
        message: "Dépense annulée avec succès",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
