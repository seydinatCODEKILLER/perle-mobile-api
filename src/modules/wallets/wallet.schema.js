import { z } from "zod";

export const orgParamSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
  }),
});

export const walletIdParamSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
    walletId: z.string().min(1),
  }),
});

export const reconcileSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
  }),
  body: z.object({
    expectedBalance: z.coerce
      .number({ message: "Le solde attendu est requis" })
      .min(0, "Le solde attendu doit être positif"),
    note: z
      .string()
      .max(500, "La note ne peut pas dépasser 500 caractères")
      .optional(),
  }),
});
