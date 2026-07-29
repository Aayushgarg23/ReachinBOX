import { PrismaClient } from "@prisma/client";
import nodemailer from "nodemailer";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

interface EtherealAccount {
  user: string;
  pass: string;
  smtp: { host: string; port: number; secure: boolean };
  web: string;
}

async function createEtherealAccount(): Promise<EtherealAccount> {
  const account = await nodemailer.createTestAccount();
  return {
    user: account.user,
    pass: account.pass,
    smtp: account.smtp,
    web: account.web,
  };
}

async function main() {
  console.log("🌱 Starting seed...");

  // Create or load Ethereal accounts
  const accountsFile = path.join(__dirname, "../.ethereal-accounts.json");
  let accounts: EtherealAccount[] = [];

  if (fs.existsSync(accountsFile)) {
    console.log("📧 Loading existing Ethereal accounts...");
    accounts = JSON.parse(fs.readFileSync(accountsFile, "utf-8"));
  } else {
    console.log("📧 Creating new Ethereal test accounts...");
    accounts = await Promise.all([
      createEtherealAccount(),
      createEtherealAccount(),
    ]);
    fs.writeFileSync(accountsFile, JSON.stringify(accounts, null, 2));
    console.log("💾 Ethereal accounts saved to .ethereal-accounts.json");
  }

  // Seed senders
  const senderData = [
    {
      id: "11111111-1111-1111-1111-111111111111",
      email: accounts[0].user,
      name: "Oliver Brown",
      smtpHost: accounts[0].smtp.host,
      smtpPort: accounts[0].smtp.port,
      smtpUser: accounts[0].user,
      smtpPass: accounts[0].pass,
      maxEmailsPerHour: 50,
    },
    {
      id: "22222222-2222-2222-2222-222222222222",
      email: accounts[1].user,
      name: "Amanda Clark",
      smtpHost: accounts[1].smtp.host,
      smtpPort: accounts[1].smtp.port,
      smtpUser: accounts[1].user,
      smtpPass: accounts[1].pass,
      maxEmailsPerHour: 100,
    },
  ];

  for (const sender of senderData) {
    await prisma.sender.upsert({
      where: { email: sender.email },
      update: {
        smtpHost: sender.smtpHost,
        smtpPort: sender.smtpPort,
        smtpUser: sender.smtpUser,
        smtpPass: sender.smtpPass,
        maxEmailsPerHour: sender.maxEmailsPerHour,
      },
      create: sender,
    });
    console.log(`✅ Seeded sender: ${sender.name} (${sender.email})`);
  }

  console.log("\n✅ Seed complete!");
  console.log("\n📬 Ethereal accounts:");
  accounts.forEach((acc, i) => {
    console.log(`  Sender ${i + 1}: ${acc.user}`);
    console.log(`  Preview URL: ${acc.web}`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
