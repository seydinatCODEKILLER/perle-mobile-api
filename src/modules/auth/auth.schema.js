import { z } from "zod";

export const loginSchema = z.object({
  body: z.object({
    phone: z
      .string()
      .min(9, "Le numéro de téléphone est invalide"),
    password: z
      .string()
      .min(1, "Le mot de passe est requis"),
  }),
});

export const registerSchema = z.object({
  body: z.object({
    prenom: z
      .string()
      .min(2, "Le prénom doit contenir au moins 2 caractères"),
    nom: z
      .string()
      .min(2, "Le nom doit contenir au moins 2 caractères"),
    email: z
      .string()
      .email("Adresse email invalide")
      .optional()
      .or(z.literal(""))
      .transform((val) => val || null),
    password: z
      .string()
      .min(8, "Le mot de passe doit contenir au moins 8 caractères")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre"
      ),
    phone: z
      .string()
      .min(9, "Le numéro de téléphone est invalide"),
    gender: z
      .enum(["MALE", "FEMALE"], {
        errorMap: () => ({ message: "Le genre doit être MALE ou FEMALE" }),
      })
      .optional(),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z
      .string()
      .min(1, "Le refresh token est requis"),
  }),
});

export const updateProfileSchema = z.object({
  body: z
    .object({
      prenom: z.string().min(2).optional(),
      nom: z.string().min(2).optional(),
      phone: z
        .string()
        .min(9, "Le numéro de téléphone est invalide")
        .optional(),
      gender: z
        .enum(["MALE", "FEMALE"], {
          errorMap: () => ({ message: "Le genre doit être MALE ou FEMALE" }),
        })
        .optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "Au moins un champ doit être fourni",
    }),
});

export const updateCanCreateOrgSchema = z.object({
  body: z.object({
    userId: z.string().min(1, "L'identifiant utilisateur est requis"),
    canCreateOrganization: z.boolean({
      required_error: "Le champ canCreateOrganization est requis",
    }),
  }),
});