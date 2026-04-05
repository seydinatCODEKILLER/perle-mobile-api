import { z } from "zod";

export const registerTokenSchema = z.object({
  body: z.object({
    token: z.string().min(1, "Le token est requis"),
    platform: z.enum(["ios", "android"]).optional(),
    deviceName: z.string().max(100).optional(),
  }),
});

export const revokeTokenSchema = z.object({
  body: z.object({
    token: z.string().min(1, "Le token est requis"),
  }),
});