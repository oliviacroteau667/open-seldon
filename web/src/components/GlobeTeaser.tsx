"use client";
import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { Message } from "@/types";
import { catKeysForMessage } from "@/types";
import { fetchDashboard } from "@/lib/api";
import CategoryBreakdown from "./CategoryBreakdown";
import { SourceLink, sourceForChannel, sourceUrls } from "./SourceLink";

const MapStage = dynamic(() => import("./MapStage"), { ssr: false, loading: () => null });

const SANS = "'Instrument Sans', sans-serif";
const MONO = "'Space Mono', monospace";
const DAY = 86400000;

function countCategories(msgs: Message[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const m of msgs) for (const k of catKeysForMessage(m)) counts[k] = (counts[k] ?? 0) + 1;
  return counts;
}

// Read-only live globe with the current dataset's counts and channels; no message text
export default function GlobeTeaser({ appPath }: { appPath: string }) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [channels, setChannels] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const [showRegions, setShowRegions] = useState(true);

  useEffect(() => {
    fetchDashboard()
      .then((d) => { setMessages(d.messages); setChannels(d.channels); })
      .catch(() => setFailed(true));
  }, []);

  const stats = useMemo(() => {
    if (!messages) return null;
    const now = Date.now();
    const last30 = messages.filter((m) => now - new Date(m.timestamp).getTime() <= 30 * DAY);
    const prior30 = messages.filter((m) => { const age = now - new Date(m.timestamp).getTime(); return age > 30 * DAY && age <= 60 * DAY; });
    const cities = new Set(messages.map((m) => m.city).filter(Boolean)).size;
    const channelCounts: Record<string, number> = {};
    for (const m of messages) channelCounts[m.channel] = (channelCounts[m.channel] ?? 0) + 1;
    const categoryCounts = countCategories(last30);
    return {
      total: messages.length,
      cities,
      channelCounts,
      categoryCounts,
      prevCategoryCounts: countCategories(prior30),
      labelCount: Object.values(categoryCounts).reduce((a, b) => a + b, 0),
      last30: last30.length,
    };
  }, [messages]);

  return (
    <div className="lp-grid-2">
      {/* Globe */}
      <div style={{ position: "relative", height: "clamp(320px, 52vw, 520px)", borderRadius: 16, overflow: "hidden", border: "1px solid var(--border)", background: "var(--bg)" }}>
        {messages ? (
          <MapStage messages={messages} showRegions={showRegions} onToggleRegions={() => setShowRegions((v) => !v)} autoRotate initialZoom={1.6} />
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", font: `400 11px ${MONO}`, letterSpacing: ".1em", color: "var(--text-3)" }}>
            {failed ? "LIVE DATA UNAVAILABLE" : "LOADING LIVE DATA…"}
          </div>
        )}
        <Link
          href={appPath}
          style={{ position: "absolute", right: 14, bottom: 14, zIndex: 6, font: `400 10px ${MONO}`, letterSpacing: ".08em", color: "var(--text)", background: "var(--panel-strong)", border: "1px solid var(--accent)", borderRadius: 6, padding: "8px 11px", textDecoration: "none", backdropFilter: "blur(20px)" }}
        >
          OPEN THE FULL MAP →
        </Link>
      </div>

      {/* Counts + channels */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
        <div className="lp-grid-4" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
          {[
            ["MESSAGES", stats?.total],
            ["LAST 30 DAYS", stats?.last30],
            ["CHANNELS", stats ? channels.length : undefined],
            ["CITIES", stats?.cities],
          ].map(([label, value]) => (
            <div key={String(label)} style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", backdropFilter: "blur(20px)" }}>
              <div style={{ font: `700 22px ${SANS}`, color: "var(--text)", letterSpacing: "-.01em" }}>{value ?? "—"}</div>
              <div style={{ font: `400 10px ${MONO}`, letterSpacing: ".1em", color: "var(--text-3)", marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {stats && (
          <CategoryBreakdown
            categoryCounts={stats.categoryCounts}
            prevCategoryCounts={stats.prevCategoryCounts}
            labelCount={stats.labelCount}
            total={stats.last30}
          />
        )}

        <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px", backdropFilter: "blur(20px)" }}>
          <div style={{ font: `400 10px ${MONO}`, letterSpacing: ".1em", color: "var(--text-3)", marginBottom: 8 }}>CHANNELS</div>
          {channels.length === 0 && <div style={{ font: `400 12px ${SANS}`, color: "var(--text-3)" }}>—</div>}
          {channels.map((ch) => (
            <div key={ch} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
              <span style={{ font: `400 12px ${SANS}`, color: "var(--text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>@{ch}</span>
              <SourceLink kind={sourceForChannel(ch)} href={sourceUrls[sourceForChannel(ch)].channel(ch)} label={`Open @${ch} in ${sourceUrls[sourceForChannel(ch)].name}`} />
              <span style={{ font: `400 11px ${MONO}`, color: "var(--text-3)" }}>{stats?.channelCounts[ch] ?? 0}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
