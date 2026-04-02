import { z } from "zod";

const EXPENSE_CATEGORIES = [
  "EVENT",
  "SOCIAL",
  "ADMINISTRATIVE",
  "MAINTENANCE",
  "DONATION",
  "INVESTMENT",
  "OPERATIONAL",
  "OTHER",
];

const EXPENSE_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "PAID",
  "CANCELLED",
];

const PAYMENT_METHODS = [
  "CASH",
  "MOBILE_MONEY",
  "BANK_TRANSFER",
  "CHECK",
  "CREDIT_CARD",
];

export const createExpenseSchema = z.object({
  body: z.object({
    title: z
      .string({ message: "Le titre est requis" })
      .min(2, { message: "Le titre doit contenir au moins 2 caractères" })
      .max(100, { message: "Le titre ne peut pas dépasser 100 caractères" }),
    description: z
      .string()
      .max(500, { message: "La description ne peut pas dépasser 500 caractères" })
      .optional(),
    amount: z
      .number({ message: "Le montant est requis" })
      .positive({ message: "Le montant doit être positif" })
      .max(1000000000, { message: "Montant trop élevé" }),
    category: z.enum(EXPENSE_CATEGORIES, {
      errorMap: () => ({ message: "Catégorie invalide" }),
    }),
    expenseDate: z
      .string()
      .optional()
      .transform((val) => (val ? new Date(val) : undefined))
      .refine((date) => !date || !isNaN(date.getTime()), {
        message: "Date invalide",
      }),
  }),
  params: z.object({
    organizationId: z.string().min(1, "L'ID de l'organisation est requis"),
  }),
});

export const payExpenseSchema = z.object({
  body: z.object({
    paymentMethod: z.enum(PAYMENT_METHODS, {
      errorMap: () => ({ message: "Méthode de paiement invalide" }),
    }),
    reference: z
      .string()
      .max(100, { message: "La référence ne peut pas dépasser 100 caractères" })
      .optional(),
    notes: z
      .string()
      .max(500, { message: "Les notes ne peuvent pas dépasser 500 caractères" })
      .optional(),
  }),
  params: z.object({
    organizationId: z.string().min(1),
    expenseId: z.string().min(1),
  }),
});

export const rejectExpenseSchema = z.object({
  body: z.object({
    reason: z
      .string()
      .min(3, { message: "La raison du rejet doit contenir au moins 3 caractères" })
      .max(500, { message: "La raison ne peut pas dépasser 500 caractères" })
      .optional(),
  }),
  params: z.object({
    organizationId: z.string().min(1),
    expenseId: z.string().min(1),
  }),
});

export const cancelExpenseSchema = z.object({
  body: z.object({
    reason: z
      .string()
      .min(3, { message: "La raison de l'annulation doit contenir au moins 3 caractères" })
      .max(500, { message: "La raison ne peut pas dépasser 500 caractères" })
      .optional(),
  }),
  params: z.object({
    organizationId: z.string().min(1),
    expenseId: z.string().min(1),
  }),
});

export const getExpensesSchema = z.object({
  query: z.object({
    status: z.enum(EXPENSE_STATUSES).optional(),
    category: z.enum(EXPENSE_CATEGORIES).optional(),
    createdById: z.string().optional(),
    startDate: z
      .string()
      .optional()
      .transform((val) => (val ? new Date(val) : undefined))
      .refine((date) => !date || !isNaN(date.getTime()), {
        message: "Date de début invalide",
      }),
    endDate: z
      .string()
      .optional()
      .transform((val) => (val ? new Date(val) : undefined))
      .refine((date) => !date || !isNaN(date.getTime()), {
        message: "Date de fin invalide",
      }),
    search: z
      .string()
      .min(2, { message: "La recherche doit contenir au moins 2 caractères" })
      .optional(),
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
  params: z.object({
    organizationId: z.string().min(1),
  }),
});

export const getExpenseByIdSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
    expenseId: z.string().min(1),
  }),
});

export const approveExpenseSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
    expenseId: z.string().min(1),
  }),
});

export const getExpenseStatsSchema = z.object({
  query: z.object({
    startDate: z
      .string()
      .optional()
      .transform((val) => (val ? new Date(val) : undefined))
      .refine((date) => !date || !isNaN(date.getTime()), {
        message: "Date de début invalide",
      }),
    endDate: z
      .string()
      .optional()
      .transform((val) => (val ? new Date(val) : undefined))
      .refine((date) => !date || !isNaN(date.getTime()), {
        message: "Date de fin invalide",
      }),
  }),
  params: z.object({
    organizationId: z.string().min(1),
  }),
});

export const expenseParamSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
    expenseId: z.string().min(1),
  }),
});