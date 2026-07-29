import type {
  EmailsResponse,
  SendersResponse,
  CreateCampaignPayload,
  CreateCampaignResponse,
  EmailStats,
} from "@/types";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
const API_SECRET = process.env.API_SECRET || "";

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${BACKEND_URL}${path}`;
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "x-api-secret": API_SECRET,
    ...(options?.headers || {}),
  };

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  emails: {
    list: (params: {
      status?: string;
      page?: number;
      limit?: number;
      campaignId?: string;
    }) => {
      const qs = new URLSearchParams();
      if (params.status) qs.set("status", params.status);
      if (params.page) qs.set("page", String(params.page));
      if (params.limit) qs.set("limit", String(params.limit));
      if (params.campaignId) qs.set("campaignId", params.campaignId);
      return apiFetch<EmailsResponse>(`/api/emails?${qs.toString()}`);
    },
    stats: () => apiFetch<EmailStats>("/api/emails/stats"),
  },

  senders: {
    list: () => apiFetch<SendersResponse>("/api/senders"),
  },

  campaigns: {
    create: (payload: CreateCampaignPayload) =>
      apiFetch<CreateCampaignResponse>("/api/campaigns", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  },
};
