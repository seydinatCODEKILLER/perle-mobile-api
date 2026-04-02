import express from "express";
import cors from "cors";
import logger from "./config/logger.js";
import { getCorsOptions } from "./config/cors.js";
import { generalLimiter } from "./config/rateLimiter.js";
import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { swaggerOptions } from "./config/swagger.js";
import { authRoutes } from "./modules/auth/auth.module.js";
import { errorHandler, notFoundHandler } from "./shared/middlewares/error.middleware.js";
import { organizationRoutes } from "./modules/organizations/organization.module.js";
import { membershipRoutes } from "./modules/memberships/membership.module.js";
import { contributionPlanRoutes } from "./modules/contribution-plans/contribution-plan.module.js";
import { contributionRoutes } from "./modules/contributions/contribution.module.js";
import { debtRoutes } from "./modules/debts/debt.module.js";
import { transactionRoutes } from "./modules/transactions/transaction.module.js";
import { walletRoutes } from "./modules/wallets/wallet.module.js";
import { expenseRoutes } from "./modules/expenses/expense.module.js";
import { subscriptionRoutes } from "./modules/subscriptions/subscription.module.js";
import { dashboardRoutes } from "./modules/statisques/dashboard.module.js";

const app = express();
const specs = swaggerJSDoc(swaggerOptions);

// ✅ CRITICAL: Trust proxy EN PREMIER (avant TOUS les middlewares)
app.set("trust proxy", 1);

// ✅ Middlewares globaux dans le bon ordre
app.use(cors(getCorsOptions()));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Documentation Swagger
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(specs));

// ✅ Rate limiter général appliqué à toutes les routes API
app.use("/api", generalLimiter);

// Logger middleware
logger.info("API middlewares initialized");

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/membership", membershipRoutes);
app.use("/api/contribution-plans", contributionPlanRoutes);
app.use("/api/contributions", contributionRoutes);
app.use("/api/debts", debtRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/statistiques", dashboardRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/expenses", expenseRoutes);

// Route par défaut pour vérifier que l'API tourne
app.get("/health", (req, res) => {
  res.status(200).json({
    message: "API is running",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// Error logger
app.all("/{*path}", notFoundHandler);
app.use(errorHandler);

export default app;
