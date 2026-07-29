"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Email, Pagination } from "@/types";

interface UseEmailsOptions {
  status?: string;
  page?: number;
  limit?: number;
  pollInterval?: number; // ms, 0 = no polling
}

interface UseEmailsResult {
  emails: Email[];
  pagination: Pagination | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useEmails({
  status,
  page = 1,
  limit = 50,
  pollInterval = 5000,
}: UseEmailsOptions = {}): UseEmailsResult {
  const [emails, setEmails] = useState<Email[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchEmails = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (status) qs.set("status", status);
      qs.set("page", String(page));
      qs.set("limit", String(limit));

      const res = await fetch(`/api/proxy/emails?${qs.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      setEmails(data.emails || []);
      setPagination(data.pagination || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load emails");
    } finally {
      setLoading(false);
    }
  }, [status, page, limit]);

  useEffect(() => {
    setLoading(true);
    fetchEmails();

    if (pollInterval > 0) {
      pollTimerRef.current = setInterval(fetchEmails, pollInterval);
    }

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [fetchEmails, pollInterval]);

  return { emails, pagination, loading, error, refresh: fetchEmails };
}

export function useEmailStats(pollInterval = 10000) {
  const [stats, setStats] = useState({ scheduled: 0, sent: 0 });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/proxy/emails/stats");
      if (!res.ok) return;
      const data = await res.json();
      setStats({ scheduled: data.scheduled || 0, sent: data.sent || 0 });
    } catch {
      // Ignore stat fetch errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    if (pollInterval > 0) {
      const timer = setInterval(fetchStats, pollInterval);
      return () => clearInterval(timer);
    }
  }, [fetchStats, pollInterval]);

  return { stats, loading };
}
