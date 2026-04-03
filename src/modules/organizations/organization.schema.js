import { z } from "zod";

const ORGANIZATION_TYPES = ["DAHIRA", "ASSOCIATION", "TONTINE", "GROUPEMENT"];

const settingsSchema = z
  .object({
    allowPartialPayments: z.boolean().default(false),
    autoReminders: z.boolean().default(true),
    reminderDays: z.array(z.number().int().min(1).max(30)).default([1, 3, 7]),
    emailNotifications: z.boolean().default(true),
    smsNotifications: z.boolean().default(false),
    whatsappNotifications: z.boolean().default(false),
    sessionTimeout: z.number().int().min(5).max(480).default(60),
  })
  .optional();

const walletSchema = z
  .object({
    initialBalance: z
      .number()
      .nonnegative("Le solde initial doit être positif ou nul")
      .default(0),
  })
  .optional();

export const createOrganizationSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
    description: z.string().optional(),
    type: z.enum(ORGANIZATION_TYPES, {
      errorMap: () => ({ message: "Type d'organisation invalide" }),
    }),
    currency: z.string().default("XOF"),
    address: z.string().optional(),
    city: z.string().optional(),
    country: z.string().default("Sénégal"),
    settings: settingsSchema,
    wallet: walletSchema,
  }),
});

export const updateOrganizationSchema = z.object({
  body: z
    .object({
      name: z.string().min(2).optional(),
      description: z.string().optional(),
      type: z.enum(ORGANIZATION_TYPES).optional(),
      currency: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      country: z.string().optional(),
      isActive: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "Au moins un champ doit être fourni",
    }),
  params: z.object({ id: z.string().min(1) }),
});

export const updateSettingsSchema = z.object({
  body: z
    .object({
      allowPartialPayments: z.boolean().optional(),
      autoReminders: z.boolean().optional(),
      reminderDays: z.array(z.number().int().min(1).max(30)).min(1).optional(),
      emailNotifications: z.boolean().optional(),
      smsNotifications: z.boolean().optional(),
      whatsappNotifications: z.boolean().optional(),
      sessionTimeout: z.number().int().min(5).max(480).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "Au moins un champ doit être fourni",
    }),
  params: z.object({ id: z.string().min(1) }),
});

export const updateWalletSchema = z.object({
  body: z
    .object({
      currentBalance: z.number().nonnegative().optional(),
      initialBalance: z.number().nonnegative().optional(),
      totalIncome: z.number().nonnegative().optional(),
      totalExpenses: z.number().nonnegative().optional(),
    })
    .strict({ message: "Champs non autorisés dans la requête" })
    .refine((data) => Object.keys(data).length > 0, {
      message: "Au moins un champ doit être fourni",
    })
    .refine(
      (data) => {
        if (
          data.totalIncome !== undefined &&
          data.totalExpenses !== undefined
        ) {
          return data.totalExpenses <= data.totalIncome;
        }
        return true;
      },
      {
        message:
          "Le total des dépenses ne peut pas dépasser le total des revenus",
      },
    ),
  params: z.object({ id: z.string().min(1) }),
});

export const organizationParamSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

export const searchOrganizationSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    type: z.enum(ORGANIZATION_TYPES).optional(),
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

export const listOrganizationsSchema = z.object({
  query: z.object({
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
