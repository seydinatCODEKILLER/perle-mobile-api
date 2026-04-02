import { z } from "zod";

const DEBT_STATUSES = [
  "ACTIVE",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "CANCELLED",
];
const PAYMENT_METHODS = [
  "CASH",
  "MOBILE_MONEY",
  "BANK_TRANSFER",
  "CHECK",
  "CREDIT_CARD",
];

const paginationSchema = {
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
};

export const createDebtSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1, "ID organisation requis"),
  }),
  body: z.object({
    membershipId: z.string().min(1, "L'ID du membre est requis"),
    title: z.string().min(2, "Le titre doit contenir au moins 2 caractères"),
    description: z.string().optional(),
    initialAmount: z
      .number({ message: "Le montant initial est requis" })
      .positive("Le montant doit être positif"),
    dueDate: z
      .string()
      .datetime({ message: "Format de date invalide (ISO 8601)" })
      .optional()
      .or(z.literal(""))
      .transform((val) => val || null),
    status: z.enum(DEBT_STATUSES).default("ACTIVE"),
  }),
});

export const addRepaymentSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
    id: z.string().min(1),
  }),
  body: z.object({
    amount: z
      .number({ message: "Le montant est requis" })
      .positive("Le montant doit être positif"),
    paymentMethod: z.enum(PAYMENT_METHODS, {
      errorMap: () => ({ message: "Méthode de paiement invalide" }),
    }),
  }),
});

export const updateDebtStatusSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
    id: z.string().min(1),
  }),
  body: z.object({
    status: z.enum(DEBT_STATUSES, {
      errorMap: () => ({ message: "Statut invalide" }),
    }),
  }),
});

export const cancelDebtSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
    id: z.string().min(1),
  }),
  body: z.object({
    reason: z.string().max(500).optional(),
  }),
});

export const debtParamSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
    id: z.string().min(1),
  }),
});

export const orgParamSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
  }),
});

export const listDebtsSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
  }),
  query: z.object({
    status: z.enum(DEBT_STATUSES).optional(),
    membershipId: z.string().optional(),
    search: z.string().max(100).optional(),
    ...paginationSchema,
  }),
});

export const memberDebtsSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
    membershipId: z.string().min(1),
  }),
  query: z.object({
    status: z.enum(DEBT_STATUSES).optional(),
    ...paginationSchema,
  }),
});

export const myDebtsSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
  }),
  query: z.object({
    status: z.enum(DEBT_STATUSES).optional(),
    ...paginationSchema,
  }),
});
