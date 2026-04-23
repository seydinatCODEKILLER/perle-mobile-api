import cron from "node-cron";
import { NotificationService } from "./notification.service.js";
import { AuthRepository } from "../auth/auth.repository.js";
import { DebtRepository } from "../debts/debt.repository.js";
import { NotificationRepository } from "./notification.repository.js";
import logger from "../../config/logger.js";
import { ContributionRepository } from "../contributions/contribution.repository.js";

const notificationService = new NotificationService();
const authRepo = new AuthRepository();
const contribRepo = new ContributionRepository();
const debtRepo = new DebtRepository();
const notificationRepo = new NotificationRepository();

export const startCronJobs = () => {
  // ─── Overdue Cotisations ──────────────────────────────────────
  cron.schedule("0 0 * * *", async () => {
    try {
      const result = await contribRepo.markOverdue();
      logger.logEvent("CRON_CONTRIBUTIONS_OVERDUE", { updated: result.count });
    } catch (error) {
      logger.logError(error, { context: "CRON_CONTRIBUTIONS_OVERDUE" });
    }
  });

  // ─── Overdue Dettes ───────────────────────────────────────────
  cron.schedule("5 0 * * *", async () => {
    try {
      const result = await debtRepo.markOverdue();
      logger.logEvent("CRON_DEBTS_OVERDUE", { updated: result.count });
    } catch (error) {
      logger.logError(error, { context: "CRON_DEBTS_OVERDUE" });
    }
  });

  // ─── Nettoyage tokens ─────────────────────────────────────────
  cron.schedule("0 2 * * *", async () => {
    try {
      const result = await authRepo.cleanupTokens();
      logger.logEvent("CRON_TOKENS_CLEANUP", { deleted: result.count });
    } catch (error) {
      logger.logError(error, { context: "CRON_TOKENS_CLEANUP" });
    }
  });

  // ─── Rappels automatiques ─────────────────────────────────────
  cron.schedule("0 8 * * *", async () => {
    try {
      logger.info("[CRON] Début des rappels automatiques...");
      const stats = await notificationService.processDailyReminders();
      logger.logEvent("CRON_REMINDERS_SENT", stats);
    } catch (error) {
      logger.logError(error, { context: "CRON_REMINDERS_SENT" });
    }
  });

  // ─── Nettoyage des notifications lues (DELIVERED) ────────────
  cron.schedule("0 3 * * *", async () => {
    try {
      const result = await notificationRepo.deleteOldDelivered(7);
      logger.logEvent("CRON_NOTIFICATIONS_CLEANUP", {
        deleted: result.count,
        rule: "Suppression des notifications lues depuis plus de 7 jours",
      });
    } catch (error) {
      logger.logError(error, { context: "CRON_NOTIFICATIONS_CLEANUP" });
    }
  });

  logger.info("✅ Cron jobs démarrés (Architecture Anti-Doublon)");
};