import { NotificationService } from "./notification.service.js";

const notificationService = new NotificationService();

export class NotificationController {
  async send(req, res, next) {
    try {
      const result = await notificationService.send(
        req.validated.params.organizationId,
        req.user.id,
        req.validated.body,
      );
      res.status(201).json({
        success: true,
        message: "Notification envoyée avec succès",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getMyNotifications(req, res, next) {
    try {
      const result = await notificationService.getMyNotifications(
        req.validated.params.organizationId,
        req.user.id,
        req.validated.query,
      );
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async getUnreadCount(req, res, next) {
    try {
      const result = await notificationService.getUnreadCount(
        req.validated.params.organizationId,
        req.user.id,
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(req, res, next) {
    try {
      const result = await notificationService.markAsRead(
        req.validated.params.organizationId,
        req.validated.params.id,
        req.user.id,
      );
      res.status(200).json({
        success: true,
        message: "Notification marquée comme lue",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async markAllAsRead(req, res, next) {
    try {
      const result = await notificationService.markAllAsRead(
        req.validated.params.organizationId,
        req.user.id,
      );
      res.status(200).json({ success: true, message: result.message });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      await notificationService.deleteNotification(
        req.validated.params.organizationId,
        req.validated.params.id,
        req.user.id,
      );
      res.status(200).json({
        success: true,
        message: "Notification supprimée avec succès",
      });
    } catch (error) {
      next(error);
    }
  }
}
