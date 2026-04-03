import { z } from "zod";

export const listTransactionsSchema = z.object({
  params: z.object({ organizationId: z.string().min(1) }),
  query: z.object({
    type: z
      .enum([
        "CONTRIBUTION",
        "DEBT_REPAYMENT",
        "FINE",
        "DONATION",
        "EXPENSE",
        "WALLET_SETTLEMENT",
        "OTHER",
      ])
      .optional(),
    paymentMethod: z
      .enum([
        "CASH",
        "MOBILE_MONEY",
        "BANK_TRANSFER",
        "CHECK",
        "CREDIT_CARD",
        "INTERNAL",
      ])
      .optional(),
    paymentStatus: z
      .enum(["PENDING", "COMPLETED", "FAILED", "REFUNDED"])
      .optional(),
    membershipId: z.string().min(1).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
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

export const searchTransactionsSchema = z.object({
  params: z.object({ organizationId: z.string().min(1) }),
  query: z.object({
    q: z
      .string()
      .min(2, "Le terme de recherche doit contenir au moins 2 caractères"),
  }),
});

export const transactionParamSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
    id: z.string().min(1),
  }),
});

export const memberTransactionsSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
    membershipId: z.string().min(1),
  }),
  query: z.object({
    type: z
      .enum([
        "CONTRIBUTION",
        "DEBT_REPAYMENT",
        "FINE",
        "DONATION",
        "EXPENSE",
        "OTHER",
      ])
      .optional(),
    paymentMethod: z
      .enum(["CASH", "MOBILE_MONEY", "BANK_TRANSFER", "CHECK", "CREDIT_CARD"])
      .optional(),
    paymentStatus: z
      .enum(["PENDING", "COMPLETED", "FAILED", "REFUNDED"])
      .optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
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

export const myTransactionsSchema = z.object({
  params: z.object({ organizationId: z.string().min(1) }),
  query: z.object({
    type: z
      .enum([
        "CONTRIBUTION",
        "DEBT_REPAYMENT",
        "FINE",
        "DONATION",
        "EXPENSE",
        "OTHER",
      ])
      .optional(),
    paymentMethod: z
      .enum(["CASH", "MOBILE_MONEY", "BANK_TRANSFER", "CHECK", "CREDIT_CARD"])
      .optional(),
    paymentStatus: z
      .enum(["PENDING", "COMPLETED", "FAILED", "REFUNDED"])
      .optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
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

export const statsByTypeSchema = z.object({
  params: z.object({ organizationId: z.string().min(1) }),
  query: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
});

export const orgParamSchema = z.object({
  params: z.object({ organizationId: z.string().min(1) }),
});
