import { Router, Request, Response } from "express";
import { EmailStatus } from "@prisma/client";
import prisma from "../prisma";

const router = Router();

// GET /api/emails?status=&page=&limit=&campaignId=
router.get("/", async (req: Request, res: Response) => {
  try {
    const page = parseInt(String(req.query.page || "1"), 10);
    const limit = Math.min(parseInt(String(req.query.limit || "20"), 10), 100);
    const skip = (page - 1) * limit;
    const statusParam = req.query.status as string | undefined;
    const campaignId = req.query.campaignId as string | undefined;

    // Build status filter
    let statusFilter: EmailStatus[] | undefined;
    if (statusParam === "scheduled") {
      statusFilter = [
        EmailStatus.pending,
        EmailStatus.queued,
        EmailStatus.rescheduled,
      ];
    } else if (statusParam === "sent") {
      statusFilter = [EmailStatus.sent, EmailStatus.failed];
    } else if (statusParam === "failed") {
      statusFilter = [EmailStatus.failed];
    } else if (statusParam === "processing") {
      statusFilter = [EmailStatus.processing];
    } else if (statusParam) {
      // Try to use as direct enum value
      const asEnum = statusParam as EmailStatus;
      if (Object.values(EmailStatus).includes(asEnum)) {
        statusFilter = [asEnum];
      }
    }

    const where = {
      ...(statusFilter ? { status: { in: statusFilter } } : {}),
      ...(campaignId ? { campaignId } : {}),
    };

    const [emails, total] = await Promise.all([
      prisma.email.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledTime: "desc" },
        select: {
          id: true,
          recipient: true,
          subject: true,
          status: true,
          scheduledTime: true,
          sentTime: true,
          errorMessage: true,
          attempts: true,
          etherealUrl: true,
          campaignId: true,
          createdAt: true,
          sender: { select: { name: true, email: true } },
          campaign: { select: { subject: true } },
        },
      }),
      prisma.email.count({ where }),
    ]);

    return res.json({
      emails,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("Failed to list emails:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/emails/stats — aggregate counts by status
router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const counts = await prisma.email.groupBy({
      by: ["status"],
      _count: { id: true },
    });

    const stats = counts.reduce(
      (acc, row) => {
        acc[row.status] = row._count.id;
        return acc;
      },
      {} as Record<string, number>
    );

    const scheduled =
      (stats["pending"] || 0) +
      (stats["queued"] || 0) +
      (stats["rescheduled"] || 0);
    const sent = (stats["sent"] || 0) + (stats["failed"] || 0);

    return res.json({ ...stats, scheduled, sent });
  } catch (err) {
    console.error("Failed to get email stats:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
