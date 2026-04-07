import { z } from "zod";

const EVENT_TYPES = [
  "REUNION",
  "FETE",
  "CONFERENCE",
  "FORMATION",
  "ACTIVITE_SOCIALE",
  "COLLECTE_DE_FONDS",
  "AUTRE",
];

export const createEventSchema = z.object({
  params: z.object({ organizationId: z.string().min(1) }),
  body: z
    .object({
      title: z.string().min(1, "Le titre est requis"),
      description: z.string().optional(),
      type: z.enum(EVENT_TYPES),
      visibility: z
        .enum(["ORGANIZATION_WIDE", "INVITE_ONLY"])
        .default("ORGANIZATION_WIDE"),
      startDate: z.string().datetime("Date de début invalide"),
      endDate: z
        .string()
        .datetime("Date de fin invalide")
        .optional()
        .nullable(),
      location: z.string().optional().nullable(),
      locationUrl: z
        .string()
        .url("URL invalide")
        .optional()
        .nullable()
        .or(z.literal("")),
      isOnline: z.boolean().optional().default(false),
      meetingLink: z
        .string()
        .url("Lien invalide")
        .optional()
        .nullable()
        .or(z.literal("")),
      // ✅ PLUS DE z.preprocess ! Juste la validation finale.
      maxParticipants: z.number().int().positive().nullable().optional(),
      estimatedBudget: z.number().nonnegative().nullable().optional(),
      inviteeIds: z.array(z.string().min(1)).optional().nullable(),
    })
    .refine(
      (data) => {
        if (
          data.visibility === "INVITE_ONLY" &&
          (!data.inviteeIds || data.inviteeIds.length === 0)
        )
          return false;
        return true;
      },
      {
        message:
          "La liste des invités (inviteeIds) est requise pour un événement sur invitation",
        path: ["inviteeIds"],
      },
    ),
});

export const getEventsSchema = z.object({
  params: z.object({ organizationId: z.string().min(1) }),
  query: z.object({
    status: z
      .enum(["DRAFT", "PUBLISHED", "ONGOING", "COMPLETED", "CANCELLED"])
      .optional(),
    type: z.enum(EVENT_TYPES).optional(),
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

export const eventParamSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
    id: z.string().min(1),
  }),
});

export const updateEventSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
    id: z.string().min(1),
  }),
  body: z
    .object({
      title: z.string().min(1).optional(),
      description: z.string().optional(),
      type: z.enum(EVENT_TYPES).optional(),
      visibility: z.enum(["ORGANIZATION_WIDE", "INVITE_ONLY"]).optional(),
      status: z
        .enum(["DRAFT", "PUBLISHED", "ONGOING", "COMPLETED", "CANCELLED"])
        .optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional().nullable(),
      location: z.string().optional().nullable(),
      locationUrl: z.string().url().optional().nullable().or(z.literal("")),
      isOnline: z.boolean().optional(),
      meetingLink: z.string().url().optional().nullable().or(z.literal("")),
      maxParticipants: z.number().int().positive().optional().nullable(),
      estimatedBudget: z.number().nonnegative().optional().nullable(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "Au moins un champ doit être fourni",
    }),
});

export const rsvpEventSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
    id: z.string().min(1),
  }),
  body: z.object({
    status: z.enum(["GOING", "MAYBE", "NOT_GOING"], {
      message: "Statut de réponse invalide",
    }),
  }),
});
