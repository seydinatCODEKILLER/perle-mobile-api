import rateLimit from "express-rate-limit";

/**
 * Extraction de la vraie IP cliente.
 *
 * Sur mobile, les IPs sont souvent partagées (NAT opérateur, WiFi campus).
 * On est plus permissif que pour le web pour éviter de bloquer des
 * utilisateurs légitimes partageant la même IP mobile.
 */
const getClientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return forwarded.split(",")[0].trim();
  if (req.headers["x-real-ip"]) return req.headers["x-real-ip"];
  return req.ip;
};

/**
 * Rate limiter général
 * ✅ Augmenté pour mobile — une app fait plusieurs appels au démarrage
 * (profil, organisations, notifications, etc.)
 * 300 req / 15 min par IP
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,

  keyGenerator: (req) => getClientIp(req),

  standardHeaders: true,
  legacyHeaders: false,
  validate: false,

  message: {
    success: false,
    message: "Trop de requêtes, veuillez réessayer plus tard",
  },

  // ✅ Exempter les endpoints critiques du limiter général
  // Ils ont leurs propres limiters plus adaptés
  skip: (req) => {
    const exempted = [
      "/auth/me",
      "/auth/refresh-token",
      "/auth/refresh",
    ];
    return exempted.some((path) => req.path.endsWith(path));
  },
});

/**
 * Rate limiter login
 * ✅ Augmenté pour mobile — IPs partagées (NAT opérateur)
 * Un réseau 4G peut avoir des milliers d'utilisateurs sur la même IP publique.
 * 20 tentatives / 15 min par IP (skipSuccessfulRequests = true)
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,

  keyGenerator: (req) => getClientIp(req),

  standardHeaders: true,
  legacyHeaders: false,
  validate: false,

  // ✅ Ne compte pas les connexions réussies
  skipSuccessfulRequests: true,

  message: {
    success: false,
    message:
      "Trop de tentatives de connexion. Réessayez dans 15 minutes.",
  },
});

/**
 * Rate limiter inscription
 * 5 inscriptions / heure par IP
 * (moins permissif que le login — l'inscription est rare)
 */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,

  keyGenerator: (req) => getClientIp(req),

  standardHeaders: true,
  legacyHeaders: false,
  validate: false,

  message: {
    success: false,
    message:
      "Trop de tentatives d'inscription. Réessayez dans une heure.",
  },
});

/**
 * Rate limiter refresh token
 * ✅ Permissif pour mobile — l'app rafraîchit automatiquement en arrière-plan
 * 100 req / 15 min par IP
 */
export const refreshTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,

  keyGenerator: (req) => getClientIp(req),

  standardHeaders: true,
  legacyHeaders: false,
  validate: false,

  message: {
    success: false,
    message: "Trop de tentatives de rafraîchissement de token",
  },
});

/**
 * Rate limiter uploads
 * ✅ Légèrement augmenté pour mobile — photo de profil, pièces jointes
 * 30 uploads / heure par IP
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,

  keyGenerator: (req) => getClientIp(req),

  standardHeaders: true,
  legacyHeaders: false,
  validate: false,

  message: {
    success: false,
    message: "Trop d'uploads. Réessayez plus tard.",
  },
});

/**
 * Rate limiter CRUD
 * ✅ Très permissif pour mobile — scroll infini, pull-to-refresh,
 * navigation entre écrans = beaucoup de requêtes légitimes
 * 500 req / 15 min par IP
 */
export const crudLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,

  keyGenerator: (req) => getClientIp(req),

  standardHeaders: true,
  legacyHeaders: false,
  validate: false,

  message: {
    success: false,
    message: "Trop de requêtes. Veuillez patienter.",
  },
});