import { ContributionLifecycleService } from "./contribution-lifecycle.service.js";
import { ContributionPlanService } from "./contribution-plan.service.js";

const planService = new ContributionPlanService();
const lifecycleService = new ContributionLifecycleService();

export class ContributionPlanController {

  async create(req, res, next) {
    try {
      const result = await planService.createPlan(
        req.validated.params.organizationId,
        req.user.id,
        req.validated.body
      );
      res.status(201).json({
        success: true,
        message: "Plan de cotisation créé avec succès",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getOne(req, res, next) {
    try {
      const result = await planService.getPlanById(
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
      const result = await planService.getOrganizationPlans(
        req.validated.params.organizationId,
        req.user.id,
        req.validated.query
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const result = await planService.updatePlan(
        req.validated.params.organizationId,
        req.validated.params.id,
        req.user.id,
        req.validated.body
      );
      res.status(200).json({
        success: true,
        message: "Plan mis à jour avec succès",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async toggleStatus(req, res, next) {
    try {
      const result = await planService.toggleStatus(
        req.validated.params.organizationId,
        req.validated.params.id,
        req.user.id
      );
      const action = result.isActive ? "activé" : "désactivé";
      res.status(200).json({
        success: true,
        message: `Plan de cotisation ${action} avec succès`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async generateContributions(req, res, next) {
    try {
      const result = await lifecycleService.generateForPlan(
        req.validated.params.organizationId,
        req.validated.params.id,
        req.user.id,
        {
          force: req.validated.body.force,
          dueDateOffset: req.validated.body.dueDateOffset,
        }
      );
      res.status(200).json({
        success: true,
        message: "Cotisations générées avec succès",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async assignToMember(req, res, next) {
    try {
      const result = await lifecycleService.assignPlanToMember(
        req.validated.params.organizationId,
        req.validated.params.id,
        req.validated.body.membershipId,
        req.user.id
      );
      res.status(201).json({
        success: true,
        message: "Plan assigné au membre avec succès",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}