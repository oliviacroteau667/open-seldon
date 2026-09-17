"use client";
import React from "react";
import { CATEGORIES } from "@/types";

interface Props {
  categoryCounts: Record<string, number>;
  prevCategoryCounts: Record<string, number>;
  labelCount: number;
  total: number;
}

function trendLabel(cur: number, prev: number): { text: string; color: string } {
  if (prev === 0 && cur === 0) return { text: "—", color: "#9A93B8" };
  if (prev === 0) return { text: "▲ new", color: "#64B837" };
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct > 5) return { text: `▲${pct}%`, color: "#64B837" };
  if (pct < -5) return { text: `▼${Math.abs(pct)}%`, color: "#E8553E" };
  return { text: "—", color: "#9A93B8" };
}

export default function CategoryBreakdown({ categoryCounts, prevCategoryCounts, labelCount, total }: Props) {
  const rows = CATEGORIES.map((cat) => ({
    ...cat,
    count: categoryCounts[cat.key] ?? 0,
    trend: trendLabel(categoryCounts[cat.key] ?? 0, prevCategoryCounts[cat.key] ?? 0),
  }));

  const totalCats = rows.reduce((s, r) => s + r.count, 0) || 1;

  return (
    <div style={{
      flex: "1 1 500px",
      maxWidth: 500,
      minWidth: 320,
      background: "rgba(18,16,30,.85)",
      border: "1px solid #2B2745",
      borderRadius: 10,
      padding: "16px 18px",
      backdropFilter: "blur(12px)",
      display: "flex",
      flexDirection: "column",
      gap: 12,
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ font: "600 13px 'Instrument Sans', sans-serif", color: "#EDEBFA" }}>
          Needs by category
        </span>
        <span style={{ font: "400 10px 'Space Mono', monospace", color: "#9A93B8" }}>
          {labelCount} LABELS · {total} MSGS
        </span>
      </div>

      {/* Stacked bar */}
      <div style={{ display: "flex", height: 14, borderRadius: 3, overflow: "hidden", gap: 2 }}>
        {rows.map((r) => (
          <div
            key={r.key}
            title={`${r.name}: ${r.count}`}
            style={{
              flex: r.count || 0.01,
              background: r.color,
              transition: "flex .3s",
              minWidth: r.count > 0 ? 2 : 0,
            }}
          />
        ))}
      </div>

      {/* Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "6px 20px",
        font: "400 12px 'Instrument Sans', sans-serif",
        color: "#C9C4E4",
      }}>
        {rows.map((r) => (
          <div key={r.key} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: r.color, flexShrink: 0 }} />
              {r.name}
            </span>
            <span style={{ font: "400 11px 'Space Mono', monospace", whiteSpace: "nowrap" }}>
              {r.count}{" "}
              <span style={{ color: r.trend.color }}>{r.trend.text}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
