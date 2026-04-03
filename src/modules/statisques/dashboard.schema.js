import { z } from "zod";

export const orgParamSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1, "L'ID de l'organisation est requis"),
  }),
});

export const autoDashboardSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
  }),
  query: z.object({
    space: z.enum(["personal", "management"]).default("management"),
  }),
});