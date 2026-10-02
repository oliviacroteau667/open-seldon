"use client";
import React, { useEffect, useMemo, useState } from "react";
import type { Message } from "@/types";
import { catKeysForMessage, catForKey } from "@/types";
import { MarkCheck } from "./MarkCheck";

interface Props {
  messages: Message[];
  allMessages?: Message[]; // full unfiltered set — needed for thread view to bypass filters
  categoryFilter: string | null;
  onCategoryFilter: (key: string | null) => void;
  total: number;
  inline?: boolean;
  flush?: boolean;
  cityFilter?: string | null;
  onCityFilter?: (city: string | null) => void;
  regionFilter?: string | null;
  onRegionFilter?: (name: string | null) => void;
  focusMessageId?: number | null; // open this message (bypassing filters) and highlight it
  onFocusConsumed?: () => void;
  collapsed?: boolean;
  onRailMouseDown?: (e: React.MouseEvent) => void; // the collapsed rail is itself the drag handle
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).toUpperCase() +
    " " + d.toTimeString().slice(0, 5);
}

// Resolve the root message id of a thread given any message id in it.
function resolveRoot(id: number, byId: Map<number, Message>): number {
  let cur = byId.get(id);
  while (cur?.reply_to_id != null) {
    const parent = byId.get(cur.reply_to_id);
    if (!parent) break;
    cur = parent;
  }
  return cur?.id ?? id;
}

export default function MessageFeed({ messages, allMessages, inline, flush, cityFilter, onCityFilter, regionFilter, onRegionFilter, focusMessageId, onFocusConsumed, collapsed, onRailMouseDown }: Props) {
  const [threadRootId, setThreadRootId] = useState<number | null>(null);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [threadsOnly, setThreadsOnly] = useState(false);

  // Index all available messages by id (use allMessages when available so thread view
  // can pull in messages outside the current date/category/city filter).
  const messagePool = allMessages ?? messages;
  const byId = useMemo(() => new Map(messagePool.map((m) => [m.id, m])), [messagePool]);

  // Build a set of message ids that have at least one reply in the pool (so we only
  // show "View in thread" on messages that actually belong to a multi-message thread).
  const hasReplies = useMemo(() => {
    const s = new Set<number>();
    for (const m of messagePool) {
      if (m.reply_to_id != null) s.add(m.reply_to_id);
    }
    return s;
  }, [messagePool]);

  // Thread view: collect all messages sharing the same root, sorted oldest-first.
  const threadMessages = useMemo(() => {
    if (threadRootId == null) return null;
    return messagePool
      .filter((m) => resolveRoot(m.id, byId) === threadRootId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [threadRootId, messagePool, byId]);

  const openThread = (msgId: number) => setThreadRootId(resolveRoot(msgId, byId));

  useEffect(() => {
    if (focusMessageId == null) return;
    if (byId.has(focusMessageId)) {
      setThreadRootId(resolveRoot(focusMessageId, byId));
      setHighlightId(focusMessageId);
    }
    onFocusConsumed?.();
  }, [focusMessageId, byId, onFocusConsumed]);

  useEffect(() => {
    if (highlightId == null) return;
    document.getElementById(`msg-${highlightId}`)?.scrollIntoView({ block: "center" });
  }, [highlightId, threadRootId]);

  const feedMessages = useMemo(() => {
    let list = threadsOnly ? messages.filter((m) => hasReplies.has(m.id)) : messages;
    if (sortOrder === "oldest") list = [...list].reverse();
    return list;
  }, [messages, threadsOnly, sortOrder, hasReplies]);

  const containerStyle: React.CSSProperties = flush ? {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    height: "100%",
  } : inline ? {
    width: "100%",
    background: "var(--panel-strong)",
    border: "1px solid var(--line)",
    borderRadius: 10,
    backdropFilter: "blur(12px)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    minHeight: 0,
  } : {
    position: "absolute",
    right: 20,
    top: 76,
    bottom: 20,
    width: 380,
    background: "var(--panel-strong)",
    border: "1px solid var(--line)",
    borderRadius: 10,
    backdropFilter: "blur(12px)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    zIndex: 10,
  };

  // ── Collapsed rail ───────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <div
        onMouseDown={onRailMouseDown}
        aria-label="Messages panel (drag to expand)"
        style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", padding: "18px 0", gap: 14, cursor: "ew-resize", userSelect: "none" }}
      >
        <span aria-hidden="true" style={{ font: "400 10px 'Space Mono', monospace", color: "var(--text)" }}>{messages.length}</span>
        <span aria-hidden="true" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", font: "400 10px 'Space Mono', monospace", letterSpacing: ".12em", color: "var(--text-3)" }}>
          MESSAGES
        </span>
      </div>
    );
  }

  // ── Thread view ──────────────────────────────────────────────────────────
  if (threadRootId != null && threadMessages != null) {
    const root = byId.get(threadRootId);
    return (
      <div style={containerStyle}>
        {/* Breadcrumb */}
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => { setThreadRootId(null); setHighlightId(null); }}
            aria-label="Back to messages"
            style={{ background: "none", border: "1px solid var(--line)", borderRadius: 5, color: "var(--text-3)", font: "400 10px 'Space Mono', monospace", padding: "4px 8px", cursor: "pointer", flexShrink: 0 }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--line)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-3)"; }}
          >
            ← BACK
          </button>
          <span style={{ font: "600 13px 'Instrument Sans', sans-serif", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {threadMessages.length > 1 ? "Thread" : "Message"} · @{root?.channel ?? ""}
          </span>
          <span style={{ font: "400 10px 'Space Mono', monospace", color: "var(--text-3)", flexShrink: 0, marginLeft: "auto" }}>
            {threadMessages.length} MSGS
          </span>
        </div>

        {/* Thread messages, oldest first, replies indented */}
        <div className="feed-scroll" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "6px 0" }}>
          {threadMessages.map((m, i) => (
            <MessageCard
              key={m.id}
              message={m}
              isReply={m.reply_to_id != null}
              isFirst={i === 0}
              hasReplies={hasReplies.has(m.id)}
              onViewThread={openThread}
              highlighted={m.id === highlightId}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Feed view ────────────────────────────────────────────────────────────
  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ font: "600 13px 'Instrument Sans', sans-serif", color: "var(--text)" }}>
          Messages{cityFilter ? ` · ${cityFilter}` : regionFilter ? ` · ${regionFilter}` : ""}
        </span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {(cityFilter || regionFilter) && (
            <span
              onClick={() => { onCityFilter?.(null); onRegionFilter?.(null); }}
              style={{ font: "400 10px 'Space Mono', monospace", color: "var(--warn)", cursor: "pointer" }}
            >
              CLEAR ✕
            </span>
          )}
          <span style={{ font: "400 10px 'Space Mono', monospace", color: "var(--text-3)" }}>
            {feedMessages.length}
          </span>
        </div>
      </div>

      {/* Filter chips */}
      <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-faint)", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <button
          onClick={() => setSortOrder((s) => s === "newest" ? "oldest" : "newest")}
          aria-label={sortOrder === "newest" ? "Sort oldest first" : "Sort newest first"}
          style={{
            font: "400 10px 'Space Mono', monospace",
            letterSpacing: ".06em",
            color: "var(--text-3)",
            background: "transparent",
            border: "1px solid var(--line)",
            borderRadius: 5,
            padding: "6px 9px",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--line)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-3)"; }}
        >
          {sortOrder === "newest" ? "↓ NEWEST FIRST" : "↑ OLDEST FIRST"}
        </button>
        <div
          role="checkbox"
          aria-checked={threadsOnly}
          aria-label="Threads only"
          tabIndex={0}
          onClick={() => setThreadsOnly((v) => !v)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setThreadsOnly((v) => !v); } }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 8px",
            borderRadius: 6,
            cursor: "pointer",
            userSelect: "none",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "var(--hover)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
        >
          <MarkCheck checked={threadsOnly} size={18} />
          <span style={{ font: "400 10px 'Space Mono', monospace", letterSpacing: ".06em", color: threadsOnly ? "var(--text)" : "var(--text-3)", transition: "color .25s" }}>
            THREADS ONLY
          </span>
        </div>
      </div>

      {/* List */}
      <div className="feed-scroll" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "6px 0" }}>
        {feedMessages.length === 0 ? (
          <div style={{ padding: "24px 16px", font: "400 12px 'Instrument Sans', sans-serif", color: "var(--text-3)", textAlign: "center" }}>
            No messages match the current filters.
          </div>
        ) : (
          feedMessages.map((m) => (
            <MessageCard
              key={m.id}
              message={m}
              isReply={false}
              isFirst={false}
              hasReplies={hasReplies.has(m.id)}
              onViewThread={openThread}
            />
          ))
        )}
      </div>
    </div>
  );
}


interface CardProps {
  message: Message;
  isReply: boolean;
  isFirst: boolean;
  hasReplies: boolean;
  onViewThread: (id: number) => void;
  highlighted?: boolean;
}

function MessageCard({ message: m, isReply, hasReplies, onViewThread, highlighted }: CardProps) {
  const catKeys = catKeysForMessage(m);
  const primaryCat = catKeys.length > 0 ? catForKey(catKeys[0]) : null;
  const showThreadBtn = m.reply_to_id != null || hasReplies;

  return (
    <div id={`msg-${m.id}`} style={{
      padding: "12px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 8,
      borderLeft: `3px solid ${primaryCat?.color ?? "var(--line-strong)"}`,
      margin: isReply ? "10px 8px 10px 24px" : "10px 8px",
      background: highlighted ? "var(--accent-tint)" : "var(--card)",
      outline: highlighted ? "1px solid var(--accent-outline)" : "none",
      borderRadius: 6,
      transition: "background .3s, outline-color .3s",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", font: "400 10px 'Space Mono', monospace", color: "var(--text-3)" }}>
        <span>@{m.channel}</span>
        <span>{formatTime(m.timestamp)}</span>
      </div>
      <div style={{ font: "400 13px/1.5 'Instrument Sans', sans-serif", color: "var(--text)" }}>
        {m.text_translated || m.text_original || ""}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {catKeys.map((k) => {
          const cat = catForKey(k);
          return (
            <span key={k} style={{ font: "500 11px 'Instrument Sans', sans-serif", color: cat.color }}>
              {cat.short}
            </span>
          );
        })}
        {m.city && (
          <>
            <span style={{ color: "var(--line)" }}>·</span>
            <span style={{ font: "400 11px 'Instrument Sans', sans-serif", color: "var(--text-2)" }}>{m.city}</span>
          </>
        )}
        {m.lang && (
          <>
            <span style={{ color: "var(--line)" }}>·</span>
            <span style={{ font: "400 10px 'Space Mono', monospace", color: "var(--text-3)" }}>{m.lang.toUpperCase()}</span>
          </>
        )}
        {showThreadBtn && (
          <button
            onClick={() => onViewThread(m.id)}
            style={{
              marginLeft: "auto",
              font: "400 10px 'Space Mono', monospace",
              color: "var(--accent)",
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; }}
          >
            view in thread →
          </button>
        )}
      </div>
    </div>
  );
}
