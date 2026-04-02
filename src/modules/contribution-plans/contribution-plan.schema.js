import { z } from "zod";

const FREQUENCIES = ["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY", "CUSTOM"];

export const createPlanSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1, "ID organisation requis"),
  }),
  body: z
    .object({
      name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
      description: z.string().optional(),
      frequency: z.enum(FREQUENCIES, {
        errorMap: () => ({ message: "Fréquence invalide" }),
      }),
      differentiateByGender: z.boolean().default(false),
      amount: z.number().positive("Le montant doit être positif").optional().nullable(),
      amountMale: z.number().positive("Le montant hommes doit être positif").optional().nullable(),
      amountFemale: z.number().positive("Le montant femmes doit être positif").optional().nullable(),
      currency: z.string().default("XOF"),
      startDate: z.string().datetime({ message: "Date de début invalide" }),
      endDate: z
        .string()
        .datetime()
        .optional()
        .or(z.literal(""))
        .transform((val) => val || null),
      isActive: z.boolean().default(true),
    })
    // ✅ Validation croisée montants selon differentiateByGender
    .refine(
      (data) => {
        if (data.differentiateByGender) {
          return !!data.amountMale && !!data.amountFemale;
        }
        return !!data.amount;
      },
      (data) => ({
        message: data.differentiateByGender
          ? "amountMale et amountFemale sont requis quand differentiateByGender est true"
          : "amount est requis quand differentiateByGender est false",
        path: data.differentiateByGender ? ["amountMale"] : ["amount"],
      })
    )
    // ✅ endDate doit être après startDate
    .refine(
      (data) => {
        if (!data.endDate) return true;
        return new Date(data.endDate) > new Date(data.startDate);
      },
      {
        message: "La date de fin doit être après la date de début",
        path: ["endDate"],
      }
    ),
});

export const updatePlanSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
    id: z.string().min(1),
  }),
  body: z
    .object({
      name: z.string().min(2).optional(),
      description: z.string().optional(),
      frequency: z.enum(FREQUENCIES).optional(),
      differentiateByGender: z.boolean().optional(),
      amount: z.number().positive().optional().nullable(),
      amountMale: z.number().positive().optional().nullable(),
      amountFemale: z.number().positive().optional().nullable(),
      currency: z.string().optional(),
      startDate: z.string().datetime().optional(),
      endDate: z
        .string()
        .datetime()
        .optional()
        .or(z.literal(""))
        .transform((val) => val || null),
      isActive: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "Au moins un champ doit être fourni",
    }),
});

export const getPlanSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
    id: z.string().min(1),
  }),
});

export const listPlansSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
  }),
  query: z.object({
    isActive: z
      .string()
      .optional()
      .transform((val) => {
        if (val === "true") return true;
        if (val === "false") return false;
        return undefined;
      }),
    search: z.string().max(100).optional(),
    page: z
      .string()
      .optional()
      .transform((v) => (v ? parseInt(v) : 1))
      .pipe(z.number().min(1)),
    limit: z
      .string()
      .optional()
      .transform((v) => (v ? parseInt(v) : 10))
      .pipe(z.number().min(1).max(100)),
  }),
});

export const generateContributionsSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
    id: z.string().min(1),
  }),
  body: z.object({
    force: z.boolean().default(false),
    dueDateOffset: z.number().int().min(0).default(0),
  }),
});

export const assignToMemberSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
    id: z.string().min(1),
  }),
  body: z.object({
    membershipId: z.string().min(1, "L'ID du membre est requis"),
  }),
});