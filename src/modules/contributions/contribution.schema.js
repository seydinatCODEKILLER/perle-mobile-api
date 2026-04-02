import { z } from "zod";

export const listContributionsSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
  }),
  query: z.object({
    status: z
      .enum(["PENDING", "PAID", "PARTIAL", "OVERDUE", "CANCELLED"])
      .optional(),
    membershipId: z.string().uuid().optional(),
    contributionPlanId: z.string().uuid().optional(),
    startDate: z
      .string()
      .transform((val) => new Date(val))
      .optional(),
    endDate: z
      .string()
      .transform((val) => new Date(val))
      .optional(),
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

export const contributionParamSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
    id: z.string().min(1),
  }),
});

export const markAsPaidSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
    id: z.string().min(1),
  }),
  body: z.object({
    amountPaid: z
      .number({ message: "Le montant payé est requis" })
      .positive("Le montant doit être positif"),
    paymentMethod: z.enum(
      ["CASH", "MOBILE_MONEY", "BANK_TRANSFER", "CHECK", "CREDIT_CARD"],
      {
        message: "Méthode de paiement invalide",
      },
    ),
  }),
});

export const addPartialPaymentSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
    id: z.string().min(1),
  }),
  body: z.object({
    amount: z
      .number({ message: "Le montant est requis" })
      .positive("Le montant doit être positif"),
    paymentMethod: z.enum(
      ["CASH", "MOBILE_MONEY", "BANK_TRANSFER", "CHECK", "CREDIT_CARD"],
      {
        message: "Méthode de paiement invalide",
      },
    ),
  }),
});

export const memberContributionsSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
    membershipId: z.string().min(1),
  }),
  query: z.object({
    status: z
      .enum(["PENDING", "PAID", "PARTIAL", "OVERDUE", "CANCELLED"])
      .optional(),
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

export const myContributionsSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
  }),
  query: z.object({
    status: z
      .enum(["PENDING", "PAID", "PARTIAL", "OVERDUE", "CANCELLED"])
      .optional(),
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

export const cancelContributionSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
    id: z.string().min(1),
  }),
  body: z.object({
    reason: z
      .string()
      .max(500, "La raison ne peut pas dépasser 500 caractères")
      .optional(),
  }),
});
