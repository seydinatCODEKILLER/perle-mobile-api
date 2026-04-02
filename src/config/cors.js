import { env } from "./env.js";

/**
 * CORS pour API Mobile (React Native / Expo)
 *
 * Les apps mobiles n'ont pas d'origine HTTP fixe comme un navigateur.
 * Les requêtes depuis React Native n'envoient pas de header "Origin".
 *
 * Stratégie :
 * - Pas d'origin → autorisé (apps mobiles, Postman, scripts)
 * - La sécurité repose sur JWT, pas sur l'origine
 * - En dev : tout autorisé
 * - En prod : tout autorisé + credentials false
 */
export const getCorsOptions = () => {
  return {
    // ✅ true = accepte toutes les origines y compris absence d'origine
    // Les apps mobiles n'envoient pas d'Origin — on ne peut pas les filtrer
    origin: true,

    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "X-Api-Key",
    ],

    // ✅ false pour mobile — pas de cookies, uniquement Bearer tokens
    credentials: false,

    // Cache preflight 24h
    maxAge: 86400,
  };
};