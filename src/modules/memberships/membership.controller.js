import { MembershipService } from "./membership.service.js";

const membershipService = new MembershipService();

export class MembershipController {
  async create(req, res, next) {
    try {
      const result = await membershipService.createMembership(
        req.validated.params.organizationId,
        req.user.id,
        req.validated.body,
        req.file
      );
      res.status(201).json({ success: true, message: "Membre ajouté avec succès", data: result });
    } catch (error) {
      next(error);
    }
  }

  async getOne(req, res, next) {
    try {
      const result = await membershipService.getMembershipById(
        req.validated.params.organizationId,
        req.validated.params.id,
        req.user.id
      );
      res.status(200).json({ success: true, message: "Membre récupéré avec succès", data: result });
    } catch (error) {
      next(error);
    }
  }

  async getAll(req, res, next) {
    try {
      const result = await membershipService.getOrganizationMembers(
        req.validated.params.organizationId,
        req.user.id,
        req.validated.query
      );
      res.status(200).json({ success: true, message: "Membres récupérés avec succès", data: result });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const result = await membershipService.updateMembership(
        req.validated.params.organizationId,
        req.validated.params.id,
        req.user.id,
        req.validated.body
      );
      res.status(200).json({ success: true, message: "Membre mis à jour avec succès", data: result });
    } catch (error) {
      next(error);
    }
  }

  async updateProvisional(req, res, next) {
    try {
      const result = await membershipService.updateProvisionalMember(
        req.validated.params.organizationId,
        req.validated.params.id,
        req.user.id,
        req.validated.body
      );
      res.status(200).json({ success: true, message: "Membre provisoire mis à jour", data: result });
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req, res, next) {
    try {
      const result = await membershipService.updateMembershipStatus(
        req.validated.params.organizationId,
        req.validated.params.id,
        req.user.id,
        req.validated.body.status
      );
      res.status(200).json({ success: true, message: "Statut du membre mis à jour", data: result });
    } catch (error) {
      next(error);
    }
  }

  async updateRole(req, res, next) {
    try {
      const result = await membershipService.updateMembershipRole(
        req.validated.params.organizationId,
        req.validated.params.id,
        req.user.id,
        req.validated.body.role
      );
      res.status(200).json({ success: true, message: "Rôle du membre mis à jour", data: result });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await membershipService.deleteMembership(
        req.validated.params.organizationId,
        req.validated.params.id,
        req.user.id
      );
      res.status(200).json({ success: true, message: "Membre supprimé avec succès", data: result });
    } catch (error) {
      next(error);
    }
  }
}