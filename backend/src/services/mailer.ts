import nodemailer from "nodemailer";

interface SmtpCreds {
  host: string;
  port: number;
  user: string;
  pass: string;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  smtpCreds: SmtpCreds;
}

interface SendEmailResult {
  messageId: string;
  etherealUrl?: string;
}

/**
 * Send an email via Ethereal SMTP (nodemailer).
 * Returns the Ethereal preview URL for debugging.
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const { to, subject, html, smtpCreds } = options;

  const transporter = nodemailer.createTransport({
    host: smtpCreds.host,
    port: smtpCreds.port,
    secure: smtpCreds.port === 465,
    auth: {
      user: smtpCreds.user,
      pass: smtpCreds.pass,
    },
  });

  const info = await transporter.sendMail({
    from: `"ReachInbox" <${smtpCreds.user}>`,
    to,
    subject,
    html,
  });

  const etherealUrl = nodemailer.getTestMessageUrl(info) || undefined;

  console.log(`📧 Email sent to ${to}`);
  console.log(`   Message ID: ${info.messageId}`);
  if (etherealUrl) {
    console.log(`   Preview URL: ${etherealUrl}`);
  }

  return {
    messageId: info.messageId,
    etherealUrl: typeof etherealUrl === "string" ? etherealUrl : undefined,
  };
}
