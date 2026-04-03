import { z } from "zod";

const MEMBER_ROLES = [
  "ADMIN",
  "FINANCIAL_MANAGER",
  "MEMBER",
  "PRESIDENT",
  "VICE_PRESIDENT",
  "SECRETARY_GENERAL",
  "ORGANIZER",
];

export const createMembershipSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
  }),
  body: z.discriminatedUnion("memberType", [
    z.object({
      memberType: z.literal("existing"),
      phone: z.string().min(1, "Téléphone requis"),
      role: z.enum(MEMBER_ROLES).optional(),
    }),
    z.object({
      memberType: z.literal("provisional"),
      provisionalData: z.object({
        firstName: z.string().min(1, "Le prénom est requis"),
        lastName: z.string().min(1, "Le nom est requis"),
        phone: z.string().min(1, "Le téléphone est requis"),
        email: z.string().email("Email invalide").optional().or(z.literal("")),
        gender: z.enum(["MALE", "FEMALE"]).optional(),
      }),
      role: z.enum(MEMBER_ROLES).optional(),
    }),
  ]),
});

export const getMembersSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
  }),
  query: z.object({
    status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional(),
    role: z.enum(MEMBER_ROLES).optional(),
    search: z.string().optional(),
    gender: z.enum(["MALE", "FEMALE"]).optional(),
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

export const membershipParamSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
    id: z.string().min(1),
  }),
});

export const updateMembershipSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
    id: z.string().min(1),
  }),
  body: z
    .object({
      role: z.enum(MEMBER_ROLES).optional(),
      memberNumber: z.string().optional(),
      joinDate: z.string().datetime().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "Au moins un champ doit être fourni",
    }),
});

export const updateProvisionalMemberSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
    id: z.string().min(1),
  }),
  body: z
    .object({
      firstName: z.string().min(1).optional(),
      lastName: z.string().min(1).optional(),
      email: z.string().email().optional().or(z.literal("")),
      phone: z.string().min(9).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "Au moins un champ doit être fourni",
    }),
});

export const updateMembershipStatusSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
    id: z.string().min(1),
  }),
  body: z.object({
    status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"], {
      message: "Statut invalide",
    }),
  }),
});

export const updateMembershipRoleSchema = z.object({
  params: z.object({
    organizationId: z.string().min(1),
    id: z.string().min(1),
  }),
  body: z.object({
    role: z.enum(MEMBER_ROLES, {
      message: "Rôle invalide",
    }),
  }),
});
