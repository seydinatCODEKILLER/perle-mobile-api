import { z } from "zod";
import { objectId } from "../../shared/utils/schema.helpers.js";

export const PAYABLE_TYPES = ["CONTRIBUTION", "DEBT"];

export const initiatePaymentSchema = z.object({
  params: z.object({
    organizationId: objectId("L'organisation"),
  }),
  body: z.object({
    type: z.enum(PAYABLE_TYPES, {
      errorMap: () => ({ message: "Le type doit être CONTRIBUTION ou DEBT" }),
    }),
    resourceId: objectId("La ressource"),
    successUrl: z
      .string()
      .url("URL de succès invalide")
      .optional()
      .default("https://app.organisation.sn/payment/success"),
    errorUrl: z
      .string()
      .url("URL d'erreur invalide")
      .optional()
      .default("https://app.organisation.sn/payment/error"),
  }),
});

export const checkPaymentSchema = z.object({
  params: z.object({
    organizationId: objectId("L'organisation"),
    sessionId: z.string().min(1, "Session ID requis"),
  }),
});