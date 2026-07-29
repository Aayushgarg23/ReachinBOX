"use client";

import { useEmails } from "@/hooks/useEmails";
import { Badge } from "@/components/ui/Badge";
import type { Email } from "@/types";

interface ScheduledTableProps {
  statusFilter?: string;
  search?: string;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 last:border-0">
      <div className="skeleton h-3 w-40 rounded" />
      <div className="skeleton h-3 w-48 rounded flex-1" />
      <div className="skeleton h-5 w-20 rounded-full" />
      <div className="skeleton h-3 w-24 rounded" />
    </div>
  );
}

function EmailRow({ email }: { email: Email }) {
  const displayStatus =
    email.status === "pending" ||
    email.status === "queued" ||
    email.status === "rescheduled"
      ? "scheduled"
      : email.status;

  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors group">
      {/* Recipient */}
      <div className="w-52 shrink-0">
        <span className="text-sm text-gray-700 font-medium truncate block">
          To: {email.recipient}
        </span>
      </div>

      {/* Badge */}
      <div className="shrink-0">
        <Badge status={displayStatus} />
      </div>

      {/* Subject + error */}
      <div className="flex-1 min-w-0">
        <span className="text-sm text-gray-500 truncate block">
          {email.subject}
          {email.errorMessage && (
            <span className="text-red-400 ml-2 text-xs">
              — {email.errorMessage}
            </span>
          )}
        </span>
      </div>

      {/* Scheduled time */}
      <div className="shrink-0 text-xs text-gray-400 text-right">
        {formatDate(email.scheduledTime)}
      </div>

      {/* Ethereal link */}
      {email.etherealUrl && (
        <a
          href={email.etherealUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs text-green-500 hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
        >
          Preview ↗
        </a>
      )}
    </div>
  );
}

export function ScheduledTable({
  statusFilter = "scheduled",
  search = "",
}: ScheduledTableProps) {
  const { emails, loading, error } = useEmails({
    status: statusFilter,
    limit: 100,
    pollInterval: 5000,
  });

  // Client-side search filter
  const filtered = search.trim()
    ? emails.filter(
        (e) =>
          e.recipient.toLowerCase().includes(search.toLowerCase()) ||
          e.subject.toLowerCase().includes(search.toLowerCase())
      )
    : emails;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-sm text-red-400 gap-2">
        <span>⚠️ Failed to load: {error}</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <svg
          className="w-12 h-12 mb-3 opacity-40"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
        <p className="text-sm font-medium">
          {search ? `No results for "${search}"` : "No scheduled emails"}
        </p>
        <p className="text-xs mt-1">
          {search ? "Try a different search term" : "Compose a new email to get started"}
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Result count */}
      <div className="px-4 py-2 border-b border-gray-100 bg-gray-50/50">
        <span className="text-xs text-gray-400">
          {filtered.length} email{filtered.length !== 1 ? "s" : ""}
          {search && ` matching "${search}"`}
        </span>
      </div>

      {filtered.map((email) => (
        <EmailRow key={email.id} email={email} />
      ))}
    </div>
  );
}
