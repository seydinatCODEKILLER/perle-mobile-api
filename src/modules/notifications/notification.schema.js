import { z } from "zod";

const NOTIFICATION_TYPES = [
  "CONTRIBUTION_REMINDER",
  "DEBT_REMINDER",
  "PAYMENT_CONFIRMATION",
  "MEMBERSHIP_UPDATE",
  "SYSTEM_ALERT",
  "EVENT_CREATED", // ✅
  "EVENT_UPDATED", // ✅
  "EVENT_REMINDER", // ✅
  "EVENT_CANCELLED", // ✅
];

const NOTIFICATION_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export const sendNotificationSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1, "ID organisation requis"),
  }),
  body: z
    .object({
      membershipId: z.string().min(1).optional(),
      sendToAll: z.boolean().default(false),
      type: z.enum(NOTIFICATION_TYPES, {
        errorMap: () => ({ message: "Type de notification invalide" }),
      }),
      title: z.string().min(2).max(100),
      message: z.string().min(2).max(500),
      priority: z.enum(NOTIFICATION_PRIORITIES).default("MEDIUM"),
    })
    .refine((data) => data.sendToAll || data.membershipId, {
      message: "membershipId est requis si sendToAll est false",
      path: ["membershipId"],
    }),
});

export const getNotificationSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
    id: z.string().min(1),
  }),
});

export const listNotificationsSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
  }),
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val) : 1))
      .pipe(z.number().min(1)),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val) : 20))
      .pipe(z.number().min(1).max(100)),
    type: z.enum(NOTIFICATION_TYPES).optional(),
    status: z.enum(["PENDING", "SENT", "FAILED", "DELIVERED"]).optional(),
  }),
});

export const orgParamSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
  }),
});
