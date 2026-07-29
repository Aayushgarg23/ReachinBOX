import { Router, Request, Response } from "express";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import prisma from "../prisma";
import { emailQueue, EmailJobData } from "../queue/queue";

const router = Router();

const CreateCampaignSchema = z.object({
  senderId: z.string().min(1),
  subject: z.string().min(1).max(500),
  body: z.string().min(1),
  recipients: z.array(z.string().email()).min(1).max(5000),
  startTime: z.string().datetime(),
  delayBetweenMs: z.number().int().min(0).max(3600000).default(1000),
  hourlyLimit: z.number().int().min(1).max(10000).default(100),
  userId: z.string(), // Passed from frontend via session
});

// POST /api/campaigns — Create campaign + bulk-schedule emails
router.post("/", async (req: Request, res: Response) => {
  try {
    const parsed = CreateCampaignSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: parsed.error.flatten(),
      });
    }

    const {
      senderId,
      subject,
      body,
      recipients,
      startTime,
      delayBetweenMs,
      hourlyLimit,
      userId,
    } = parsed.data;

    // Verify sender exists
    const sender = await prisma.sender.findUnique({ where: { id: senderId } });
    if (!sender) {
      return res.status(404).json({ error: "Sender not found" });
    }

    // Upsert user (in case it's a new session)
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: userId + "@placeholder.com",
        name: "User",
      },
    });

    const startDate = new Date(startTime);

    // Create campaign
    const campaign = await prisma.campaign.create({
      data: {
        userId,
        senderId,
        subject,
        body,
        startTime: startDate,
        delayBetweenMs,
        hourlyLimit,
        status: "active",
      },
    });

    // Deduplicate recipients
    const uniqueRecipients = [...new Set(recipients.map((r) => r.toLowerCase()))];

    // Generate email rows
    const emailRows = uniqueRecipients.map((recipient, index) => ({
      id: uuidv4(),
      campaignId: campaign.id,
      senderId,
      recipient,
      subject,
      body,
      status: "queued" as const,
      scheduledTime: new Date(startDate.getTime() + index * delayBetweenMs),
    }));

    // Bulk insert email rows (skip duplicates)
    await prisma.email.createMany({
      data: emailRows,
      skipDuplicates: true,
    });

    // Fetch the actually created emails (to get real IDs)
    const createdEmails = await prisma.email.findMany({
      where: {
        campaignId: campaign.id,
        status: "queued",
      },
      select: {
        id: true,
        recipient: true,
        subject: true,
        body: true,
        scheduledTime: true,
        senderId: true,
        campaignId: true,
      },
    });

    // Bulk-enqueue with BullMQ — jobId = email UUID (idempotency key)
    const jobs = createdEmails.map((email) => ({
      name: "send-email" as const,
      data: {
        emailId: email.id,
        campaignId: email.campaignId,
        senderId: email.senderId,
        recipient: email.recipient,
        subject: email.subject,
        body: email.body,
      } as EmailJobData,
      opts: {
        jobId: email.id, // BullMQ deduplicates by jobId
        delay: Math.max(0, email.scheduledTime.getTime() - Date.now()),
      },
    }));

    await emailQueue.addBulk(jobs);

    console.log(
      `✅ Campaign ${campaign.id} created with ${createdEmails.length} emails queued`
    );

    return res.status(201).json({
      campaign,
      emailCount: createdEmails.length,
      message: `Successfully scheduled ${createdEmails.length} emails`,
    });
  } catch (err) {
    console.error("Failed to create campaign:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/campaigns — List campaigns
router.get("/", async (req: Request, res: Response) => {
  try {
    const page = parseInt(String(req.query.page || "1"), 10);
    const limit = parseInt(String(req.query.limit || "20"), 10);
    const skip = (page - 1) * limit;

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          sender: { select: { name: true, email: true } },
          _count: { select: { emails: true } },
        },
      }),
      prisma.campaign.count(),
    ]);

    return res.json({
      campaigns,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("Failed to list campaigns:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
