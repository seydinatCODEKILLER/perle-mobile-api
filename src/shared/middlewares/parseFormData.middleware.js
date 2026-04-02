/**
 * Middleware pour parser les données imbriquées du FormData mobile.
 *
 * Supporte 3 formats d'envoi :
 *
 * 1. Notation pointée   : settings.autoReminders → { settings: { autoReminders: true } }
 * 2. Notation crochets  : provisionalData[firstName] → { provisionalData: { firstName: "..." } }
 * 3. String JSON        : provisionalData = '{"firstName":"..."}' → { provisionalData: { firstName: "..." } }
 * 4. Booleans string    : "true"/"false" → true/false
 */
export const parseNestedFormData = (req, _res, next) => {
  const parsed = {};

  const BOOLEAN_SETTINGS = [
    "allowPartialPayments",
    "autoReminders",
    "emailNotifications",
    "smsNotifications",
    "whatsappNotifications",
  ];

  Object.keys(req.body).forEach((key) => {
    const value = req.body[key];

    // ── Format 1 : notation pointée (settings.xxx, wallet.xxx) ──
    if (key.startsWith("settings.")) {
      const settingKey = key.replace("settings.", "");
      if (!parsed.settings) parsed.settings = {};

      if (BOOLEAN_SETTINGS.includes(settingKey)) {
        parsed.settings[settingKey] = value === "true" || value === true;
      } else if (settingKey === "sessionTimeout") {
        parsed.settings[settingKey] = parseInt(value, 10);
      } else if (settingKey === "reminderDays") {
        parsed.settings[settingKey] =
          typeof value === "string"
            ? value.split(",").map((v) => parseInt(v.trim(), 10))
            : value;
      } else {
        parsed.settings[settingKey] = value;
      }

    } else if (key.startsWith("wallet.")) {
      const walletKey = key.replace("wallet.", "");
      if (!parsed.wallet) parsed.wallet = {};

      if (walletKey === "initialBalance") {
        parsed.wallet[walletKey] = parseFloat(value) || 0;
      } else {
        parsed.wallet[walletKey] = value;
      }

    // ── Format 2 : notation crochets (provisionalData[firstName]) ──
    } else if (/^(\w+)\[(.+)\]$/.test(key)) {
      const match = key.match(/^(\w+)\[(.+)\]$/);
      const parentKey = match[1];   // provisionalData
      const childKey = match[2];    // firstName

      if (!parsed[parentKey]) parsed[parentKey] = {};
      parsed[parentKey][childKey] = coerceValue(childKey, value);

    // ── Format 3 : string JSON (provisionalData = '{"firstName":"..."}') ──
    } else if (typeof value === "string" && isJsonString(value)) {
      try {
        parsed[key] = JSON.parse(value);
      } catch {
        parsed[key] = value;
      }

    // ── Format 4 : booleans string et valeurs simples ──
    } else {
      parsed[key] = coerceValue(key, value);
    }
  });

  // Nettoyer les objets vides
  if (parsed.settings && Object.keys(parsed.settings).length === 0) {
    delete parsed.settings;
  }
  if (parsed.wallet && Object.keys(parsed.wallet).length === 0) {
    delete parsed.wallet;
  }

  req.body = parsed;
  next();
};

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Convertit les valeurs string en types natifs selon le contexte
 */
const coerceValue = (key, value) => {
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null" || value === "") return null;
  if (value === "undefined") return undefined;

  // Nombres pour certains champs connus
  const NUMBER_FIELDS = ["sessionTimeout", "initialBalance", "page", "limit"];
  if (NUMBER_FIELDS.includes(key) && !isNaN(value)) {
    return parseFloat(value);
  }

  return value;
};

/**
 * Vérifie si une string est un JSON valide
 * ✅ Uniquement pour les objets/arrays, pas les primitives
 */
const isJsonString = (str) => {
  if (typeof str !== "string") return false;
  const trimmed = str.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return false;
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
};