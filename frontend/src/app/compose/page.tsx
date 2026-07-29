"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Paperclip,
  Clock,
  Upload,
  X,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Strikethrough,
  Quote,
  Undo,
  Redo,
  ChevronDown,
  Check,
} from "lucide-react";
import { useSenders } from "@/hooks/useSenders";
import { parseEmailFile, parseEmailText } from "@/lib/parseCsv";
import type { Sender } from "@/types";
import { useSession } from "next-auth/react";

// ─── Send Later Dropdown ────────────────────────────────────────────────────
interface SendLaterDropdownProps {
  onSelect: (dt: string) => void;
  onClose: () => void;
  position: { top: number; right: number };
}

function getPresetTimes(): { label: string; value: string }[] {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const times = [
    { label: "Tomorrow, 9:00 AM", hour: 9 },
    { label: "Tomorrow, 11:00 AM", hour: 11 },
    { label: "Tomorrow, 1:00 PM", hour: 13 },
    { label: "Tomorrow, 3:00 PM", hour: 15 },
  ];

  return times.map(({ label, hour }) => {
    const d = new Date(tomorrow);
    d.setHours(hour, 0, 0, 0);
    return {
      label,
      value: d.toISOString().slice(0, 16),
    };
  });
}

function SendLaterDropdown({ onSelect, onClose, position }: SendLaterDropdownProps) {
  const presets = getPresetTimes();
  const [customDate, setCustomDate] = useState("");

  return (
    <div
      className="fixed z-50 bg-white rounded-xl shadow-xl border border-gray-200 w-64 p-4 animate-slide-in"
      style={{ top: position.top, right: position.right }}
    >
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Send Later
      </p>
      <p className="text-xs text-gray-500 mb-2">Pick date & time</p>
      <input
        type="datetime-local"
        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 mb-3 focus:outline-none focus:border-green-400"
        value={customDate}
        onChange={(e) => setCustomDate(e.target.value)}
      />
      <div className="space-y-0.5 mb-3">
        {presets.map((p) => (
          <button
            key={p.value}
            onClick={() => {
              onSelect(p.value);
              onClose();
            }}
            className="w-full text-left px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2 pt-2 border-t border-gray-100">
        <button
          onClick={onClose}
          className="flex-1 text-xs text-gray-500 hover:text-gray-700 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            if (customDate) {
              onSelect(customDate);
              onClose();
            } else {
              toast.error("Please pick a date and time");
            }
          }}
          className="flex-1 text-xs text-white bg-green-500 hover:bg-green-600 py-1.5 rounded-lg transition-colors font-medium"
        >
          Done
        </button>
      </div>
    </div>
  );
}

// ─── Email Chip ──────────────────────────────────────────────────────────────
function EmailChip({ email, onRemove }: { email: string; onRemove: () => void }) {
  return (
    <span className="email-chip group cursor-default">
      {email}
      <button
        onClick={onRemove}
        className="text-green-400 hover:text-green-700 transition-colors"
        aria-label={`Remove ${email}`}
      >
        <X size={10} />
      </button>
    </span>
  );
}

// ─── Editor Toolbar ──────────────────────────────────────────────────────────
function EditorToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;

  const toolbarButtons = [
    {
      icon: <Undo size={14} />,
      action: () => editor.chain().focus().undo().run(),
      title: "Undo",
    },
    {
      icon: <Redo size={14} />,
      action: () => editor.chain().focus().redo().run(),
      title: "Redo",
    },
    { divider: true },
    {
      icon: <Bold size={14} />,
      action: () => editor.chain().focus().toggleBold().run(),
      active: editor.isActive("bold"),
      title: "Bold",
    },
    {
      icon: <Italic size={14} />,
      action: () => editor.chain().focus().toggleItalic().run(),
      active: editor.isActive("italic"),
      title: "Italic",
    },
    {
      icon: <UnderlineIcon size={14} />,
      action: () => editor.chain().focus().toggleUnderline().run(),
      active: editor.isActive("underline"),
      title: "Underline",
    },
    {
      icon: <Strikethrough size={14} />,
      action: () => editor.chain().focus().toggleStrike().run(),
      active: editor.isActive("strike"),
      title: "Strikethrough",
    },
    { divider: true },
    {
      icon: <AlignLeft size={14} />,
      action: () => editor.chain().focus().setTextAlign("left").run(),
      active: editor.isActive({ textAlign: "left" }),
      title: "Align Left",
    },
    {
      icon: <AlignCenter size={14} />,
      action: () => editor.chain().focus().setTextAlign("center").run(),
      active: editor.isActive({ textAlign: "center" }),
      title: "Align Center",
    },
    {
      icon: <AlignRight size={14} />,
      action: () => editor.chain().focus().setTextAlign("right").run(),
      active: editor.isActive({ textAlign: "right" }),
      title: "Align Right",
    },
    { divider: true },
    {
      icon: <List size={14} />,
      action: () => editor.chain().focus().toggleBulletList().run(),
      active: editor.isActive("bulletList"),
      title: "Bullet List",
    },
    {
      icon: <ListOrdered size={14} />,
      action: () => editor.chain().focus().toggleOrderedList().run(),
      active: editor.isActive("orderedList"),
      title: "Numbered List",
    },
    {
      icon: <Quote size={14} />,
      action: () => editor.chain().focus().toggleBlockquote().run(),
      active: editor.isActive("blockquote"),
      title: "Blockquote",
    },
  ];

  return (
    <div className="flex items-center gap-0.5 px-3 py-2 border-t border-gray-200 flex-wrap">
      {toolbarButtons.map((btn, i) =>
        "divider" in btn ? (
          <div key={i} className="w-px h-4 bg-gray-200 mx-1" />
        ) : (
          <button
            key={i}
            onClick={btn.action}
            title={btn.title}
            type="button"
            className={`p-1.5 rounded transition-colors ${
              btn.active
                ? "bg-gray-200 text-gray-800"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            }`}
          >
            {btn.icon}
          </button>
        )
      )}
    </div>
  );
}

// ─── Sender Dropdown ─────────────────────────────────────────────────────────
function SenderDropdown({
  senders,
  selectedId,
  onSelect,
}: {
  senders: Sender[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = senders.find((s) => s.id === selectedId);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gray-300 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <span>{selected?.email ?? "Select sender"}</span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-40 bg-white border border-gray-200 rounded-xl shadow-lg w-64 py-1 animate-slide-in">
            {senders.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  onSelect(s.id);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-gray-400">{s.email}</p>
                </div>
                {s.id === selectedId && (
                  <Check size={12} className="text-green-500" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Compose Page ───────────────────────────────────────────────────────
export default function ComposePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { senders, loading: sendersLoading } = useSenders();

  // Form state
  const [selectedSenderId, setSelectedSenderId] = useState("");
  const [toEmails, setToEmails] = useState<string[]>([]);
  const [toInput, setToInput] = useState("");
  const [subject, setSubject] = useState("");
  const [delayMs, setDelayMs] = useState(1000);
  const [hourlyLimit, setHourlyLimit] = useState(50);
  const [startTime, setStartTime] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 5);
    return d.toISOString().slice(0, 16);
  });

  // UI state
  const [showSendLater, setShowSendLater] = useState(false);
  const [sendLaterPos, setSendLaterPos] = useState({ top: 0, right: 0 });
  const [csvInfo, setCsvInfo] = useState<{
    count: number;
    dupes: number;
    invalid: number;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const clockBtnRef = useRef<HTMLButtonElement>(null);

  // Initialize senders
  useState(() => {
    if (senders.length > 0 && !selectedSenderId) {
      setSelectedSenderId(senders[0].id);
    }
  });

  // Update sender when loaded
  if (senders.length > 0 && !selectedSenderId) {
    setSelectedSenderId(senders[0].id);
  }

  // TipTap editor
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class: "ProseMirror focus:outline-none min-h-[200px]",
        "data-placeholder": "Type Your Reply...",
      },
    },
  });

  // Handle To field input
  const handleToKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (["Enter", "Tab", ",", ";"].includes(e.key)) {
        e.preventDefault();
        const raw = toInput.trim();
        if (!raw) return;
        const result = parseEmailText(raw);
        const newEmails = result.emails.filter((em) => !toEmails.includes(em));
        setToEmails((prev) => [...prev, ...newEmails]);
        setToInput("");
        if (result.invalidRemoved > 0) {
          toast.error(`${result.invalidRemoved} invalid email(s) removed`);
        }
      } else if (e.key === "Backspace" && !toInput && toEmails.length > 0) {
        setToEmails((prev) => prev.slice(0, -1));
      }
    },
    [toInput, toEmails]
  );

  // CSV upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await parseEmailFile(file);
      const newEmails = result.emails.filter((em) => !toEmails.includes(em));
      setToEmails((prev) => [...prev, ...newEmails]);
      setCsvInfo({
        count: result.emails.length,
        dupes: result.duplicatesRemoved,
        invalid: result.invalidRemoved,
      });
      toast.success(`Added ${newEmails.length} email(s) from ${file.name}`);
    } catch (err) {
      toast.error("Failed to parse file: " + (err instanceof Error ? err.message : "Unknown error"));
    }

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Submit
  const handleSend = async () => {
    if (!selectedSenderId) return toast.error("Please select a sender");
    if (toEmails.length === 0) return toast.error("Add at least one recipient");
    if (!subject.trim()) return toast.error("Subject is required");
    if (!editor?.getText().trim()) return toast.error("Email body is required");

    const userId = (session?.user as { id?: string })?.id ?? "guest";

    setSubmitting(true);
    try {
      const res = await fetch("/api/proxy/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderId: selectedSenderId,
          subject: subject.trim(),
          body: editor.getHTML(),
          recipients: toEmails,
          startTime: new Date(startTime).toISOString(),
          delayBetweenMs: delayMs,
          hourlyLimit,
          userId,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to schedule");
      }

      const data = await res.json();
      toast.success(`✅ Scheduled ${data.emailCount} emails!`);
      router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to schedule emails");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendLaterClick = () => {
    if (!clockBtnRef.current) return;
    const rect = clockBtnRef.current.getBoundingClientRect();
    setSendLaterPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    setShowSendLater(true);
  };

  const visibleChips = toEmails.slice(0, 3);
  const extraCount = toEmails.length - visibleChips.length;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft size={16} />
          <span className="font-medium">Compose New Email</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Attachment placeholder */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
            title="Attach file"
          >
            <Paperclip size={16} />
          </button>

          {/* Schedule (clock) */}
          <button
            ref={clockBtnRef}
            type="button"
            onClick={handleSendLaterClick}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
            title="Schedule send time"
          >
            <Clock size={16} />
          </button>

          {/* Send Later button */}
          <button
            id="send-later-btn"
            type="button"
            onClick={handleSend}
            disabled={submitting}
            className="flex items-center gap-2 px-4 py-1.5 bg-white border border-green-500 text-green-600 text-sm font-medium rounded-lg hover:bg-green-50 transition-colors disabled:opacity-60"
          >
            {submitting && (
              <span className="w-3.5 h-3.5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            )}
            Send Later
          </button>
        </div>
      </div>

      {/* Compose body */}
      <div className="flex-1 max-w-3xl w-full mx-auto bg-white my-4 rounded-xl shadow-sm overflow-hidden">
        {/* From */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-100">
          <span className="text-xs font-medium text-gray-400 w-12 shrink-0">From</span>
          {sendersLoading ? (
            <div className="skeleton h-5 w-48 rounded-full" />
          ) : (
            <SenderDropdown
              senders={senders}
              selectedId={selectedSenderId}
              onSelect={setSelectedSenderId}
            />
          )}
        </div>

        {/* To */}
        <div className="flex items-start gap-3 px-6 py-3 border-b border-gray-100">
          <span className="text-xs font-medium text-gray-400 w-12 shrink-0 pt-1">To</span>
          <div className="flex-1 flex flex-wrap items-center gap-1.5 min-h-[28px]">
            {visibleChips.map((em) => (
              <EmailChip
                key={em}
                email={em}
                onRemove={() => setToEmails((prev) => prev.filter((e) => e !== em))}
              />
            ))}
            {extraCount > 0 && (
              <span className="email-chip">+{extraCount}</span>
            )}
            <input
              type="text"
              placeholder={toEmails.length === 0 ? "recipient@example.com" : ""}
              value={toInput}
              onChange={(e) => setToInput(e.target.value)}
              onKeyDown={handleToKeyDown}
              onBlur={() => {
                if (toInput.trim()) {
                  const result = parseEmailText(toInput);
                  const newEmails = result.emails.filter((em) => !toEmails.includes(em));
                  setToEmails((prev) => [...prev, ...newEmails]);
                  setToInput("");
                }
              }}
              className="flex-1 min-w-[140px] text-sm text-gray-700 placeholder:text-gray-300 outline-none bg-transparent"
              id="to-input"
            />
          </div>
          {/* Upload List */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 flex items-center gap-1 text-xs text-green-500 hover:text-green-700 font-medium transition-colors"
          >
            <Upload size={12} />
            Upload List
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={handleFileUpload}
            id="csv-upload-input"
          />
        </div>

        {/* CSV info */}
        {csvInfo && (
          <div className="px-6 py-2 bg-green-50 border-b border-green-100 flex items-center justify-between">
            <span className="text-xs text-green-700">
              ✅ {csvInfo.count} emails imported
              {csvInfo.dupes > 0 && ` · ${csvInfo.dupes} duplicates removed`}
              {csvInfo.invalid > 0 && ` · ${csvInfo.invalid} invalid removed`}
            </span>
            <button
              onClick={() => setCsvInfo(null)}
              className="text-green-400 hover:text-green-600"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Subject */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-100">
          <span className="text-xs font-medium text-gray-400 w-12 shrink-0">Subject</span>
          <input
            type="text"
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="flex-1 text-sm text-gray-700 placeholder:text-gray-300 outline-none bg-transparent"
            id="subject-input"
          />
        </div>

        {/* Delay + Hourly Limit */}
        <div className="flex items-center gap-4 px-6 py-3 border-b border-gray-100">
          <span className="text-xs font-medium text-gray-400 shrink-0">
            Delay between 2 emails
          </span>
          <input
            type="number"
            min={0}
            value={delayMs}
            onChange={(e) => setDelayMs(parseInt(e.target.value) || 0)}
            className="w-14 border border-gray-200 rounded-md px-2 py-1 text-xs text-gray-700 text-center outline-none focus:border-green-400"
            id="delay-input"
          />
          <span className="text-xs text-gray-400">ms</span>

          <span className="text-xs font-medium text-gray-400 shrink-0 ml-4">
            Hourly Limit
          </span>
          <input
            type="number"
            min={1}
            value={hourlyLimit}
            onChange={(e) => setHourlyLimit(parseInt(e.target.value) || 1)}
            className="w-14 border border-gray-200 rounded-md px-2 py-1 text-xs text-gray-700 text-center outline-none focus:border-green-400"
            id="hourly-limit-input"
          />
        </div>

        {/* Rich text editor */}
        <div className="flex-1">
          <EditorContent editor={editor} className="px-0" />
          <EditorToolbar editor={editor} />
        </div>
      </div>

      {/* Send Later Dropdown */}
      {showSendLater && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowSendLater(false)} />
          <SendLaterDropdown
            onSelect={(dt) => setStartTime(dt)}
            onClose={() => setShowSendLater(false)}
            position={sendLaterPos}
          />
        </>
      )}
    </div>
  );
}
