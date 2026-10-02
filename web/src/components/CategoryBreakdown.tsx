"use client";
import React from "react";
import { CATEGORIES } from "@/types";

interface Props {
  categoryCounts: Record<string, number>;
  prevCategoryCounts: Record<string, number>;
  labelCount: number;
  total: number;
  categoryFilter?: string | null;
  onCategoryFilter?: (key: string | null) => void;
}

function trendLabel(cur: number, prev: number): { text: string; color: string } {
  if (prev === 0 && cur === 0) return { text: "—", color: "var(--text-3)" };
  if (prev === 0) return { text: "▲ new", color: "var(--lime)" };
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct > 5) return { text: `▲${pct}%`, color: "var(--lime)" };
  if (pct < -5) return { text: `▼${Math.abs(pct)}%`, color: "#E8553E" };
  return { text: "—", color: "var(--text-3)" };
}

export default function CategoryBreakdown({ categoryCounts, prevCategoryCounts, labelCount, total, categoryFilter, onCategoryFilter }: Props) {
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
      background: "var(--panel)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      padding: "16px 18px",
      backdropFilter: "blur(20px)",
      display: "flex",
      flexDirection: "column",
      gap: 12,
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ font: "600 13px 'Instrument Sans', sans-serif", color: "var(--text)" }}>
          Needs by category
        </span>
        <span style={{ font: "400 10px 'Space Mono', monospace", color: "var(--text-3)" }}>
          {labelCount} LABELS · {total} MSGS
        </span>
      </div>

      {/* Stacked bar */}
      <div style={{ display: "flex", height: 14, borderRadius: 3, overflow: "hidden", gap: 2 }}>
        {rows.map((r) => {
          const isActive = categoryFilter === r.key;
          const dimmed = categoryFilter !== null && !isActive;
          return (
            <div
              key={r.key}
              role="button"
              tabIndex={r.count > 0 ? 0 : -1}
              aria-pressed={isActive}
              aria-label={`Filter by ${r.name}: ${r.count} messages`}
              title={`${r.name}: ${r.count}`}
              onClick={() => r.count > 0 && onCategoryFilter?.(isActive ? null : r.key)}
              onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && r.count > 0) { e.preventDefault(); onCategoryFilter?.(isActive ? null : r.key); } }}
              style={{
                flex: r.count || 0.01,
                background: r.color,
                opacity: dimmed ? 0.3 : 1,
                transition: "flex .3s, opacity .2s",
                minWidth: r.count > 0 ? 2 : 0,
                cursor: r.count > 0 ? "pointer" : "default",
              }}
            />
          );
        })}
      </div>

      {/* Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "6px 20px",
        font: "400 12px 'Instrument Sans', sans-serif",
        color: "var(--text-2)",
      }}>
        {rows.map((r) => {
          const isActive = categoryFilter === r.key;
          const dimmed = categoryFilter !== null && !isActive;
          return (
            <div
              key={r.key}
              role="button"
              tabIndex={0}
              aria-pressed={isActive}
              aria-label={`Filter by ${r.name}`}
              onClick={() => onCategoryFilter?.(isActive ? null : r.key)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onCategoryFilter?.(isActive ? null : r.key); } }}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
                padding: "3px 4px",
                borderRadius: 4,
                opacity: dimmed ? 0.4 : 1,
                background: isActive ? "var(--accent-tint)" : "transparent",
                outline: isActive ? "1px solid var(--accent-outline)" : "none",
                cursor: "pointer",
                transition: "opacity .2s, background .15s",
              }}
              onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "var(--hover)"; }}
              onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: r.color, flexShrink: 0 }} />
                {r.name}
              </span>
              <span style={{ font: "400 11px 'Space Mono', monospace", whiteSpace: "nowrap" }}>
                {r.count}{" "}
                <span style={{ color: r.trend.color }}>{r.trend.text}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
