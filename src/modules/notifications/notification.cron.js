import cron from "node-cron";
import { NotificationService } from "./notification.service.js";
import { AuthRepository } from "../auth/auth.repository.js";
import { prisma } from "../../config/database.js";
import logger from "../../config/logger.js";

const notificationService = new NotificationService();
const authRepo = new AuthRepository();

export const startCronJobs = () => {

  // ─── Overdue Cotisations ─────────────────────────────────────────────
  cron.schedule("0 0 * * *", async () => {
    try {
      const result = await prisma.contribution.updateMany({
        where: { status: { in: ["PENDING", "PARTIAL"] }, dueDate: { lt: new Date() } },
        data: { status: "OVERDUE" },
      });
      logger.logEvent("CRON_CONTRIBUTIONS_OVERDUE", { updated: result.count });
    } catch (error) {
      logger.logError(error, { context: "CRON_CONTRIBUTIONS_OVERDUE" });
    }
  });

  // ─── Overdue Dettes ──────────────────────────────────────────────────
  cron.schedule("5 0 * * *", async () => {
    try {
      const result = await prisma.debt.updateMany({
        where: { status: { in: ["ACTIVE", "PARTIALLY_PAID"] }, dueDate: { lt: new Date() } },
        data: { status: "OVERDUE" },
      });
      logger.logEvent("CRON_DEBTS_OVERDUE", { updated: result.count });
    } catch (error) {
      logger.logError(error, { context: "CRON_DEBTS_OVERDUE" });
    }
  });

  // ─── Nettoyage tokens ────────────────────────────────────────────────
  cron.schedule("0 2 * * *", async () => {
    try {
      const result = await authRepo.cleanupTokens();
      logger.logEvent("CRON_TOKENS_CLEANUP", { deleted: result.count });
    } catch (error) {
      logger.logError(error, { context: "CRON_TOKENS_CLEANUP" });
    }
  });

    // ─── Rappels automatiques ─────────────────────────────────────────────
  cron.schedule("0 8 * * *", async () => {
    try {
      logger.info("[CRON] Début des rappels automatiques...");
      const stats = await notificationService.processDailyReminders();
      
      logger.logEvent("CRON_REMINDERS_SENT", stats);
      
    } catch (error) {
      logger.logError(error, { context: "CRON_REMINDERS_SENT" });
    }
  });

  logger.info("✅ Cron jobs démarrés (Architecture Anti-Doublon)");
};