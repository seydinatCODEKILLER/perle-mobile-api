import { EventService } from "./event.service.js";

const eventService = new EventService();

export class EventController {
  async create(req, res, next) {
    try {
      const result = await eventService.createEvent(
        req.validated.params.organizationId,
        req.user.id,
        req.validated.body,
        req.file,
      );
      res.status(201).json({
        success: true,
        message: "Événement créé (brouillon)",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async publish(req, res, next) {
    try {
      const result = await eventService.publishEvent(
        req.validated.params.organizationId,
        req.validated.params.id,
        req.user.id,
      );
      res
        .status(200)
        .json({ success: true, message: "Événement publié", data: result });
    } catch (error) {
      next(error);
    }
  }

  async getAll(req, res, next) {
    try {
      const result = await eventService.getMyEvents(
        req.validated.params.organizationId,
        req.user.id,
        req.validated.query,
      );
      res
        .status(200)
        .json({ success: true, message: "Événements récupérés", data: result });
    } catch (error) {
      next(error);
    }
  }

  async getOne(req, res, next) {
    try {
      const result = await eventService.getEventById(
        req.validated.params.organizationId,
        req.validated.params.id,
        req.user.id,
      );
      res
        .status(200)
        .json({ success: true, message: "Événement récupéré", data: result });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const result = await eventService.updateEvent(
        req.validated.params.organizationId,
        req.validated.params.id,
        req.user.id,
        req.validated.body,
        req.file,
      );
      res
        .status(200)
        .json({ success: true, message: "Événement mis à jour", data: result });
    } catch (error) {
      next(error);
    }
  }

  async rsvp(req, res, next) {
    try {
      const result = await eventService.rsvpEvent(
        req.validated.params.organizationId,
        req.validated.params.id,
        req.user.id,
        req.validated.body.status,
      );
      res
        .status(200)
        .json({ success: true, message: "Réponse enregistrée", data: result });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      await eventService.deleteEvent(
        req.validated.params.organizationId,
        req.validated.params.id,
        req.user.id,
      );
      res.status(200).json({ success: true, message: "Événement supprimé" });
    } catch (error) {
      next(error);
    }
  }

  async cancel(req, res, next) {
    try {
      const result = await eventService.cancelEvent(
        req.validated.params.organizationId,
        req.validated.params.id,
        req.user.id,
      );
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
}
