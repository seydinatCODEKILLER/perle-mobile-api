import { Router } from "express";
import { DashboardController } from "./dashboard.controller.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { protect } from "../../shared/middlewares/auth.middleware.js";
import { orgParamSchema, autoDashboardSchema } from "./dashboard.schema.js";

const router = Router();
const dashController = new DashboardController();

router.use(protect());

/**
 * @swagger
 * /api/dashboards/{organizationId}:
 *   get:
 *     summary: Récupérer le dashboard par défaut (Redirection intelligente)
 *     description: |
 *       🎯 **Route principale - Redirection automatique selon le rôle**
 *
 *       Cette route détecte automatiquement le rôle de l'utilisateur et retourne
 *       le dashboard approprié avec une instruction de redirection (`redirectTo`).
 *
 *       **Comportement par rôle :**
 *       - 👤 **MEMBER** → Renvoie les données du Dashboard Personnel (`redirectTo: "personal"`)
 *       - 💼 **FINANCIAL_MANAGER** → Renvoie les données du Dashboard de Gestion (`redirectTo: "management"`)
 *       - 👑 **ADMIN** → Renvoie les données du Dashboard de Gestion (`redirectTo: "management"`)
 *
 *       *Note : Le frontend devrait utiliser cette route pour la navigation initiale, puis appeler les routes spécifiques (`/management` ou `/personal`) pour les changements d'onglets.*
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de l'organisation
 *     responses:
 *       200:
 *         description: Dashboard récupéré avec instruction de redirection
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Dashboard récupéré avec succès"
 *                 data:
 *                   type: object
 *                   properties:
 *                     redirectTo:
 *                       type: string
 *                       enum: [personal, management]
 *                       example: "management"
 *                       description: Espace vers lequel le frontend devrait rediriger l'utilisateur
 *                     data:
 *                       type: object
 *                       description: Les données complètes du dashboard correspondant au rôle
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Utilisateur non membre de l'organisation
 */
router.get(
  "/:organizationId",
  validate(orgParamSchema),
  dashController.getDefaultDashboard
);

/**
 * @swagger
 * /api/dashboards/{organizationId}/management:
 *   get:
 *     summary: Récupérer le dashboard de GESTION (Admin & Financial)
 *     description: |
 *       💼 **Espace de gestion de l'organisation**
 *
 *       Accessible uniquement par les rôles **ADMIN** et **FINANCIAL_MANAGER**.
 *       Les données retournées varient légèrement selon le rôle :
 *       - **ADMIN** : A accès au bloc `subscription` (infos d'abonnement).
 *       - **FINANCIAL_MANAGER** : A accès aux blocs `executionFocus` et `performance` (focus opérationnel).
 *
 *       **Structure de la réponse :**
 *       - `kpis` : Indicateurs clés (Membres, Collecte, Dettes).
 *       - `financialOverview` : Vue d'ensemble du Wallet et des Dépenses.
 *       - `charts` : Données pour graphiques (Tendances, Répartitions).
 *       - `recentActivities` : Dernières actions tracées dans l'organisation.
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Données du dashboard de gestion
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
 *                     role:
 *                       type: string
 *                       enum: [ADMIN, FINANCIAL_MANAGER]
 *                       example: "ADMIN"
 *                     generatedAt:
 *                       type: string
 *                       format: date-time
 *                     kpis:
 *                       type: object
 *                       properties:
 *                         activeMembers:
 *                           type: object
 *                           properties:
 *                             value: { type: integer, example: 42 }
 *                             trend: { type: number, description: "Pourcentage d'évolution par rapport au mois précédent" }
 *                         totalCollected:
 *                           type: object
 *                           properties:
 *                             value: { type: number, example: 1500000 }
 *                             currency: { type: string, example: "XOF" }
 *                         pendingContributions:
 *                           type: object
 *                           properties:
 *                             value: { type: integer }
 *                             details:
 *                               type: object
 *                               properties:
 *                                 remaining: { type: number, description: "Montant restant à payer" }
 *                     financialOverview:
 *                       type: object
 *                       properties:
 *                         wallet:
 *                           $ref: '#/components/schemas/OrganizationWallet'
 *                         expenses:
 *                           type: object
 *                           properties:
 *                             total:
 *                               type: object
 *                               properties:
 *                                 amount: { type: number }
 *                                 count: { type: integer }
 *                             byCategory:
 *                               type: array
 *                               items:
 *                                 type: object
 *                                 properties:
 *                                   category: { type: string }
 *                                   label: { type: string, example: "Événement" }
 *                                   amount: { type: number }
 *                     charts:
 *                       type: object
 *                       properties:
 *                         monthlyRevenue:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               month: { type: string, example: "2024-01" }
 *                               amount: { type: number }
 *                               label: { type: string, example: "janvier 2024" }
 *                     recentActivities:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           action: { type: string, example: "CREATE_EXPENSE" }
 *                           user: { type: object, properties: { prenom: { type: string }, nom: { type: string } } }
 *                           createdAt: { type: string, format: date-time }
 *       403:
 *         description: Permissions insuffisantes (Rôle MEMBER)
 *       401:
 *         description: Non authentifié
 */
router.get(
  "/:organizationId/management",
  validate(orgParamSchema),
  dashController.getManagementDashboard
);

/**
 * @swagger
 * /api/dashboards/{organizationId}/personal:
 *   get:
 *     summary: Récupérer le dashboard PERSONNEL
 *     description: |
 *       👤 **Espace personnel du membre connecté**
 *
 *       ✅ **Accessible par TOUS les rôles** (ADMIN, FINANCIAL_MANAGER, MEMBER).
 *       *Pourquoi ?* Car même un ADMIN possède ses propres cotisations, dettes et statistiques de paiement au sein de l'organisation.
 *
 *       Le `membershipId` est déterminé automatiquement à partir du token JWT, le frontend n'a rien à fournir.
 *
 *       **Données retournées :**
 *       - `memberInfo` : Profil public du membre.
 *       - `kpis` : Résumé de ce que le membre doit/paie.
 *       - `contributions` : Découpé en 3 listes (Actives, En retard, À venir).
 *       - `debts` : Dettes actives du membre avec pourcentage de remboursement.
 *       - `statistics` : Taux de régularité et délai moyen de paiement.
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Données du dashboard personnel
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
 *                     role:
 *                       type: string
 *                       example: "MEMBER"
 *                     membershipId:
 *                       type: string
 *                       description: "ID du membership auto-détecté"
 *                     memberInfo:
 *                       type: object
 *                       properties:
 *                         memberNumber: { type: string, example: "MBR001" }
 *                         fullName: { type: string, example: "Jean Dupont" }
 *                         joinDate: { type: string, format: date-time }
 *                         role: { type: string }
 *                     kpis:
 *                       type: object
 *                       properties:
 *                         totalDue: { type: number, description: "Total historique à payer" }
 *                         totalPaid: { type: number, description: "Total historique payé" }
 *                         totalRemaining: { type: number, description: "Ce qui reste à payer globalement" }
 *                         overdueAmount: { type: number, description: "Montant des cotisations en retard pur" }
 *                     contributions:
 *                       type: object
 *                       properties:
 *                         active:
 *                           type: array
 *                           description: "Cotisations en cours (PENDING/PARTIAL)"
 *                           items:
 *                             type: object
 *                             properties:
 *                               id: { type: string }
 *                               planName: { type: string }
 *                               remaining: { type: number }
 *                               dueDate: { type: string, format: date-time }
 *                         overdue:
 *                           type: array
 *                           description: "Cotisations en retard (OVERDUE)"
 *                           items:
 *                             type: object
 *                             properties:
 *                               daysLate: { type: integer, description: "Nombre de jours de retard" }
 *                               remaining: { type: number }
 *                         upcoming:
 *                           type: array
 *                           description: "Cotisations à venir (dans le mois)"
 *                           items:
 *                             type: object
 *                             properties:
 *                               daysUntilDue: { type: integer, description: "Jours restants avant l'échéance" }
 *                     debts:
 *                       type: object
 *                       properties:
 *                         aggregates:
 *                           type: object
 *                           properties:
 *                             activeDebtsCount: { type: integer }
 *                             totalDebtRemaining: { type: number }
 *                     statistics:
 *                       type: object
 *                       description: "Statistiques de comportement de paiement"
 *                       properties:
 *                         paymentRegularityRate: { type: number, description: "Pourcentage de paiements faits dans les 7 jours" }
 *                         averagePaymentDelay: { type: number, description: "Délai moyen en jours (positif = en retard, négatif = en avance)" }
 *       403:
 *         description: Utilisateur non membre de l'organisation
 *       401:
 *         description: Non authentifié
 */
router.get(
  "/:organizationId/personal",
  validate(orgParamSchema),
  dashController.getPersonalDashboard
);

/**
 * @swagger
 * /api/dashboards/{organizationId}/auto:
 *   get:
 *     summary: Récupérer le dashboard de manière flexible (Espace sélectionnable)
 *     description: |
 *       🔄 **Route flexible pour changements d'onglets dynamiques**
 *
 *       Permet de demander explicitement un espace de dashboard via le paramètre `space`.
 *       Très utile pour les Single Page Applications (SPA) où le frontend gère
 *       la navigation par onglets sans recharger la page.
 *
 *       **Logique de validation :**
 *       - Si `space=personal` : Accès garanti si l'utilisateur est membre actif.
 *       - Si `space=management` : Vérifie que le rôle est ADMIN ou FINANCIAL_MANAGER, sinon erreur 403.
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: space
 *         required: false
 *         schema:
 *           type: string
 *           enum: [personal, management]
 *           default: management
 *         description: "L'espace de dashboard souhaité"
 *     responses:
 *       200:
 *         description: Données de l'espace demandé
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   description: "Retourne la structure du dashboard personnel ou de gestion selon l'espace demandé"
 *       400:
 *         description: Espace invalide (valeur non reconnue dans l'enum)
 *       403:
 *         description: Permissions insuffisantes pour accéder à l'espace de gestion
 *       401:
 *         description: Non authentifié
 */
router.get(
  "/:organizationId/auto",
  validate(autoDashboardSchema),
  dashController.getAutoDashboard
);

export default router;