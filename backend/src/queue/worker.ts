import { Worker, Job } from "bullmq";
import { EmailStatus } from "@prisma/client";
import { config } from "../config";
import { redisConnection, emailQueue, EmailJobData } from "./queue";
import prisma from "../prisma";
import { sendEmail } from "../services/mailer";
import { checkAndIncrementRate } from "../services/rateLimit";

export function startWorker(): Worker<EmailJobData> {
  const worker = new Worker<EmailJobData>(
    "email-queue",
    async (job: Job<EmailJobData>) => {
      const { emailId, senderId, recipient, subject, body } = job.data;

      console.log(`\n📨 Processing job ${job.id} for ${recipient}`);

      // ─── 1. IDEMPOTENCY GUARD ───────────────────────────────────────────────
      const emailRow = await prisma.email.findUnique({
        where: { id: emailId },
        include: { sender: true },
      });

      if (!emailRow) {
        console.warn(`⚠️  Email row ${emailId} not found — skipping`);
        return;
      }

      if (emailRow.status === EmailStatus.sent) {
        console.log(`⏭️  Email ${emailId} already sent — skipping (idempotent)`);
        return;
      }

      // ─── 2. RATE LIMIT CHECK ────────────────────────────────────────────────
      const { allowed, nextWindowMs } = await checkAndIncrementRate(
        senderId,
        emailRow.sender.maxEmailsPerHour
      );

      if (!allowed) {
        console.log(
          `🚦 Rate limit exceeded for sender ${senderId}. Rescheduling to next hour (+${Math.round(nextWindowMs / 1000)}s)`
        );

        const nextTime = new Date(Date.now() + nextWindowMs + 5000); // 5s buffer

        // Update DB
        await prisma.email.update({
          where: { id: emailId },
          data: {
            status: EmailStatus.rescheduled,
            scheduledTime: nextTime,
          },
        });

        // Move BullMQ job to delayed — no new job created, same jobId preserved
        await job.moveToDelayed(nextTime.getTime());

        return; // Do NOT throw — job is not failed, just rescheduled
      }

      // ─── 3. MARK AS PROCESSING ──────────────────────────────────────────────
      await prisma.email.update({
        where: { id: emailId },
        data: {
          status: EmailStatus.processing,
          attempts: { increment: 1 },
        },
      });

      // ─── 4. SEND EMAIL ──────────────────────────────────────────────────────
      try {
        const result = await sendEmail({
          to: recipient,
          subject,
          html: body,
          smtpCreds: {
            host: emailRow.sender.smtpHost,
            port: emailRow.sender.smtpPort,
            user: emailRow.sender.smtpUser,
            pass: emailRow.sender.smtpPass,
          },
        });

        // ─── 5. MARK AS SENT ──────────────────────────────────────────────────
        await prisma.email.update({
          where: { id: emailId },
          data: {
            status: EmailStatus.sent,
            sentTime: new Date(),
            etherealUrl: result.etherealUrl,
            errorMessage: null,
          },
        });

        console.log(`✅ Email ${emailId} sent successfully to ${recipient}`);
      } catch (sendError) {
        const errorMsg =
          sendError instanceof Error ? sendError.message : String(sendError);
        console.error(`❌ Failed to send email ${emailId}:`, errorMsg);

        // Update attempts but let BullMQ handle retry via backoff
        await prisma.email.update({
          where: { id: emailId },
          data: {
            errorMessage: errorMsg,
          },
        });

        throw sendError; // Re-throw so BullMQ retries
      }
    },
    {
      connection: redisConnection,
      concurrency: config.WORKER_CONCURRENCY,
      // Minimum delay between individual sends (prevents hammering SMTP)
      limiter: {
        max: 1,
        duration: config.MIN_DELAY_MS,
      },
    }
  );

  // Handle job failures (after all retries exhausted)
  worker.on("failed", async (job, err) => {
    if (!job) return;
    const { emailId } = job.data;
    console.error(`❌ Job ${job.id} permanently failed after ${job.attemptsMade} attempts:`, err.message);

    try {
      await prisma.email.update({
        where: { id: emailId },
        data: {
          status: EmailStatus.failed,
          errorMessage: err.message,
        },
      });
    } catch (dbErr) {
      console.error("Failed to update email status to failed:", dbErr);
    }
  });

  worker.on("completed", (job) => {
    console.log(`✅ Job ${job.id} completed`);
  });

  worker.on("error", (err) => {
    console.error("Worker error:", err);
  });

  console.log(
    `🚀 BullMQ Worker started (concurrency: ${config.WORKER_CONCURRENCY}, minDelay: ${config.MIN_DELAY_MS}ms)`
  );

  return worker;
}
