import { env } from "./env.js";

export const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Perle API",
      version: "1.0.0",
      description:
        "API complète de gestion de dahira - Gestion des transactions, catégories, dashboard, alertes et rapports",
      contact: {
        name: "Support Perle",
        email: "support@perle.com",
      },
      license: {
        name: "MIT",
        url: "https://spdx.org/licenses/MIT.html",
      },
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}`,
        description: "Serveur de développement",
      },
      {
        url: "https://perle-mobile-api-production-4db9.up.railway.app",
        description: "Serveur de production",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        // Schémas communs
        Error: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: false,
            },
            message: {
              type: "string",
              example: "Erreur de validation",
            },
            data: {
              type: "object",
              nullable: true,
            },
          },
        },
        Success: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: true,
            },
            message: {
              type: "string",
              example: "Opération réussie",
            },
            data: {
              type: "object",
            },
          },
        },

        // Schémas Authentication
        User: {
          type: "object",
          properties: {
            id: { type: "string", example: "507f1f77bcf86cd799439011" },
            nom: { type: "string", example: "Dupont" },
            prenom: { type: "string", example: "Jean" },
            email: { type: "string", example: "jean.dupont@email.com" },
            role: { type: "string", enum: ["USER", "ADMIN"], example: "USER" },
            avatarUrl: { type: "string", nullable: true },
            status: {
              type: "string",
              enum: ["ACTIVE", "SUSPENDED", "DESACTIVATED", "DELETED"],
              example: "ACTIVE",
            },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        AuthResponse: {
          type: "object",
          properties: {
            user: { $ref: "#/components/schemas/User" },
            token: {
              type: "string",
              example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            },
          },
        },

        // Schémas Transactions
        Transaction: {
          type: "object",
          properties: {
            id: { type: "string", example: "507f1f77bcf86cd799439011" },
            type: {
              type: "string",
              enum: ["REVENUE", "DEPENSE"],
              example: "DEPENSE",
            },
            amount: { type: "number", example: 45.5 },
            categoryId: { type: "string", example: "507f1f77bcf86cd799439012" },
            description: { type: "string", example: "Courses supermarché" },
            date: { type: "string", format: "date-time" },
            status: {
              type: "string",
              enum: ["ACTIVE", "ARCHIVED", "DELETED"],
              example: "ACTIVE",
            },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },

        // Schémas Categories
        Category: {
          type: "object",
          properties: {
            id: { type: "string", example: "507f1f77bcf86cd799439011" },
            name: { type: "string", example: "Courses" },
            type: {
              type: "string",
              enum: ["REVENUE", "DEPENSE"],
              example: "DEPENSE",
            },
            color: { type: "string", example: "#10B981" },
            icon: { type: "string", example: "🛒" },
            isDefault: { type: "boolean", example: false },
            budgetLimit: { type: "number", nullable: true, example: 500 },
            status: {
              type: "string",
              enum: ["ACTIVE", "ARCHIVED", "DELETED"],
              example: "ACTIVE",
            },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },

        // Schémas Dashboard
        DashboardOverview: {
          type: "object",
          properties: {
            summary: {
              type: "object",
              properties: {
                balance: { type: "number", example: 1250.5 },
                totalRevenue: { type: "number", example: 3000.0 },
                totalExpenses: { type: "number", example: 1749.5 },
                transactionsCount: { type: "integer", example: 24 },
                budgetAlertsCount: { type: "integer", example: 2 },
              },
            },
            budgetStatus: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  categoryId: { type: "string" },
                  categoryName: { type: "string" },
                  spent: { type: "number" },
                  budget: { type: "number" },
                  remaining: { type: "number" },
                  percentage: { type: "integer" },
                  color: { type: "string" },
                  icon: { type: "string" },
                  status: {
                    type: "string",
                    enum: ["safe", "warning", "danger"],
                  },
                },
              },
            },
            recentTransactions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  type: { type: "string", enum: ["REVENUE", "DEPENSE"] },
                  amount: { type: "number" },
                  description: { type: "string" },
                  date: { type: "string", format: "date-time" },
                  category: { type: "string" },
                  color: { type: "string" },
                  icon: { type: "string" },
                },
              },
            },
            period: { type: "string", example: "30 derniers jours" },
          },
        },

        // Schémas Alertes
        Alert: {
          type: "object",
          properties: {
            id: { type: "string", example: "507f1f77bcf86cd799439011" },
            type: {
              type: "string",
              enum: ["BUDGET_DEPASSE", "SEUIL_ATTEINT", "DEPENSE_IMPORTANTE"],
              example: "BUDGET_DEPASSE",
            },
            sourceType: {
              type: "string",
              enum: ["GLOBAL", "CATEGORY", "TRANSACTION"],
              example: "CATEGORY",
            },
            category: {
              type: "object",
              nullable: true,
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                color: { type: "string" },
                icon: { type: "string" },
              },
            },
            message: {
              type: "string",
              example: "Budget dépassé pour Courses : 550€ dépensés sur 500€",
            },
            amount: { type: "number", nullable: true, example: 550 },
            threshold: { type: "number", nullable: true, example: 500 },
            isRead: { type: "boolean", example: false },
            status: {
              type: "string",
              enum: ["ACTIVE", "ARCHIVED", "DELETED", "SUSPENDED"],
              example: "ACTIVE",
            },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },

        // Schémas Rapports
        Report: {
          type: "object",
          properties: {
            id: { type: "string", example: "507f1f77bcf86cd799439011" },
            title: { type: "string", example: "Rapport mensuel Janvier 2024" },
            type: {
              type: "string",
              enum: ["MONTHLY", "QUARTERLY", "YEARLY", "CUSTOM"],
              example: "MONTHLY",
            },
            period: { type: "string", example: "2024-01" },
            data: { type: "object" },
            status: {
              type: "string",
              enum: ["PENDING", "COMPLETED", "FAILED"],
              example: "COMPLETED",
            },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },

        Notification: {
          type: "object",
          properties: {
            id: { type: "string", example: "65a1b2c3d4e5f6g7h8i9j0k" },
            organizationId: { type: "string" },
            membershipId: { type: "string", nullable: true },
            type: {
              type: "string",
              enum: [
                "CONTRIBUTION_REMINDER",
                "DEBT_REMINDER",
                "PAYMENT_CONFIRMATION",
                "MEMBERSHIP_UPDATE",
                "SYSTEM_ALERT",
              ],
            },
            title: { type: "string", example: "Rappel de cotisation" },
            message: {
              type: "string",
              example: "Votre cotisation est due demain.",
            },
            priority: {
              type: "string",
              enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
            },
            channels: {
              type: "array",
              items: {
                type: "string",
                enum: ["IN_APP", "EMAIL", "SMS", "WHATSAPP"],
              },
            },
            status: {
              type: "string",
              enum: ["PENDING", "SENT", "FAILED", "DELIVERED"],
            },
            relatedId: {
              type: "string",
              nullable: true,
              description: "ID de la cotisation ou dette liée",
            },
            relatedType: {
              type: "string",
              nullable: true,
              enum: ["CONTRIBUTION", "DEBT"],
            },
            sentAt: { type: "string", format: "date-time", nullable: true },
            createdAt: { type: "string", format: "date-time" },
          },
        },
      },
      parameters: {
        periodQuery: {
          in: "query",
          name: "period",
          required: false,
          schema: {
            type: "string",
            enum: ["week", "month", "quarter", "year"],
            default: "month",
          },
          description: "Période pour les données",
        },
        monthsQuery: {
          in: "query",
          name: "months",
          required: false,
          schema: {
            type: "integer",
            minimum: 1,
            maximum: 12,
            default: 6,
          },
          description: "Nombre de mois pour les tendances",
        },
        pageQuery: {
          in: "query",
          name: "page",
          required: false,
          schema: {
            type: "integer",
            minimum: 1,
            default: 1,
          },
          description: "Numéro de page",
        },
        pageSizeQuery: {
          in: "query",
          name: "pageSize",
          required: false,
          schema: {
            type: "integer",
            minimum: 1,
            maximum: 100,
            default: 10,
          },
          description: "Taille de la page",
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [
    "./src/routes/*.js",
    "./src/controllers/*.js",
    "./src/modules/**/*.routes.js",
    "./src/modules/**/*.controller.js",
  ],
};
