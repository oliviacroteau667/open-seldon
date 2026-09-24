"use client";
import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Message } from "@/types";
import { CATEGORIES, catKeysForMessage } from "@/types";
import { fetchDashboard } from "@/lib/api";
import { useWindowSize } from "@/hooks/useWindowSize";
import Sidebar from "./Sidebar";
import DateSlider from "./DateSlider";
import CategoryBreakdown from "./CategoryBreakdown";
import MessageFeed from "./MessageFeed";
import AnalystChat from "./AnalystChat";

// No SSR — deck.gl and maplibre are browser-only
const MapStage = dynamic(() => import("./MapStage"), { ssr: false, loading: () => null });

function buildDayBuckets(messages: Message[], days: number): number[] {
  const now = Date.now();
  const buckets = new Array<number>(days).fill(0);
  for (const m of messages) {
    const age = Math.floor((now - new Date(m.timestamp).getTime()) / 86400000);
    const idx = days - 1 - age;
    if (idx >= 0 && idx < days) buckets[idx]++;
  }
  return buckets;
}

function dayLabel(idx: number, days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - (days - 1 - idx));
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).toUpperCase();
}

export default function Dashboard() {
  const { width } = useWindowSize();
  const isMobile = width < 640;
  const isSmall = width < 1100;

  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [channels, setChannels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Auto-collapse sidebar on small viewports
  useEffect(() => {
    setSidebarCollapsed(isSmall);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSmall]);
  const [channelsOn, setChannelsOn] = useState<Record<string, boolean>>({});
  const [range, setRange] = useState<[number, number] | null>(null);
  const [showRegions, setShowRegions] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboard()
      .then((data) => {
        setAllMessages(data.messages);
        setChannels(data.channels);
        setChannelsOn(Object.fromEntries(data.channels.map((c) => [c, true])));
        setLoading(false);
      })
      .catch((e) => {
        setError(String(e));
        setLoading(false);
      });
  }, []);

  // Compute day span dynamically from actual message dates
  const DAYS = useMemo(() => {
    if (allMessages.length === 0) return 30;
    const oldest = new Date(allMessages[allMessages.length - 1].timestamp).getTime();
    return Math.ceil((Date.now() - oldest) / 86400000) + 1;
  }, [allMessages]);

  const channelMessages = useMemo(
    () => allMessages.filter((m) => channelsOn[m.channel] !== false),
    [allMessages, channelsOn]
  );

  const dayCounts = useMemo(() => buildDayBuckets(channelMessages, DAYS), [channelMessages]);

  // Default range: full span once DAYS is known
  const effectiveRange = range ?? [0, DAYS - 1];
  const [startIdx, endIdx] = effectiveRange;

  const inRange = useMemo(() => {
    const now = Date.now();
    return channelMessages.filter((m) => {
      const age = Math.floor((now - new Date(m.timestamp).getTime()) / 86400000);
      const idx = DAYS - 1 - age;
      return idx >= startIdx && idx <= endIdx;
    });
  }, [channelMessages, startIdx, endIdx]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of inRange) {
      for (const key of catKeysForMessage(m)) {
        counts[key] = (counts[key] ?? 0) + 1;
      }
    }
    return counts;
  }, [inRange]);

  // Previous window for trend calculation
  const prevWindowLen = endIdx - startIdx + 1;
  const prevStart = Math.max(0, startIdx - prevWindowLen);
  const prevInRange = useMemo(() => {
    const now = Date.now();
    return channelMessages.filter((m) => {
      const age = Math.floor((now - new Date(m.timestamp).getTime()) / 86400000);
      const idx = DAYS - 1 - age;
      return idx >= prevStart && idx < startIdx;
    });
  }, [channelMessages, prevStart, startIdx]);

  const prevCategoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of prevInRange) {
      for (const key of catKeysForMessage(m)) counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [prevInRange]);

  const displayedMessages = useMemo(
    () => (!categoryFilter ? inRange : inRange.filter((m) => catKeysForMessage(m).includes(categoryFilter))),
    [inRange, categoryFilter]
  );

  const channelCounts = useMemo(() => {
    const now = Date.now();
    const counts: Record<string, number> = {};
    for (const m of allMessages) {
      const age = Math.floor((now - new Date(m.timestamp).getTime()) / 86400000);
      const idx = DAYS - 1 - age;
      if (idx >= startIdx && idx <= endIdx) {
        counts[m.channel] = (counts[m.channel] ?? 0) + 1;
      }
    }
    return counts;
  }, [allMessages, startIdx, endIdx]);

  const labelCount = Object.values(categoryCounts).reduce((a, b) => a + b, 0);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0A0912", color: "#9A93B8", font: "400 11px 'Space Mono', monospace" }}>
        LOADING DATA…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0A0912", color: "#E8553E", font: "400 11px 'Space Mono', monospace" }}>
        ERROR: {error}
      </div>
    );
  }

  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100dvh", background: "#0A0912", overflow: "hidden", userSelect: "none" }}>
        {/* Compact top bar */}
        <div style={{ padding: "10px 12px", zIndex: 10 }}>
          <DateSlider
            dayCounts={dayCounts}
            range={effectiveRange}
            onRangeChange={setRange}
            days={DAYS}
            totalInRange={inRange.length}
            activeChannels={channels.filter((c) => channelsOn[c]).length}
            dayLabel={(i) => dayLabel(i, DAYS)}
          />
        </div>
        {/* Map: top half */}
        <div style={{ flex: "0 0 45vh", position: "relative" }}>
          <MapStage messages={inRange} showRegions={showRegions} onToggleRegions={() => setShowRegions((v) => !v)} />
        </div>
        {/* Scrollable messages below */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px", display: "flex", flexDirection: "column" }}>
          <MessageFeed
            messages={displayedMessages}
            categoryFilter={categoryFilter}
            onCategoryFilter={setCategoryFilter}
            total={inRange.length}
            inline
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", background: "#0A0912", overflow: "hidden", userSelect: "none" }}>
      {!isMobile && (
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((c) => !c)}
          channels={channels}
          channelsOn={channelsOn}
          onToggleChannel={(ch) => setChannelsOn((prev) => ({ ...prev, [ch]: !prev[ch] }))}
          onToggleAll={() => {
            const allOn = channels.every((c) => channelsOn[c]);
            setChannelsOn(Object.fromEntries(channels.map((c) => [c, !allOn])));
          }}
          channelCounts={channelCounts}
        />
      )}

      <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
        {/* Top bar: always above the map */}
        <div style={{ position: "absolute", left: 20, right: 20, top: 16, display: "flex", alignItems: "center", gap: 12, zIndex: 10, pointerEvents: "none" }}>
          <div style={{ flex: 1, pointerEvents: "auto" }}>
            <DateSlider
              dayCounts={dayCounts}
              range={effectiveRange}
              onRangeChange={setRange}
              days={DAYS}
              totalInRange={inRange.length}
              activeChannels={channels.filter((c) => channelsOn[c]).length}
              dayLabel={(i) => dayLabel(i, DAYS)}
            />
          </div>
          <div style={{ pointerEvents: "auto" }}>
            <SummaryButton />
          </div>
        </div>

        {/* Map fills the entire stage */}
        <MapStage
          messages={inRange}
          showRegions={showRegions}
          onToggleRegions={() => setShowRegions((v) => !v)}
        />

        {/* Bottom-left overlay: category breakdown + analyst chat */}
        <div style={{ position: "absolute", left: 20, right: isSmall ? 20 : 420, bottom: 20, display: "flex", alignItems: "flex-end", gap: 16, zIndex: 10, pointerEvents: "none" }}>
          <div style={{ pointerEvents: "auto", flex: "1 1 320px", maxWidth: 500, minWidth: 0 }}>
            <CategoryBreakdown
              categoryCounts={categoryCounts}
              prevCategoryCounts={prevCategoryCounts}
              labelCount={labelCount}
              total={inRange.length}
            />
          </div>
          {!isSmall && (
            <div style={{ pointerEvents: "auto", flex: "1 1 380px", maxWidth: 380, minWidth: 280 }}>
              <AnalystChat contextIds={inRange.map((m) => m.id)} />
            </div>
          )}
        </div>

        {/* Messages panel — hidden on small viewports */}
        {!isSmall && (
          <MessageFeed
            messages={displayedMessages}
            categoryFilter={categoryFilter}
            onCategoryFilter={setCategoryFilter}
            total={inRange.length}
          />
        )}
      </div>
    </div>
  );
}

function SummaryButton() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [streaming, setStreaming] = useState(false);

  const weekNum = (() => {
    const now = new Date();
    const jan1 = new Date(now.getFullYear(), 0, 1);
    return Math.ceil(((now.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  })();

  async function handleClick() {
    if (streaming) return;
    setOpen(true);
    setText("");
    setStreaming(true);
    try {
      const { streamSummary } = await import("@/lib/api");
      for await (const chunk of streamSummary()) {
        setText((t) => t + chunk);
      }
    } finally {
      setStreaming(false);
    }
  }

  return (
    <>
      <div
        onClick={handleClick}
        style={{ height: 44, display: "flex", alignItems: "center", padding: "0 16px", background: "#8B7CF6", color: "#0A0912", borderRadius: 8, font: "600 13px 'Instrument Sans', sans-serif", cursor: "pointer", whiteSpace: "nowrap" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#9D90FF"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#8B7CF6"; }}
      >
        Summary · Wk {weekNum} →
      </div>
      {open && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(10,9,18,.7)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{ background: "rgba(18,16,30,.95)", border: "1px solid #2B2745", borderRadius: 12, padding: 28, maxWidth: 560, width: "90%", backdropFilter: "blur(20px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ font: "600 13px 'Instrument Sans', sans-serif", marginBottom: 14, color: "#EDEBFA" }}>
              Week {weekNum} Summary
            </div>
            <div style={{ font: "400 13px/1.6 'Instrument Sans', sans-serif", color: "#C9C4E4", whiteSpace: "pre-wrap" }}>
              {text || (streaming ? "Generating…" : "No content yet")}
            </div>
            <div
              onClick={() => setOpen(false)}
              style={{ marginTop: 18, font: "400 11px 'Space Mono', monospace", color: "#9A93B8", cursor: "pointer" }}
            >
              Close ✕
            </div>
          </div>
        </div>
      )}
    </>
  );
}
