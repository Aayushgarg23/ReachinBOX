import "dotenv/config";
import express from "express";
import cors from "cors";
import { config } from "./config";
import prisma from "./prisma";
import { reconcilePendingJobs } from "./services/reconcile";
import { startWorker } from "./queue/worker";
import campaignsRouter from "./routes/campaigns";
import emailsRouter from "./routes/emails";
import sendersRouter from "./routes/senders";

const app = express();

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: config.FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Auth Middleware ─────────────────────────────────────────────────────────
// Simple shared-secret header check for server-to-server calls from Next.js
function requireApiSecret(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const secret = req.headers["x-api-secret"];
  if (secret !== config.API_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return next();
}

// ─── Routes ──────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/campaigns", requireApiSecret, campaignsRouter);
app.use("/api/emails", requireApiSecret, emailsRouter);
app.use("/api/senders", requireApiSecret, sendersRouter);

// ─── Error Handler ───────────────────────────────────────────────────────────
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
);

// ─── Bootstrap ───────────────────────────────────────────────────────────────
async function bootstrap() {
  try {
    // Test DB connection
    await prisma.$connect();
    console.log("✅ Database connected");

    // Start BullMQ worker
    startWorker();

    // Run reconciliation (restart-persistence)
    await reconcilePendingJobs();

    // Start HTTP server
    app.listen(config.PORT, () => {
      console.log(
        `🚀 Server running on http://localhost:${config.PORT} [${config.NODE_ENV}]`
      );
    });
  } catch (err) {
    console.error("❌ Bootstrap failed:", err);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n⏳ Shutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

bootstrap();
