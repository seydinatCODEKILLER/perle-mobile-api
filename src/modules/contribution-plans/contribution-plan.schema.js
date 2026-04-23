import { z } from "zod";

const FREQUENCIES = ["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY", "CUSTOM"];

// ─── Helpers de pré-transformation ─────────────────────────────
const coerceToNumber = (fieldName) =>
  z.preprocess(
    (val) => {
      if (val === "" || val === null || val === undefined) return null;
      return typeof val === "string" ? parseFloat(val) : val;
    },
    z
      .number({ invalid_type_error: `${fieldName} doit être un nombre` })
      .positive(`${fieldName} doit être positif`)
      .nullable()
      .optional(),
  );

const coerceToBoolean = (defaultValue) =>
  z.preprocess((val) => {
    if (val === undefined) return defaultValue;
    if (typeof val === "string") return val === "true";
    return val;
  }, z.boolean());

const coerceToDate = (fieldName) =>
  z.preprocess(
    (val) => {
      if (!val) return val; // Laisse passer null/undefined pour la logique optionnelle
      return val;
    },
    z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: `${fieldName} invalide (format attendu: YYYY-MM-DD ou ISO 8601)`,
    }),
  );

// ─── Schémas ───────────────────────────────────────────────────

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
      differentiateByGender: coerceToBoolean(false),
      amount: coerceToNumber("Le montant"),
      amountMale: coerceToNumber("Le montant hommes"),
      amountFemale: coerceToNumber("Le montant femmes"),
      currency: z.string().default("XOF"),
      startDate: coerceToDate("La date de début"),
      endDate: z.preprocess(
        (val) => (val === "" ? null : val),
        coerceToDate("La date de fin").nullable().optional(),
      ),
      isActive: coerceToBoolean(true),
    })
    // ✅ Validation croisée montants selon differentiateByGender
    .refine(
      (data) => {
        if (data.differentiateByGender) {
          return data.amountMale !== null && data.amountFemale !== null;
        }
        return data.amount !== null;
      },
      (data) => ({
        message: data.differentiateByGender
          ? "amountMale et amountFemale sont requis quand differentiateByGender est true"
          : "amount est requis quand differentiateByGender est false",
        path: data.differentiateByGender ? ["amountMale"] : ["amount"],
      }),
    )
    // ✅ endDate doit être après startDate
    .refine(
      (data) => {
        if (!data.endDate || !data.startDate) return true;
        return new Date(data.endDate) > new Date(data.startDate);
      },
      {
        message: "La date de fin doit être après la date de début",
        path: ["endDate"],
      },
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
      differentiateByGender: coerceToBoolean(undefined).optional(),
      amount: coerceToNumber("Le montant"),
      amountMale: coerceToNumber("Le montant hommes"),
      amountFemale: coerceToNumber("Le montant femmes"),
      currency: z.string().optional(),
      startDate: coerceToDate("La date de début").optional(),
      endDate: z.preprocess(
        (val) => (val === "" ? null : val),
        coerceToDate("La date de fin").nullable().optional(),
      ),
      isActive: coerceToBoolean(undefined).optional(),
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
      .default("1")
      .transform(Number)
      .pipe(z.number().min(1)),
    limit: z
      .string()
      .optional()
      .default("10")
      .transform(Number)
      .pipe(z.number().min(1).max(100)),
  }),
});

export const generateContributionsSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
    id: z.string().min(1),
  }),
  body: z.object({
    force: z.preprocess(
      (val) => (typeof val === "string" ? val === "true" : val),
      z.boolean().default(false),
    ),
    dueDateOffset: z.preprocess(
      (val) => (typeof val === "string" ? parseInt(val, 10) : val),
      z.number().int().min(0).default(0),
    ),
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
