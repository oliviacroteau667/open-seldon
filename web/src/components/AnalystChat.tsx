"use client";
import React, { useEffect, useRef, useState } from "react";
import { streamChat } from "@/lib/api";
import type { MapHighlight, Message, PlaceRef } from "@/types";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

interface Props {
  contextIds: number[];
  collapsed: boolean;
  onRailMouseDown: (e: React.MouseEvent) => void; // the collapsed rail is itself the drag handle
  onCiteClick?: (messageId: number) => void;
  resolveMessage?: (id: number) => Message | undefined;
  resolvePlace?: (name: string) => PlaceRef | null;
  onHighlight?: (h: MapHighlight | null) => void;
  onFlyTo?: (place: PlaceRef) => void;
}

interface InlineCtx {
  index: Map<number, number>;
  onCiteClick?: (id: number) => void;
  onCiteHover?: (id: number | null) => void;
  resolvePlace?: (name: string) => PlaceRef | null;
  onPlaceHover?: (place: PlaceRef | null) => void;
  onPlaceClick?: (place: PlaceRef) => void;
}

function highlightForPlace(p: PlaceRef): MapHighlight {
  return p.kind === "city" ? { cities: [p.name], regions: [] } : { cities: [], regions: [p.name] };
}

function highlightForMessage(m: Message): MapHighlight {
  return {
    cities: m.city ? [m.city] : [],
    regions: (m.geocoded_locations ?? [])
      .filter((l) => l.type === "country" || l.type === "region")
      .map((l) => l.name),
  };
}

const CITE_RE = /\[#\d+(?:\s*,\s*#?\d+)*\]/g;

function citedIds(token: string): number[] {
  return [...token.matchAll(/\d+/g)].map((m) => Number(m[0]));
}

// Number every distinct cited message in order of first appearance within one reply
function buildCiteIndex(text: string): Map<number, number> {
  const index = new Map<number, number>();
  for (const m of text.matchAll(CITE_RE)) {
    for (const id of citedIds(m[0])) if (!index.has(id)) index.set(id, index.size + 1);
  }
  return index;
}

const SUGGESTIONS = [
  "Summarize the main needs in view",
  "Which cities come up most often?",
  "Any urgent safety issues?",
];

const MONO = "'Space Mono', monospace";
const SANS = "'Instrument Sans', sans-serif";

// ── Minimal markdown: paragraphs, bullet/numbered lists, **bold**, *italic*, `code`, [links](url)
function renderInline(text: string, ctx: InlineCtx): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /(\[@[^\]\n]+\]|\[#\d+(?:\s*,\s*#?\d+)*\]|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\((https?:\/\/[^)\s]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("[@")) {
      const name = tok.slice(2, -1).trim();
      const place = ctx.resolvePlace?.(name) ?? null;
      parts.push(
        <button
          key={i++}
          disabled={!place}
          onClick={() => place && ctx.onPlaceClick?.(place)}
          onMouseEnter={(e) => { if (!place) return; ctx.onPlaceHover?.(place); (e.currentTarget as HTMLButtonElement).style.background = "rgba(139,124,246,.3)"; (e.currentTarget as HTMLButtonElement).style.color = "#FFFFFF"; }}
          onMouseLeave={(e) => { if (!place) return; ctx.onPlaceHover?.(null); (e.currentTarget as HTMLButtonElement).style.background = "rgba(139,124,246,.12)"; (e.currentTarget as HTMLButtonElement).style.color = "#C9C4E4"; }}
          title={place ? `Show ${name} on the map` : `${name} isn't on the map`}
          aria-label={place ? `Show ${name} on the map` : name}
          style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 18, padding: "0 7px 0 5px", margin: "0 1px", verticalAlign: "text-bottom", borderRadius: 999, border: place ? "1px solid rgba(179,168,255,.45)" : "1px dashed rgba(154,147,184,.4)", background: place ? "rgba(139,124,246,.12)" : "transparent", color: place ? "#C9C4E4" : "#9A93B8", font: `500 11px/1 ${SANS}`, cursor: place ? "pointer" : "default", whiteSpace: "nowrap" }}
        >
          <span aria-hidden="true" style={{ font: `400 9px/1 ${MONO}`, color: place ? "#8B7CF6" : "#5A5478" }}>◎</span>
          {name}
        </button>
      );
    } else if (tok.startsWith("[#")) {
      for (const id of citedIds(tok)) {
        const n = ctx.index.get(id) ?? "?";
        parts.push(
          <button
            key={i++}
            onClick={() => ctx.onCiteClick?.(id)}
            title={`Open message #${id}`}
            aria-label={`Open cited message ${n}`}
            style={{ display: "inline-grid", placeItems: "center", minWidth: 16, height: 16, padding: "0 4px", margin: "0 1px", verticalAlign: "text-top", borderRadius: 4, border: "1px solid rgba(139,124,246,.5)", background: "rgba(139,124,246,.14)", color: "#B4A9FF", font: `700 9px/1 ${MONO}`, cursor: "pointer" }}
            onMouseEnter={(e) => { ctx.onCiteHover?.(id); (e.currentTarget as HTMLButtonElement).style.background = "#8B7CF6"; (e.currentTarget as HTMLButtonElement).style.color = "#0A0912"; }}
            onMouseLeave={(e) => { ctx.onCiteHover?.(null); (e.currentTarget as HTMLButtonElement).style.background = "rgba(139,124,246,.14)"; (e.currentTarget as HTMLButtonElement).style.color = "#B4A9FF"; }}
          >
            {n}
          </button>
        );
      }
    } else if (tok.startsWith("**")) {
      parts.push(<strong key={i++} style={{ color: "#FFFFFF", fontWeight: 600 }}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("`")) {
      parts.push(
        <code key={i++} style={{ font: `400 12px ${MONO}`, background: "rgba(255,255,255,.06)", padding: "1px 5px", borderRadius: 4 }}>
          {tok.slice(1, -1)}
        </code>
      );
    } else if (tok.startsWith("[")) {
      const label = tok.slice(1, tok.indexOf("]("));
      parts.push(
        <a key={i++} href={m[2]} target="_blank" rel="noopener noreferrer" style={{ color: "#8B7CF6", textDecoration: "underline", textUnderlineOffset: 2 }}>
          {label}
        </a>
      );
    } else {
      parts.push(<em key={i++}>{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

const P_STYLE: React.CSSProperties = { font: `400 13px/1.6 ${SANS}`, color: "#EDEBFA", margin: "0 0 10px" };
const LIST_STYLE: React.CSSProperties = { margin: "0 0 10px", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 };
const LI_STYLE: React.CSSProperties = { font: `400 13px/1.55 ${SANS}`, color: "#EDEBFA" };

function Markdown({ text, ctx: partial }: { text: string; ctx: Omit<InlineCtx, "index"> }) {
  const cite: InlineCtx = { ...partial, index: buildCiteIndex(text) };
  const blocks: React.ReactNode[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushPara = () => {
    if (para.length) {
      blocks.push(<p key={blocks.length} style={P_STYLE}>{renderInline(para.join(" "), cite)}</p>);
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      const Tag: "ol" | "ul" = list.ordered ? "ol" : "ul";
      blocks.push(
        <Tag key={blocks.length} style={LIST_STYLE}>
          {list.items.map((it, i) => <li key={i} style={LI_STYLE}>{renderInline(it, cite)}</li>)}
        </Tag>
      );
      list = null;
    }
  };

  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const ul = /^\s*[-*•]\s+(.*)/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)/.exec(line);
    if (ul || ol) {
      flushPara();
      const ordered = !!ol;
      if (!list || list.ordered !== ordered) { flushList(); list = { ordered, items: [] }; }
      list.items.push((ul ?? ol)![1]);
      continue;
    }
    if (line.trim() === "") { flushPara(); flushList(); continue; }
    const heading = /^#{1,6}\s+(.*)/.exec(line);
    if (heading) {
      flushPara(); flushList();
      blocks.push(<p key={blocks.length} style={{ ...P_STYLE, fontWeight: 600, color: "#FFFFFF" }}>{renderInline(heading[1], cite)}</p>);
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();
  return <>{blocks}</>;
}

export default function AnalystChat({ contextIds, collapsed, onRailMouseDown, onCiteClick, resolveMessage, resolvePlace, onHighlight, onFlyTo }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streamingRef = useRef(false);

  // Map highlight: hover is transient, pinned sticks until the same place is clicked again or CLEAR
  const [pinned, setPinned] = useState<MapHighlight | null>(null);
  const [hover, setHover] = useState<MapHighlight | null>(null);
  useEffect(() => { onHighlight?.(hover ?? pinned); }, [hover, pinned, onHighlight]);

  const inlineCtx: Omit<InlineCtx, "index"> = {
    onCiteClick,
    resolvePlace,
    onCiteHover: (id) => {
      if (id == null) { setHover(null); return; }
      const m = resolveMessage?.(id);
      setHover(m ? highlightForMessage(m) : null);
    },
    onPlaceHover: (p) => setHover(p ? highlightForPlace(p) : null),
    onPlaceClick: (p) => {
      const h = highlightForPlace(p);
      setPinned((prev) => (prev && prev.cities[0] === h.cities[0] && prev.regions[0] === h.regions[0]) ? null : h);
      onFlyTo?.(p);
    },
  };

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages]);

  async function send(raw?: string) {
    const text = (raw ?? input).trim();
    // streamingRef guards against a second call landing before React re-renders with streaming=true
    if (!text || streamingRef.current) return;
    streamingRef.current = true;
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setStreaming(true);

    let assistantIdx = -1;
    setMessages((ms) => {
      assistantIdx = ms.length + 1;
      return [...ms, { role: "user", text }, { role: "assistant", text: "" }];
    });

    const patchAssistant = (fn: (prev: string) => string) =>
      setMessages((ms) => {
        if (assistantIdx < 0 || assistantIdx >= ms.length) return ms;
        const copy = [...ms];
        copy[assistantIdx] = { role: "assistant", text: fn(copy[assistantIdx].text) };
        return copy;
      });

    try {
      for await (const chunk of streamChat(text, contextIds.slice(0, 150))) {
        patchAssistant((prev) => prev + chunk);
      }
    } catch {
      patchAssistant(() => "Error reaching the API. Please try again.");
    } finally {
      streamingRef.current = false;
      setStreaming(false);
    }
  }

  // ── Collapsed rail ───────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <div
        onMouseDown={onRailMouseDown}
        aria-label="Seldon panel (drag to expand)"
        style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", padding: "18px 0", gap: 14, cursor: "ew-resize", userSelect: "none" }}
      >
        <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: "#8B7CF6" }} />
        <span aria-hidden="true" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", font: `400 10px ${MONO}`, letterSpacing: ".12em", color: "#9A93B8" }}>
          SELDON
        </span>
      </div>
    );
  }

  const canSend = input.trim().length > 0 && !streaming;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header — mirrors the Messages panel header */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,.07)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <span style={{ font: `600 13px ${SANS}`, color: "#EDEBFA", display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
          <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: "#8B7CF6", boxShadow: streaming ? "0 0 0 4px rgba(139,124,246,.25)" : "none", transition: "box-shadow .2s" }} />
          Seldon
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {messages.length > 0 && !streaming && (
            <button
              onClick={() => { setMessages([]); setPinned(null); setHover(null); }}
              style={{ font: `400 10px ${MONO}`, color: "#F5A524", background: "none", border: "none", padding: 0, cursor: "pointer" }}
            >
              CLEAR ✕
            </button>
          )}
          <span style={{ font: `400 10px ${MONO}`, color: "#9A93B8", whiteSpace: "nowrap" }}>
            {contextIds.length} IN VIEW
          </span>
        </div>
      </div>

      {/* Transcript */}
      <div ref={bodyRef} className="feed-scroll" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "18px 16px 8px", display: "flex", flexDirection: "column", gap: 14 }}>
        {messages.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 8 }}>
            <p style={{ font: `400 13px/1.6 ${SANS}`, color: "#9A93B8", margin: 0 }}>
              Ask about the <span style={{ color: "#EDEBFA" }}>{contextIds.length}</span> messages currently in view. Answers are scoped to your active filters.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  style={{ font: `400 12px ${SANS}`, color: "#C9C4E4", background: "rgba(255,255,255,.03)", border: "1px solid #2B2745", borderRadius: 999, padding: "6px 12px", cursor: "pointer", textAlign: "left" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#8B7CF6"; (e.currentTarget as HTMLButtonElement).style.color = "#EDEBFA"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#2B2745"; (e.currentTarget as HTMLButtonElement).style.color = "#C9C4E4"; }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} style={{ alignSelf: "flex-end", maxWidth: "85%", background: "#8B7CF6", color: "#0A0912", font: `400 13px/1.45 ${SANS}`, padding: "8px 12px", borderRadius: "14px 14px 4px 14px", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {m.text}
            </div>
          ) : (
            <div key={i} style={{ alignSelf: "stretch", maxWidth: "100%", wordBreak: "break-word" }}>
              {m.text ? (
                <Markdown text={m.text} ctx={inlineCtx} />
              ) : (
                <span className="typing-dots" aria-label="Seldon is typing"><i /><i /><i /></span>
              )}
            </div>
          )
        )}
      </div>

      {/* Composer */}
      <div style={{ padding: "10px 12px 14px", borderTop: "1px solid rgba(255,255,255,.07)" }}>
        <div
          style={{ display: "flex", alignItems: "flex-end", gap: 8, padding: "8px 8px 8px 12px", border: "1px solid #2B2745", borderRadius: 12, background: "rgba(255,255,255,.02)" }}
          onFocusCapture={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "#8B7CF6"; }}
          onBlurCapture={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "#2B2745"; }}
        >
          <textarea
            ref={inputRef}
            value={input}
            rows={1}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask Seldon…"
            disabled={streaming}
            aria-label="Message Seldon"
            style={{ flex: 1, resize: "none", background: "transparent", border: "none", outline: "none", font: `400 13px/1.5 ${SANS}`, color: "#EDEBFA", maxHeight: 120, padding: "4px 0" }}
          />
          <button
            onClick={() => send()}
            disabled={!canSend}
            aria-label="Send"
            style={{ width: 28, height: 28, flexShrink: 0, borderRadius: "50%", border: "none", display: "grid", placeItems: "center", background: canSend ? "#8B7CF6" : "rgba(255,255,255,.06)", color: canSend ? "#0A0912" : "#5A5478", font: `700 14px/1 ${MONO}`, cursor: canSend ? "pointer" : "default", transition: "background .15s" }}
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}
