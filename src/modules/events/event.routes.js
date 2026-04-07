import { Router } from "express";
import { EventController } from "./event.controller.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { protect } from "../../shared/middlewares/auth.middleware.js";
import { uploadSingle } from "../../shared/middlewares/upload.middleware.js";
import { parseNestedFormData } from "../../shared/middlewares/parseFormData.middleware.js";
import {
  createEventSchema,
  getEventsSchema,
  eventParamSchema,
  updateEventSchema,
  rsvpEventSchema,
} from "./event.schema.js";
import { sanitizeBody } from "../../shared/middlewares/sanitize.middleware.js";

const router = Router();
const eventController = new EventController();

router.use(protect());

// ─── Routes sans :id ──────────────────────────────────────────

/**
 * @swagger
 * /api/events/{organizationId}:
 *   post:
 *     summary: Créer un nouvel événement (Brouillon)
 *     description: |
 *       Crée un événement avec le statut `DRAFT`.
 *       Nécessite un rôle ADMIN, PRESIDENT, VICE_PRESIDENT, SECRETARY_GENERAL ou ORGANIZER.
 *       Si `visibility` est `INVITE_ONLY`, le champ `inviteeIds` (tableau de membershipIds) est obligatoire.
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - type
 *               - startDate
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Assemblée Générale de Fin d'Année"
 *               description:
 *                 type: string
 *                 example: "Bilan des activités et projection future."
 *               type:
 *                 type: string
 *                 enum: [REUNION, FETE, CONFERENCE, FORMATION, ACTIVITE_SOCIALE, COLLECTE_DE_FONDS, AUTRE]
 *                 example: "REUNION"
 *               visibility:
 *                 type: string
 *                 enum: [ORGANIZATION_WIDE, INVITE_ONLY]
 *                 default: "ORGANIZATION_WIDE"
 *                 description: "Définit si l'événement est public pour l'org ou sur invitation"
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-05-20T18:00:00Z"
 *               endDate:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *                 example: "2024-05-20T20:00:00Z"
 *               location:
 *                 type: string
 *                 nullable: true
 *                 example: "Salle des fêtes de Médina"
 *               locationUrl:
 *                 type: string
 *                 format: uri
 *                 nullable: true
 *                 example: "https://maps.google.com/..."
 *               isOnline:
 *                 type: boolean
 *                 default: false
 *               meetingLink:
 *                 type: string
 *                 format: uri
 *                 nullable: true
 *                 example: "https://meet.google.com/xxx-yyy-zzz"
 *               maxParticipants:
 *                 type: integer
 *                 nullable: true
 *                 example: 50
 *               estimatedBudget:
 *                 type: number
 *                 nullable: true
 *                 example: 150000
 *               inviteeIds:
 *                 type: string
 *                 description: "JSON stringifié contenant un tableau d'IDs de memberships. Requis si visibility = INVITE_ONLY"
 *                 example: "[\"654321abc123def456abc000\", \"654321abc123def456abc001\"]"
 *               coverImage:
 *                 type: string
 *                 format: binary
 *                 description: "Image de couverture de l'événement (max 5MB)"
 *     responses:
 *       201:
 *         description: Événement créé avec succès (Brouillon)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EventResponse'
 *       400:
 *         description: Données invalides
 *       403:
 *         description: Permissions insuffisantes
 */
router.post(
  "/:organizationId",
  uploadSingle("coverImage"),
  parseNestedFormData,
  sanitizeBody,
  validate(createEventSchema),
  eventController.create,
);

/**
 * @swagger
 * /api/events/{organizationId}:
 *   get:
 *     summary: Lister les événements accessibles
 *     description: |
 *       Retourne les événements `ORGANIZATION_WIDE` publiés, les événements `INVITE_ONLY` où l'utilisateur est invité,
 *       ainsi que les brouillons (`DRAFT`) créés par l'utilisateur lui-même.
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PUBLISHED, ONGOING, COMPLETED, CANCELLED]
 *         description: Filtrer par statut
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [REUNION, FETE, CONFERENCE, FORMATION, ACTIVITE_SOCIALE, COLLECTE_DE_FONDS, AUTRE]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Liste des événements récupérée
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     events:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/EventListItem'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         pages:
 *                           type: integer
 *       403:
 *         description: Accès non autorisé à l'organisation
 */
router.get(
  "/:organizationId",
  validate(getEventsSchema),
  eventController.getAll,
);

// ─── Routes avec :id ──────────────────────────────────────────

/**
 * @swagger
 * /api/events/{organizationId}/{id}:
 *   get:
 *     summary: Récupérer les détails d'un événement
 *     description: |
 *       Retourne les détails complets de l'événement. Inclut les infos formatées du créateur,
 *       la liste des participants avec leur statut, et le statut de l'utilisateur connecté (`myAttendanceStatus`).
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de l'événement
 *     responses:
 *       200:
 *         description: Détails de l'événement
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/EventDetails'
 *       403:
 *         description: "Accès non autorisé (ex: événement privé sans invitation)"
 *       404:
 *         description: Événement non trouvé
 */
router.get(
  "/:organizationId/:id",
  validate(eventParamSchema),
  eventController.getOne,
);

/**
 * @swagger
 * /api/events/{organizationId}/{id}:
 *   put:
 *     summary: Mettre à jour un événement
 *     description: |
 *       Modifie les informations d'un événement. Réservé au créateur ou aux rôles ADMIN/PRESIDENT.
 *       Impossible de modifier un événement terminé (`COMPLETED`) ou annulé (`CANCELLED`).
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Nouveau titre de l'événement"
 *               description:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               status:
 *                 type: string
 *                 enum: [DRAFT, PUBLISHED, ONGOING, COMPLETED, CANCELLED]
 *                 description: "Permet de changer le statut manuellement si besoin"
 *               coverImage:
 *                 type: string
 *                 format: binary
 *                 description: "Nouvelle image de couverture (remplacera l'ancienne)"
 *     responses:
 *       200:
 *         description: Événement mis à jour
 *       403:
 *         description: Permissions insuffisantes
 *       404:
 *         description: Événement non trouvé
 *       409:
 *         description: Conflit (Impossible de modifier un événement terminé/annulé)
 */
router.put(
  "/:organizationId/:id",
  uploadSingle("coverImage"),
  parseNestedFormData,
  sanitizeBody,
  validate(updateEventSchema),
  eventController.update,
);

/**
 * @swagger
 * /api/events/{organizationId}/{id}/publish:
 *   patch:
 *     summary: Publier un événement
 *     description: |
 *       Passe le statut de l'événement de `DRAFT` à `PUBLISHED`.
 *       Déclenche automatiquement l'envoi de notifications (IN_APP, SMS, EMAIL...) à tous les membres
 *       (si ORGANIZATION_WIDE) ou aux invités sélectionnés (si INVITE_ONLY).
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Événement publié et notifications envoyées
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   example: "Événement publié et notifications envoyées"
 *       403:
 *         description: Permissions insuffisantes
 *       409:
 *         description: Conflit (Seul un brouillon peut être publié)
 */
router.patch(
  "/:organizationId/:id/publish",
  validate(eventParamSchema),
  eventController.publish,
);

/**
 * @swagger
 * /api/events/{organizationId}/{id}/rsvp:
 *   patch:
 *     summary: Répondre à un événement (RSVP)
 *     description: |
 *       Permet à un membre de donner sa réponse d' participation.
 *       - Si l'événement est `INVITE_ONLY`, seul un membre ayant le statut `INVITED` peut répondre.
 *       - Si la réponse est `GOING` et qu'une limite (`maxParticipants`) est définie, vérifie qu'il reste de la place.
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [GOING, MAYBE, NOT_GOING]
 *                 example: "GOING"
 *     responses:
 *       200:
 *         description: Réponse enregistrée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     status:
 *                       type: string
 *                       example: "GOING"
 *                     respondedAt:
 *                       type: string
 *                       format: date-time
 *       403:
 *         description: Non invité à un événement privé, ou inscriptions closes
 *       409:
 *         description: Événement complet (limite de participants atteinte)
 */
router.patch(
  "/:organizationId/:id/rsvp",
  validate(rsvpEventSchema),
  eventController.rsvp,
);

/**
 * @swagger
 * /api/events/{organizationId}/{id}:
 *   delete:
 *     summary: Supprimer un événement
 *     description: |
 *       Supprime définitivement un événement et ses invitations liées (via Cascade Prisma).
 *       Réservé au créateur ou aux rôles ADMIN/PRESIDENT.
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Événement supprimé avec succès
 *       403:
 *         description: Permissions insuffisantes
 *       404:
 *         description: Événement non trouvé
 */
router.delete(
  "/:organizationId/:id",
  validate(eventParamSchema),
  eventController.delete,
);

/**
 * @swagger
 * /api/events/{organizationId}/{id}/cancel:
 *   patch:
 *     summary: Annuler un événement
 *     description: |
 *       Passe le statut de l'événement à `CANCELLED`.
 *       Impossible d'annuler un brouillon (utilisez DELETE) ou un événement déjà terminé/annulé.
 *       Déclenche automatiquement l'envoi de notifications (EVENT_CANCELLED) aux participants.
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Événement annulé
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   example: "Événement annulé et notifications envoyées aux participants"
 *       403:
 *         description: Permissions insuffisantes
 *       409:
 *         description: Conflit (Brouillon ou événement déjà terminé/annulé)
 */
router.patch(
  "/:organizationId/:id/cancel",
  validate(eventParamSchema),
  eventController.cancel,
);

export default router;

/**
 * @swagger
 * components:
 *   schemas:
 *     EventResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         title:
 *           type: string
 *         type:
 *           type: string
 *         visibility:
 *           type: string
 *         status:
 *           type: string
 *           example: "DRAFT"
 *         startDate:
 *           type: string
 *           format: date-time
 *         coverImage:
 *           type: string
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *
 *     EventListItem:
 *       allOf:
 *         - $ref: '#/components/schemas/EventResponse'
 *         - type: object
 *           properties:
 *             createdBy:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     prenom:
 *                       type: string
 *                     nom:
 *                       type: string
 *                     avatar:
 *                       type: string
 *                 provisionalFirstName:
 *                   type: string
 *                   nullable: true
 *                 provisionalLastName:
 *                   type: string
 *                   nullable: true
 *             _count:
 *               type: object
 *               properties:
 *                 attendees:
 *                   type: integer
 *                   description: "Nombre total de participants/invités"
 *             myAttendanceStatus:
 *               type: string
 *               enum: [INVITED, PENDING, GOING, MAYBE, NOT_GOING]
 *               nullable: true
 *               description: "Statut de l'utilisateur connecté pour cet événement"
 *
 *     EventDetails:
 *       allOf:
 *         - $ref: '#/components/schemas/EventListItem'
 *         - type: object
 *           properties:
 *             description:
 *               type: string
 *               nullable: true
 *             endDate:
 *               type: string
 *               format: date-time
 *               nullable: true
 *             location:
 *               type: string
 *               nullable: true
 *             locationUrl:
 *               type: string
 *               format: uri
 *               nullable: true
 *             isOnline:
 *               type: boolean
 *             meetingLink:
 *               type: string
 *               format: uri
 *               nullable: true
 *             maxParticipants:
 *               type: integer
 *               nullable: true
 *             estimatedBudget:
 *               type: number
 *               nullable: true
 *             creatorDisplayInfo:
 *               type: object
 *               properties:
 *                 firstName:
 *                   type: string
 *                 lastName:
 *                   type: string
 *                 avatar:
 *                   type: string
 *                   nullable: true
 *                 hasAccount:
 *                   type: boolean
 *             formattedAttendees:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   status:
 *                     type: string
 *                     enum: [INVITED, GOING, MAYBE, NOT_GOING]
 *                   respondedAt:
 *                     type: string
 *                     format: date-time
 *                     nullable: true
 *                   displayInfo:
 *                     type: object
 *                     properties:
 *                       firstName:
 *                         type: string
 *                       lastName:
 *                         type: string
 *                       avatar:
 *                         type: string
 *                         nullable: true
 *                       hasAccount:
 *                         type: boolean
 *             _count:
 *               type: object
 *               properties:
 *                 attendees:
 *                   type: integer
 *                 expenses:
 *                   type: integer
 *                   description: "Nombre de dépenses liées à cet événement"
 */
