import { DebtService } from "./debt.service.js";

const debtService = new DebtService();

export class DebtController {

  async create(req, res, next) {
    try {
      const result = await debtService.createDebt(
        req.validated.params.organizationId,
        req.user.id,
        req.validated.body
      );
      res.status(201).json({
        success: true,
        message: "Dette créée avec succès",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getOne(req, res, next) {
    try {
      const result = await debtService.getDebtById(
        req.validated.params.organizationId,
        req.validated.params.id,
        req.user.id
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getAll(req, res, next) {
    try {
      const result = await debtService.getOrganizationDebts(
        req.validated.params.organizationId,
        req.user.id,
        req.validated.query
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getMemberDebts(req, res, next) {
    try {
      const result = await debtService.getMemberDebts(
        req.validated.params.organizationId,
        req.validated.params.membershipId,
        req.user.id,
        req.validated.query
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getMyDebts(req, res, next) {
    try {
      const result = await debtService.getMyDebts(
        req.validated.params.organizationId,
        req.user.id,
        req.validated.query
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getRepayments(req, res, next) {
    try {
      const result = await debtService.getDebtRepayments(
        req.validated.params.organizationId,
        req.validated.params.id,
        req.user.id
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async addRepayment(req, res, next) {
    try {
      const result = await debtService.addRepayment(
        req.validated.params.organizationId,
        req.validated.params.id,
        req.user.id,
        req.validated.body
      );
      res.status(200).json({
        success: true,
        message: "Remboursement ajouté avec succès",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req, res, next) {
    try {
      const result = await debtService.updateDebtStatus(
        req.validated.params.organizationId,
        req.validated.params.id,
        req.user.id,
        req.validated.body.status
      );
      res.status(200).json({
        success: true,
        message: "Statut de la dette mis à jour",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async cancel(req, res, next) {
    try {
      const result = await debtService.cancelDebt(
        req.validated.params.organizationId,
        req.validated.params.id,
        req.user.id,
        req.validated.body.reason
      );
      res.status(200).json({
        success: true,
        message: "Dette annulée avec succès",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getSummary(req, res, next) {
    try {
      const result = await debtService.getDebtSummary(
        req.validated.params.organizationId,
        req.user.id
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}