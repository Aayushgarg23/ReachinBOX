import { EmailStatus } from "@prisma/client";
import prisma from "../prisma";
import { emailQueue, EmailJobData } from "../queue/queue";

/**
 * Boot-time reconciliation:
 * Query all emails with status pending/queued/rescheduled that have a future scheduled time.
 * For each, check if a corresponding BullMQ job already exists.
 * If not, re-add it with the correct remaining delay.
 *
 * This guards against Redis state loss while Postgres (source of truth) survives.
 */
export async function reconcilePendingJobs(): Promise<void> {
  console.log("🔄 Starting reconciliation of pending jobs...");

  const now = new Date();
  const pendingEmails = await prisma.email.findMany({
    where: {
      status: {
        in: [
          EmailStatus.pending,
          EmailStatus.queued,
          EmailStatus.rescheduled,
        ] as EmailStatus[],
      },
      scheduledTime: {
        gt: now,
      },
    },
    select: {
      id: true,
      campaignId: true,
      senderId: true,
      recipient: true,
      subject: true,
      body: true,
      scheduledTime: true,
    },
  });

  console.log(
    `📋 Found ${pendingEmails.length} pending/queued/rescheduled emails to reconcile`
  );

  let requeued = 0;
  let alreadyQueued = 0;

  for (const email of pendingEmails) {
    try {
      // Check if BullMQ job already exists
      const existingJob = await emailQueue.getJob(email.id);

      if (existingJob) {
        alreadyQueued++;
        continue;
      }

      // Calculate remaining delay
      const delayMs = Math.max(0, email.scheduledTime.getTime() - Date.now());

      const jobData: EmailJobData = {
        emailId: email.id,
        campaignId: email.campaignId,
        senderId: email.senderId,
        recipient: email.recipient,
        subject: email.subject,
        body: email.body,
      };

      await emailQueue.add("send-email", jobData, {
        jobId: email.id, // Idempotency: BullMQ won't add duplicate jobId
        delay: delayMs,
      });

      requeued++;
    } catch (err) {
      console.error(`❌ Failed to reconcile job for email ${email.id}:`, err);
    }
  }

  console.log(
    `✅ Reconciliation complete: ${requeued} re-queued, ${alreadyQueued} already in queue`
  );
}
