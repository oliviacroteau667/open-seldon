"use client";
import React, { useEffect, useRef, useState } from "react";
import { streamChat } from "@/lib/api";
import { createMark } from "@/lib/brand";
import { useTheme } from "./ThemeProvider";
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

// Revolving brand mark shown in place of the reply until the first token arrives
function ThinkingMark() {
  const host = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!host.current) return;
    const mark = createMark(host.current, { width: 28 }).start();
    return () => mark.destroy();
  }, []);
  return <span ref={host} role="img" aria-label="Seldon is thinking" style={{ display: "block", width: 28, height: 28, padding: "4px 0" }} />;
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
          onMouseEnter={(e) => { if (!place) return; ctx.onPlaceHover?.(place); (e.currentTarget as HTMLButtonElement).style.background = "var(--accent-tint-strong)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-bright)"; }}
          onMouseLeave={(e) => { if (!place) return; ctx.onPlaceHover?.(null); (e.currentTarget as HTMLButtonElement).style.background = "var(--accent-tint)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-2)"; }}
          title={place ? `Show ${name} on the map` : `${name} isn't on the map`}
          aria-label={place ? `Show ${name} on the map` : name}
          style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 18, padding: "0 7px 0 5px", margin: "0 1px", verticalAlign: "text-bottom", borderRadius: 999, border: place ? "1px solid var(--accent-outline)" : "1px dashed var(--line-strong)", background: place ? "var(--accent-tint)" : "transparent", color: place ? "var(--text-2)" : "var(--text-3)", font: `500 11px/1 ${SANS}`, cursor: place ? "pointer" : "default", whiteSpace: "nowrap" }}
        >
          <span aria-hidden="true" style={{ font: `400 9px/1 ${MONO}`, color: place ? "var(--accent)" : "var(--text-4)" }}>◎</span>
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
            style={{ display: "inline-grid", placeItems: "center", minWidth: 16, height: 16, padding: "0 4px", margin: "0 1px", verticalAlign: "text-top", borderRadius: 4, border: "1px solid var(--accent-outline)", background: "var(--accent-tint)", color: "var(--accent-soft)", font: `700 9px/1 ${MONO}`, cursor: "pointer" }}
            onMouseEnter={(e) => { ctx.onCiteHover?.(id); (e.currentTarget as HTMLButtonElement).style.background = "var(--accent)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--on-accent)"; }}
            onMouseLeave={(e) => { ctx.onCiteHover?.(null); (e.currentTarget as HTMLButtonElement).style.background = "var(--accent-tint)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--accent-soft)"; }}
          >
            {n}
          </button>
        );
      }
    } else if (tok.startsWith("**")) {
      parts.push(<strong key={i++} style={{ color: "var(--text-bright)", fontWeight: 600 }}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("`")) {
      parts.push(
        <code key={i++} style={{ font: `400 12px ${MONO}`, background: "var(--hover)", padding: "1px 5px", borderRadius: 4 }}>
          {tok.slice(1, -1)}
        </code>
      );
    } else if (tok.startsWith("[")) {
      const label = tok.slice(1, tok.indexOf("]("));
      parts.push(
        <a key={i++} href={m[2]} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", textDecoration: "underline", textUnderlineOffset: 2 }}>
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

const P_STYLE: React.CSSProperties = { font: `400 13px/1.6 ${SANS}`, color: "var(--text)", margin: "0 0 10px" };
const LIST_STYLE: React.CSSProperties = { margin: "0 0 10px", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 };
const LI_STYLE: React.CSSProperties = { font: `400 13px/1.55 ${SANS}`, color: "var(--text)" };

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
      blocks.push(<p key={blocks.length} style={{ ...P_STYLE, fontWeight: 600, color: "var(--text-bright)" }}>{renderInline(heading[1], cite)}</p>);
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
  const markSrc = useTheme().resolved === "light" ? "/brand/mark-light.svg" : "/brand/mark-dark.svg";

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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={markSrc} alt="" aria-hidden="true" width={24} height={24} style={{ display: "block" }} />
        <span aria-hidden="true" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", font: `400 10px ${MONO}`, letterSpacing: ".12em", color: "var(--text-3)" }}>
          SELDON
        </span>
      </div>
    );
  }

  const canSend = input.trim().length > 0 && !streaming;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header — mirrors the Messages panel header */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <span style={{ font: `600 13px ${SANS}`, color: "var(--text)", whiteSpace: "nowrap" }}>
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
          <span style={{ font: `400 10px ${MONO}`, color: "var(--text-3)", whiteSpace: "nowrap" }}>
            {contextIds.length} IN VIEW
          </span>
        </div>
      </div>

      {/* Transcript */}
      <div ref={bodyRef} className="feed-scroll" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "18px 16px 8px", display: "flex", flexDirection: "column", gap: 14 }}>
        {messages.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 8 }}>
            <p style={{ font: `400 13px/1.6 ${SANS}`, color: "var(--text-3)", margin: 0 }}>
              Ask about the <span style={{ color: "var(--text)" }}>{contextIds.length}</span> messages currently in view. Answers are scoped to your active filters.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  style={{ font: `400 12px ${SANS}`, color: "var(--text-2)", background: "var(--hover)", border: "1px solid var(--line)", borderRadius: 999, padding: "6px 12px", cursor: "pointer", textAlign: "left" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--line)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-2)"; }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} style={{ alignSelf: "flex-end", maxWidth: "85%", background: "var(--accent)", color: "var(--on-accent)", font: `400 13px/1.45 ${SANS}`, padding: "8px 12px", borderRadius: "14px 14px 4px 14px", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {m.text}
            </div>
          ) : (
            <div key={i} style={{ alignSelf: "stretch", maxWidth: "100%", wordBreak: "break-word" }}>
              {m.text ? (
                <Markdown text={m.text} ctx={inlineCtx} />
              ) : (
                <ThinkingMark />
              )}
            </div>
          )
        )}
      </div>

      {/* Composer */}
      <div style={{ padding: "10px 12px 14px", borderTop: "1px solid var(--border)" }}>
        <div
          style={{ display: "flex", alignItems: "flex-end", gap: 8, padding: "8px 8px 8px 12px", border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-faint)" }}
          onFocusCapture={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--accent)"; }}
          onBlurCapture={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--line)"; }}
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
            style={{ flex: 1, resize: "none", background: "transparent", border: "none", outline: "none", font: `400 13px/1.5 ${SANS}`, color: "var(--text)", maxHeight: 120, padding: "4px 0" }}
          />
          <button
            onClick={() => send()}
            disabled={!canSend}
            aria-label="Send"
            style={{ width: 28, height: 28, flexShrink: 0, borderRadius: "50%", border: "none", display: "grid", placeItems: "center", background: canSend ? "var(--accent)" : "var(--hover)", color: canSend ? "var(--on-accent)" : "var(--text-4)", font: `700 14px/1 ${MONO}`, cursor: canSend ? "pointer" : "default", transition: "background .15s" }}
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}
