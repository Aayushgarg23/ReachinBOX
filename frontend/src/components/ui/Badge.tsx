import { type EmailStatus } from "@/types";
import clsx from "clsx";

interface BadgeProps {
  status: EmailStatus | string;
  className?: string;
}

const statusConfig: Record<
  string,
  { label: string; bg: string; text: string; dot: string }
> = {
  pending: {
    label: "Pending",
    bg: "bg-yellow-50",
    text: "text-yellow-700",
    dot: "bg-yellow-400",
  },
  queued: {
    label: "Queued",
    bg: "bg-blue-50",
    text: "text-blue-700",
    dot: "bg-blue-400",
  },
  processing: {
    label: "Processing",
    bg: "bg-purple-50",
    text: "text-purple-700",
    dot: "bg-purple-400",
  },
  sent: {
    label: "Sent",
    bg: "bg-green-50",
    text: "text-green-700",
    dot: "bg-green-400",
  },
  failed: {
    label: "Failed",
    bg: "bg-red-50",
    text: "text-red-700",
    dot: "bg-red-400",
  },
  rescheduled: {
    label: "Rescheduled",
    bg: "bg-orange-50",
    text: "text-orange-700",
    dot: "bg-orange-400",
  },
  // Aggregated display states
  scheduled: {
    label: "Scheduled",
    bg: "bg-orange-50",
    text: "text-orange-700",
    dot: "bg-orange-400",
  },
};

export function Badge({ status, className }: BadgeProps) {
  const cfg = statusConfig[status] ?? {
    label: status,
    bg: "bg-gray-100",
    text: "text-gray-600",
    dot: "bg-gray-400",
  };

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium",
        cfg.bg,
        cfg.text,
        className
      )}
    >
      <span className={clsx("w-1.5 h-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
    </span>
  );
}
