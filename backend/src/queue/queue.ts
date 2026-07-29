import { Queue } from "bullmq";
import IORedis from "ioredis";
import { config } from "../config";

export const redisConnection = new IORedis(config.REDIS_URL, {
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
  lazyConnect: false,
});

redisConnection.on("connect", () => {
  console.log("✅ Redis connected");
});

redisConnection.on("error", (err) => {
  console.error("❌ Redis error:", err.message);
});

export const emailQueue = new Queue("email-queue", {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: { count: 500, age: 24 * 60 * 60 }, // Keep last 500 completed jobs for 24h
    removeOnFail: { count: 1000, age: 7 * 24 * 60 * 60 }, // Keep failed jobs for 7 days
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
  },
});

export interface EmailJobData {
  emailId: string;
  campaignId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
}
