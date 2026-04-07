/**
 * Middleware de nettoyage du body pour les requêtes multipart/form-data.
 *
 * Problème : multipart/form-data envoie tous les champs du formulaire,
 * même ceux laissés vides, comme des strings vides "".
 * Zod interprète "" comme une valeur présente et applique les validations
 * (.min(2), .regex(), etc.), ce qui fait échouer la validation.
 *
 * Solution : convertir récursivement toutes les strings vides en undefined
 * avant que Zod ne valide, pour qu'ils soient traités comme absents.
 */

/**
 * Nettoie récursivement un objet :
 * - Strings vides "" → undefined (champ absent)
 * - Strings "true"/"false" → boolean (form-data envoie tout en string)
 * - Strings numériques → number si applicable
 * - Objets imbriqués → nettoyés récursivement
 */
const sanitizeValue = (value) => {
  // String vide → absent
  if (value === "" || value === null) return undefined;

  if (typeof value === "string") {
    const trimmed = value.trim();

    // String vide après trim
    if (trimmed === "") return undefined;

    // Booleans envoyés comme strings par form-data
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;

    // ⚠️ AJOUT MANQUANT : Conversion des strings numériques en vrais nombres
    // Le regex vérifie qu'on a bien des chiffres (optionnellement un signe - ou + au début, et un . pour les décimales)
    // On utilise trimmed !== "" au cas où, bien qu'on ait déjà vérifié plus haut
    if (/^[-+]?\d*\.?\d+$/.test(trimmed)) {
      return Number(trimmed);
    }

    return trimmed;
  }

  // Objets imbriqués (cas rare en form-data, mais on couvre)
  if (typeof value === "object" && !Array.isArray(value)) {
    return sanitizeObject(value);
  }

  return value;
};

const sanitizeObject = (obj) => {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const sanitized = sanitizeValue(value);
    // On n'inclut pas les clés undefined dans le résultat
    if (sanitized !== undefined) {
      result[key] = sanitized;
    }
  }
  return result;
};

/**
 * Middleware principal — à placer avant validate()
 * Uniquement utile pour multipart/form-data et application/x-www-form-urlencoded
 * Pour application/json, express.json() gère déjà ça correctement
 */
export const sanitizeBody = (req, _res, next) => {
  const contentType = req.headers["content-type"] || "";

  // Appliquer seulement si ce n'est pas du JSON pur
  if (!contentType.includes("application/json")) {
    if (req.body && typeof req.body === "object") {
      req.body = sanitizeObject(req.body);
    }
  }

  next();
};