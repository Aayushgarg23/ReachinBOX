import { Router, Request, Response } from "express";
import prisma from "../prisma";

const router = Router();

// GET /api/senders — list all senders
router.get("/", async (_req: Request, res: Response) => {
  try {
    const senders = await prisma.sender.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        maxEmailsPerHour: true,
        createdAt: true,
        _count: {
          select: { emails: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return res.json({ senders });
  } catch (err) {
    console.error("Failed to list senders:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
