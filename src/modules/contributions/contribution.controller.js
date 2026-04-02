import { ContributionService } from "./contribution.service.js";

const contributionService = new ContributionService();

export class ContributionController {
  async getAll(req, res, next) {
    try {
      const result = await contributionService.getContributions(
        req.validated.params.organizationId,
        req.user.id,
        req.validated.query,
      );
      res
        .status(200)
        .json({
          success: true,
          message: "Cotisations récupérées avec succès",
          data: result,
        });
    } catch (error) {
      next(error);
    }
  }

  async getOne(req, res, next) {
    try {
      const result = await contributionService.getContributionById(
        req.validated.params.organizationId,
        req.validated.params.id,
        req.user.id,
      );
      res
        .status(200)
        .json({
          success: true,
          message: "Cotisation récupérée avec succès",
          data: result,
        });
    } catch (error) {
      next(error);
    }
  }

  async markAsPaid(req, res, next) {
    try {
      const result = await contributionService.markAsPaid(
        req.validated.params.organizationId,
        req.validated.params.id,
        req.user.id,
        req.validated.body,
      );
      res
        .status(200)
        .json({
          success: true,
          message: "Cotisation marquée comme payée avec succès",
          data: result,
        });
    } catch (error) {
      next(error);
    }
  }

  async addPartialPayment(req, res, next) {
    try {
      const result = await contributionService.addPartialPayment(
        req.validated.params.organizationId,
        req.validated.params.id,
        req.user.id,
        req.validated.body,
      );
      res
        .status(200)
        .json({
          success: true,
          message: "Paiement partiel ajouté avec succès",
          data: result,
        });
    } catch (error) {
      next(error);
    }
  }

  async getMemberContributions(req, res, next) {
    try {
      const result = await contributionService.getMemberContributions(
        req.validated.params.organizationId,
        req.validated.params.membershipId,
        req.user.id,
        req.validated.query,
      );
      res
        .status(200)
        .json({
          success: true,
          message: "Cotisations du membre récupérées avec succès",
          data: result,
        });
    } catch (error) {
      next(error);
    }
  }

  async getMyContributions(req, res, next) {
    try {
      const result = await contributionService.getMyContributions(
        req.validated.params.organizationId,
        req.user.id,
        req.validated.query,
      );
      res
        .status(200)
        .json({
          success: true,
          message: "Mes cotisations récupérées avec succès",
          data: result,
        });
    } catch (error) {
      next(error);
    }
  }

  async cancel(req, res, next) {
    try {
      const result = await contributionService.cancelContribution(
        req.validated.params.organizationId,
        req.validated.params.id,
        req.user.id,
        req.validated.body.reason || "",
      );

      const message =
        result.amountPaid > 0
          ? `Cotisation annulée. ${result.amountPaid} retiré(s) du wallet.`
          : "Cotisation annulée avec succès";

      res.status(200).json({ success: true, message, data: result });
    } catch (error) {
      next(error);
    }
  }
}
