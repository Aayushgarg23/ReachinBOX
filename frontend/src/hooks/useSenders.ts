"use client";

import { useState, useEffect } from "react";
import type { Sender } from "@/types";

interface UseSendersResult {
  senders: Sender[];
  loading: boolean;
  error: string | null;
}

export function useSenders(): UseSendersResult {
  const [senders, setSenders] = useState<Sender[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSenders() {
      try {
        const res = await fetch("/api/proxy/senders");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setSenders(data.senders || []);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load senders"
        );
      } finally {
        setLoading(false);
      }
    }

    fetchSenders();
  }, []);

  return { senders, loading, error };
}
