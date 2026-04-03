import "dotenv/config";
import app from "./app.js";
import { prisma } from "./config/database.js";
import { env } from "./config/env.js";
import { startCronJobs } from "./modules/notifications/notification.cron.js";

const startServer = async () => {
  try {
    await prisma.$connect();
    console.log("✅ Connecté à MongoDB via Prisma");

    startCronJobs();

    const server = app.listen(env.PORT, "0.0.0.0", () => {
      console.log(`🚀 Serveur démarré sur http://localhost:${env.PORT}`);
      console.log(`📚 Docs : http://localhost:${env.PORT}/api/docs`);
      console.log(`🌍 Environnement : ${env.NODE_ENV}`);
    });

    const shutdown = async (signal) => {
      console.log(`\n🛑 Signal ${signal} reçu — arrêt en cours...`);
      await prisma.$disconnect();
      server.close(() => {
        console.log("💤 Serveur arrêté proprement.");
        process.exit(0);
      });

      // Forcer l'arrêt après 10s si le serveur ne se ferme pas
      setTimeout(() => {
        console.error("⚠️ Arrêt forcé après timeout");
        process.exit(1);
      }, 10_000);
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));

  } catch (error) {
    console.error("❌ Erreur de démarrage :", error);
    await prisma.$disconnect();
    process.exit(1);
  }
};

startServer();