// src/modules/subscriptions/subscription.schema.js
import { z } from "zod";

const SUBSCRIPTION_PLANS = ["FREE", "BASIC", "PREMIUM", "ENTERPRISE"];
const SUBSCRIPTION_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED", "CANCELLED", "EXPIRED"];

export const orgParamSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1, "L'ID de l'organisation est requis"),
  }),
});

export const updateSubscriptionSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
  }),
  body: z.object({
    plan: z.enum(SUBSCRIPTION_PLANS).optional(),
    maxMembers: z.coerce
      .number({ invalid_type_error: "maxMembers doit être un nombre" })
      .int()
      .positive()
      .optional(),
    price: z.coerce
      .number({ invalid_type_error: "Le prix doit être un nombre" })
      .nonnegative()
      .optional(),
    currency: z.string().length(3).optional(),
    startDate: z.string().datetime({ message: "Format de date invalide" }).optional(),
    endDate: z.string().datetime({ message: "Format de date invalide" }).optional(),
  }).refine((data) => Object.keys(data).length > 0, {
    message: "Au moins un champ doit être fourni pour la mise à jour",
  }),
});

export const updateSubscriptionStatusSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
  }),
  body: z.object({
    status: z.enum(SUBSCRIPTION_STATUSES, {
      errorMap: () => ({ message: "Statut d'abonnement invalide" }),
    }),
  }),
});

export const changePlanSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
  }),
  body: z.object({
    plan: z.enum(SUBSCRIPTION_PLANS, {
      errorMap: () => ({ message: "Plan invalide ou non disponible" }),
    }),
  }),
});