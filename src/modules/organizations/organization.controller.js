import { OrganizationService } from "./organization.service.js";

const orgService = new OrganizationService();

export class OrganizationController {

  async create(req, res, next) {
    try {
      const result = await orgService.createOrganization(
        req.user.id,
        req.validated.body,
        req.file
      );
      res.status(201).json({
        success: true,
        message: "Organisation créée avec succès",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getOne(req, res, next) {
    try {
      const result = await orgService.getOrganizationById(
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
      const result = await orgService.getUserOrganizations(req.user.id);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getInactive(req, res, next) {
    try {
      const result = await orgService.getInactiveOrganizations(
        req.user.id,
        req.validated.query.page,
        req.validated.query.limit
      );
      res.status(200).json({
        success: true,
        message: "Organisations inactives récupérées avec succès",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async search(req, res, next) {
    try {
      const result = await orgService.searchOrganizations(
        req.user.id,
        req.validated.query
      );
      res.status(200).json({
        success: true,
        message: "Recherche effectuée avec succès",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const result = await orgService.updateOrganization(
        req.validated.params.id,
        req.user.id,
        req.validated.body,
        req.file
      );
      res.status(200).json({
        success: true,
        message: "Organisation mise à jour avec succès",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateSettings(req, res, next) {
    try {
      const result = await orgService.updateOrganizationSettings(
        req.validated.params.id,
        req.user.id,
        req.validated.body
      );
      res.status(200).json({
        success: true,
        message: "Paramètres mis à jour avec succès",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async deactivate(req, res, next) {
    try {
      const result = await orgService.deactivateOrganization(
        req.validated.params.id,
        req.user.id
      );
      res.status(200).json({
        success: true,
        message: "Organisation désactivée avec succès",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async reactivate(req, res, next) {
    try {
      const result = await orgService.reactivateOrganization(
        req.validated.params.id,
        req.user.id
      );
      res.status(200).json({
        success: true,
        message: "Organisation réactivée avec succès",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getStats(req, res, next) {
    try {
      const result = await orgService.getOrganizationStats(
        req.validated.params.id,
        req.user.id
      );
      res.status(200).json({
        success: true,
        message: "Statistiques récupérées avec succès",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async settleWallet(req, res, next) {
    try {
      const result = await orgService.settleWallet(
        req.validated.params.id,
        req.user.id
      );
      res.status(200).json({
        success: true,
        message: "Portefeuille soldé avec succès",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateWallet(req, res, next) {
    try {
      const result = await orgService.updateWallet(
        req.validated.params.id,
        req.user.id,
        req.validated.body
      );
      res.status(200).json({
        success: true,
        message: "Portefeuille mis à jour avec succès",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}