"use client";

import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Search,
  SlidersHorizontal,
  RefreshCw,
  Edit3,
  Calendar,
  Send,
  LogOut,
  ChevronDown,
  Check,
  X,
} from "lucide-react";
import { ScheduledTable } from "@/components/tables/ScheduledTable";
import { SentTable } from "@/components/tables/SentTable";
import { useEmailStats } from "@/hooks/useEmails";

type Tab = "scheduled" | "sent";

// ─── Filter config per tab ────────────────────────────────────────────────────
const SCHEDULED_FILTERS = [
  { label: "All Scheduled", value: "scheduled" },
  { label: "Queued", value: "queued" },
  { label: "Pending", value: "pending" },
  { label: "Rescheduled", value: "rescheduled" },
  { label: "Processing", value: "processing" },
];

const SENT_FILTERS = [
  { label: "All Sent", value: "sent" },
  { label: "Failed", value: "failed" },
];

// ─── Filter Dropdown ──────────────────────────────────────────────────────────
interface FilterDropdownProps {
  tab: Tab;
  activeFilter: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

function FilterDropdown({
  tab,
  activeFilter,
  onSelect,
  onClose,
  anchorRef,
}: FilterDropdownProps) {
  const filters = tab === "scheduled" ? SCHEDULED_FILTERS : SENT_FILTERS;
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Position below the anchor button
  const rect = anchorRef.current?.getBoundingClientRect();
  const top = (rect?.bottom ?? 0) + 8;
  const right = rect ? window.innerWidth - rect.right : 16;

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !anchorRef.current?.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [onClose, anchorRef]);

  return (
    <div
      ref={dropdownRef}
      className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-xl w-52 py-1.5 animate-slide-in"
      style={{ top, right }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 mb-1">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Filter by Status
        </span>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={12} />
        </button>
      </div>

      {filters.map((f) => (
        <button
          key={f.value}
          onClick={() => {
            onSelect(f.value);
            onClose();
          }}
          className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
          id={`filter-${f.value}`}
        >
          <span className={activeFilter === f.value ? "font-semibold text-green-600" : ""}>
            {f.label}
          </span>
          {activeFilter === f.value && (
            <Check size={12} className="text-green-500" />
          )}
        </button>
      ))}

      {/* Clear filter */}
      {activeFilter !== (tab === "scheduled" ? "scheduled" : "sent") && (
        <>
          <div className="h-px bg-gray-100 mx-3 my-1" />
          <button
            onClick={() => {
              onSelect(tab === "scheduled" ? "scheduled" : "sent");
              onClose();
            }}
            className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Clear filter
          </button>
        </>
      )}
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({
  tab,
  setTab,
  stats,
  onCompose,
  user,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  stats: { scheduled: number; sent: number };
  onCompose: () => void;
  user: { name?: string | null; email?: string | null; image?: string | null };
}) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <aside className="w-52 bg-white border-r border-gray-200 flex flex-col shrink-0 h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xl font-black text-gray-900 tracking-tight">ONB</span>
          <span className="w-2 h-2 bg-green-500 rounded-full mt-0.5" />
        </div>
      </div>

      {/* User card */}
      <div className="mx-3 mb-3 relative">
        <button
          onClick={() => setUserMenuOpen((v) => !v)}
          className="w-full flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-gray-50 transition-colors text-left"
        >
          {user.image ? (
            <Image
              src={user.image}
              alt={user.name || "User"}
              width={32}
              height={32}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-semibold text-sm">
              {user.name?.[0] ?? "U"}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-800 truncate">
              {user.name || "User"}
            </p>
            <p className="text-[10px] text-gray-400 truncate">{user.email || ""}</p>
          </div>
          <ChevronDown size={12} className="text-gray-400 shrink-0" />
        </button>

        {userMenuOpen && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setUserMenuOpen(false)} />
            <div className="absolute left-0 top-full z-30 bg-white border border-gray-200 rounded-xl shadow-lg w-44 py-1 mt-1 animate-slide-in">
              <button
                onClick={() => {
                  setUserMenuOpen(false);
                  signOut({ callbackUrl: "/" });
                }}
                className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50 flex items-center gap-2 transition-colors"
              >
                <LogOut size={12} />
                Sign out
              </button>
            </div>
          </>
        )}
      </div>

      {/* Compose button */}
      <div className="px-3 mb-4">
        <button
          id="compose-btn"
          onClick={onCompose}
          className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium py-2 rounded-lg transition-colors"
        >
          <Edit3 size={14} />
          Compose
        </button>
      </div>

      <div className="px-3 mb-2">
        <div className="h-px bg-gray-100" />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 space-y-0.5">
        <button
          id="tab-scheduled"
          onClick={() => setTab("scheduled")}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
            tab === "scheduled"
              ? "bg-gray-100 text-gray-900 font-medium"
              : "text-gray-500 hover:bg-gray-50"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Calendar
              size={14}
              className={tab === "scheduled" ? "text-gray-700" : "text-gray-400"}
            />
            <span>Scheduled</span>
          </div>
          {stats.scheduled > 0 && (
            <span className="text-[10px] font-semibold text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded-full">
              {stats.scheduled > 99 ? "99+" : stats.scheduled}
            </span>
          )}
        </button>

        <button
          id="tab-sent"
          onClick={() => setTab("sent")}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
            tab === "sent"
              ? "bg-gray-100 text-gray-900 font-medium"
              : "text-gray-500 hover:bg-gray-50"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Send
              size={14}
              className={tab === "sent" ? "text-gray-700" : "text-gray-400"}
            />
            <span>Sent</span>
          </div>
          {stats.sent > 0 && (
            <span className="text-[10px] font-semibold text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded-full">
              {stats.sent > 99 ? "99+" : stats.sent}
            </span>
          )}
        </button>
      </nav>
    </aside>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("scheduled");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("scheduled");
  const [showFilter, setShowFilter] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const { stats } = useEmailStats(10000);

  // Reset filter when switching tabs
  useEffect(() => {
    setStatusFilter(tab === "scheduled" ? "scheduled" : "sent");
    setSearch("");
  }, [tab]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return null;

  const user = session.user ?? {};

  // Determine active filter label for badge
  const allFilters = tab === "scheduled" ? SCHEDULED_FILTERS : SENT_FILTERS;
  const activeFilterLabel = allFilters.find((f) => f.value === statusFilter)?.label ?? "";
  const isFiltered =
    statusFilter !== (tab === "scheduled" ? "scheduled" : "sent");

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <Sidebar
        tab={tab}
        setTab={setTab}
        stats={stats}
        onCompose={() => router.push("/compose")}
        user={user}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          {/* Search */}
          <div className="flex-1 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <Search size={14} className="text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder={`Search ${tab === "scheduled" ? "scheduled" : "sent"} emails…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 text-sm text-gray-700 placeholder:text-gray-400 outline-none bg-transparent"
              id="search-input"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Filter button */}
          <div className="relative">
            <button
              ref={filterBtnRef}
              id="filter-btn"
              onClick={() => setShowFilter((v) => !v)}
              title="Filter by status"
              className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm transition-colors border ${
                isFiltered
                  ? "bg-green-50 border-green-300 text-green-700"
                  : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
              }`}
            >
              <SlidersHorizontal size={14} />
              {isFiltered && (
                <span className="text-xs font-medium">{activeFilterLabel}</span>
              )}
            </button>

            {showFilter && (
              <FilterDropdown
                tab={tab}
                activeFilter={statusFilter}
                onSelect={setStatusFilter}
                onClose={() => setShowFilter(false)}
                anchorRef={filterBtnRef}
              />
            )}
          </div>

          {/* Refresh button */}
          <button
            id="refresh-btn"
            onClick={() => setRefreshKey((k) => k + 1)}
            title="Refresh"
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-50 border border-gray-200 bg-white"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Active filter badge */}
        {isFiltered && (
          <div className="bg-green-50 border-b border-green-100 px-4 py-2 flex items-center gap-2">
            <span className="text-xs text-green-700">
              Filtered by: <strong>{activeFilterLabel}</strong>
            </span>
            <button
              onClick={() =>
                setStatusFilter(tab === "scheduled" ? "scheduled" : "sent")
              }
              className="text-xs text-green-500 hover:text-green-700 underline transition-colors"
            >
              Clear
            </button>
          </div>
        )}

        {/* Email list */}
        <div className="flex-1 overflow-auto bg-white">
          {tab === "scheduled" ? (
            <ScheduledTable
              key={refreshKey}
              statusFilter={statusFilter}
              search={search}
            />
          ) : (
            <SentTable
              key={refreshKey}
              statusFilter={statusFilter}
              search={search}
            />
          )}
        </div>
      </main>
    </div>
  );
}
