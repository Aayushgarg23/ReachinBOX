// API Response Types

export interface Sender {
  id: string;
  email: string;
  name: string;
  maxEmailsPerHour: number;
  createdAt: string;
  _count?: { emails: number };
}

export interface Campaign {
  id: string;
  userId: string;
  senderId: string;
  subject: string;
  body: string;
  startTime: string;
  delayBetweenMs: number;
  hourlyLimit: number;
  status: string;
  createdAt: string;
  sender?: Pick<Sender, "name" | "email">;
  _count?: { emails: number };
}

export type EmailStatus =
  | "pending"
  | "queued"
  | "processing"
  | "sent"
  | "failed"
  | "rescheduled";

export interface Email {
  id: string;
  recipient: string;
  subject: string;
  status: EmailStatus;
  scheduledTime: string;
  sentTime?: string | null;
  errorMessage?: string | null;
  attempts: number;
  etherealUrl?: string | null;
  campaignId: string;
  createdAt: string;
  sender?: Pick<Sender, "name" | "email">;
  campaign?: Pick<Campaign, "subject">;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface EmailsResponse {
  emails: Email[];
  pagination: Pagination;
}

export interface SendersResponse {
  senders: Sender[];
}

export interface CreateCampaignPayload {
  senderId: string;
  subject: string;
  body: string;
  recipients: string[];
  startTime: string;
  delayBetweenMs: number;
  hourlyLimit: number;
  userId: string;
}

export interface CreateCampaignResponse {
  campaign: Campaign;
  emailCount: number;
  message: string;
}

export interface EmailStats {
  pending?: number;
  queued?: number;
  processing?: number;
  sent: number;
  failed?: number;
  rescheduled?: number;
  scheduled: number;
}
