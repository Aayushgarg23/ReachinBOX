import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../.env") });

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

export const config = {
  // Server
  PORT: parseInt(optionalEnv("PORT", "4000"), 10),
  NODE_ENV: optionalEnv("NODE_ENV", "development"),
  FRONTEND_URL: optionalEnv("FRONTEND_URL", "http://localhost:3000"),

  // Database
  DATABASE_URL: optionalEnv("DATABASE_URL", "mysql://root:rootpassword@localhost:3306/reachinbox"),

  // Redis
  REDIS_URL: optionalEnv("REDIS_URL", "redis://localhost:6379"),

  // BullMQ Worker
  WORKER_CONCURRENCY: parseInt(optionalEnv("WORKER_CONCURRENCY", "5"), 10),
  MIN_DELAY_MS: parseInt(optionalEnv("MIN_DELAY_MS", "1000"), 10), // 1 second between sends
  MAX_EMAILS_PER_HOUR_PER_SENDER: parseInt(
    optionalEnv("MAX_EMAILS_PER_HOUR_PER_SENDER", "100"),
    10
  ),

  // Auth
  NEXTAUTH_SECRET: optionalEnv("NEXTAUTH_SECRET", "dev-secret-change-in-prod"),
  API_SECRET: optionalEnv("API_SECRET", "reachinbox-dev-secret-2024"), // Shared secret between frontend and backend
} as const;

export type Config = typeof config;
