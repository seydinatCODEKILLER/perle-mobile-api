// src/modules/subscriptions/subscription.controller.js
import { SubscriptionService } from "./subscription.service.js";

const subService = new SubscriptionService();

export class SubscriptionController {
  async getSubscription(req, res, next) {
    try {
      const result = await subService.getOrganizationSubscription(
        req.validated.params.organizationId,
        req.user.id
      );
      res.status(200).json({
        success: true,
        message: "Abonnement récupéré avec succès",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateSubscription(req, res, next) {
    try {
      const result = await subService.updateSubscription(
        req.validated.params.organizationId,
        req.user.id,
        req.validated.body
      );
      res.status(200).json({
        success: true,
        message: "Abonnement mis à jour avec succès",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateSubscriptionStatus(req, res, next) {
    try {
      const result = await subService.updateSubscriptionStatus(
        req.validated.params.organizationId,
        req.user.id,
        req.validated.body.status
      );
      res.status(200).json({
        success: true,
        message: "Statut de l'abonnement mis à jour avec succès",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getUsage(req, res, next) {
    try {
      const result = await subService.getSubscriptionUsage(
        req.validated.params.organizationId,
        req.user.id
      );
      res.status(200).json({
        success: true,
        message: "Utilisation récupérée avec succès",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAvailablePlans(req, res, next) {
    try {
      const result = await subService.getAvailablePlans();
      res.status(200).json({
        success: true,
        message: "Plans disponibles récupérés avec succès",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async changePlan(req, res, next) {
    try {
      const result = await subService.changePlan(
        req.validated.params.organizationId,
        req.user.id,
        req.validated.body.plan
      );
      res.status(200).json({
        success: true,
        message: "Plan changé avec succès",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}