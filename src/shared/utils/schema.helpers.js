// src/shared/utils/schema.helpers.js
import { z } from "zod";

export const objectId = (label = "L'identifiant") =>
  z
    .string()
    .min(1)
    .regex(/^[a-fA-F0-9]{24}$/, `${label} doit être un identifiant valide`);

// Pour les champs optionnels dans un update — "" devient undefined (champ ignoré)
export const optionalString = (schema) =>
  schema
    .optional()
    .or(z.literal(""))
    .transform((val) => (val === "" || val === undefined ? undefined : val));

// Pour les champs nullable — "" devient null (efface la valeur en DB)
export const nullableString = (schema) =>
  schema
    .optional()
    .or(z.literal(""))
    .transform((val) => val || null);