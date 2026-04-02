// src/modules/dashboards/dashboard.controller.js
import { DashboardService } from "./dashboard.service.js";

const dashService = new DashboardService();

export class DashboardController {
  async getManagementDashboard(req, res, next) {
    try {
      const data = await dashService.getManagementDashboard(
        req.validated.params.organizationId,
        req.user.id,
      );
      res
        .status(200)
        .json({
          success: true,
          message: "Dashboard de gestion récupéré avec succès",
          data,
        });
    } catch (error) {
      next(error);
    }
  }

  async getPersonalDashboard(req, res, next) {
    try {
      const data = await dashService.getPersonalDashboard(
        req.validated.params.organizationId,
        req.user.id,
      );
      res
        .status(200)
        .json({
          success: true,
          message: "Dashboard personnel récupéré avec succès",
          data,
        });
    } catch (error) {
      next(error);
    }
  }

  async getAutoDashboard(req, res, next) {
    try {
      const data = await dashService.getAutoDashboard(
        req.validated.params.organizationId,
        req.user.id,
        req.validated.query.space,
      );
      res
        .status(200)
        .json({
          success: true,
          message: "Dashboard récupéré avec succès",
          data,
        });
    } catch (error) {
      next(error);
    }
  }

  async getDefaultDashboard(req, res, next) {
    try {
      const data = await dashService.getDefaultDashboard(
        req.validated.params.organizationId,
        req.user.id,
      );
      res
        .status(200)
        .json({
          success: true,
          message: "Dashboard récupéré avec succès",
          data,
        });
    } catch (error) {
      next(error);
    }
  }
}
