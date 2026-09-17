"use client";
import React, { useState } from "react";
import type { Message } from "@/types";
import { CATEGORIES, catKeysForMessage, catForKey } from "@/types";

interface Props {
  messages: Message[];
  categoryFilter: string | null;
  onCategoryFilter: (key: string | null) => void;
  total: number;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).toUpperCase() +
    " " + d.toTimeString().slice(0, 5);
}

export default function MessageFeed({ messages, categoryFilter, onCategoryFilter, total }: Props) {
  const catFilterCat = categoryFilter ? catForKey(categoryFilter) : null;

  return (
    <div style={{
      position: "absolute",
      right: 20,
      top: 76,
      bottom: 20,
      width: 380,
      background: "rgba(18,16,30,.9)",
      border: "1px solid #2B2745",
      borderRadius: 10,
      backdropFilter: "blur(12px)",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      zIndex: 10,
    }}>
      {/* Header */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #2B2745", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ font: "600 13px 'Instrument Sans', sans-serif", color: "#EDEBFA" }}>Messages</span>
          <span style={{ font: "400 10px 'Space Mono', monospace", color: "#9A93B8" }}>
            {total} · NEWEST FIRST
          </span>
        </div>
        {/* Filters */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <CategoryChip active={catFilterCat} onCycle={() => {
            if (!categoryFilter) {
              onCategoryFilter(CATEGORIES[0].key);
            } else {
              const idx = CATEGORIES.findIndex((c) => c.key === categoryFilter);
              onCategoryFilter(idx >= CATEGORIES.length - 1 ? null : CATEGORIES[idx + 1].key);
            }
          }} />
          <span style={{ font: "500 11px 'Instrument Sans', sans-serif", color: "#9A93B8", border: "1px solid #2B2745", padding: "4px 8px", borderRadius: 3, cursor: "default" }}>
            Channel ▾
          </span>
          <span style={{ font: "500 11px 'Instrument Sans', sans-serif", color: "#9A93B8", border: "1px solid #2B2745", padding: "4px 8px", borderRadius: 3, cursor: "default" }}>
            Language ▾
          </span>
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflow: "auto", padding: "6px 0" }}>
        {messages.length === 0 ? (
          <div style={{ padding: "24px 16px", font: "400 12px 'Instrument Sans', sans-serif", color: "#9A93B8", textAlign: "center" }}>
            No messages match the current channels and date range.
          </div>
        ) : (
          messages.map((m) => <MessageCard key={m.id} message={m} />)
        )}
      </div>
    </div>
  );
}

function CategoryChip({ active, onCycle }: { active: { name: string; color: string } | null; onCycle: () => void }) {
  if (!active) {
    return (
      <span
        onClick={onCycle}
        style={{ font: "500 11px 'Instrument Sans', sans-serif", color: "#EDEBFA", background: "#1F1B33", border: "1px solid #1F1B33", padding: "4px 8px", borderRadius: 3, cursor: "pointer" }}>
        All categories ▾
      </span>
    );
  }
  return (
    <span
      onClick={onCycle}
      style={{ font: "500 11px 'Instrument Sans', sans-serif", color: active.color, background: "transparent", border: `1px solid ${active.color}`, padding: "4px 8px", borderRadius: 3, cursor: "pointer" }}>
      {active.name} ▾
    </span>
  );
}

function MessageCard({ message: m }: { message: Message }) {
  const catKeys = catKeysForMessage(m);
  const primaryCat = catKeys.length > 0 ? catForKey(catKeys[0]) : null;

  return (
    <div style={{
      padding: "12px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 8,
      borderLeft: `3px solid ${primaryCat?.color ?? "#3A3555"}`,
      margin: "4px 8px",
      background: "rgba(255,255,255,.03)",
      borderRadius: "0 6px 6px 0",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", font: "400 10px 'Space Mono', monospace", color: "#9A93B8" }}>
        <span>@{m.channel}</span>
        <span>{formatTime(m.timestamp)}</span>
      </div>
      <div style={{ font: "400 13px/1.5 'Instrument Sans', sans-serif", color: "#EDEBFA" }}>
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
            <span style={{ color: "#2B2745" }}>·</span>
            <span style={{ font: "400 11px 'Instrument Sans', sans-serif", color: "#C9C4E4" }}>{m.city}</span>
          </>
        )}
        {m.lang && (
          <>
            <span style={{ color: "#2B2745" }}>·</span>
            <span style={{ font: "400 10px 'Space Mono', monospace", color: "#9A93B8" }}>{m.lang.toUpperCase()}</span>
          </>
        )}
      </div>
    </div>
  );
}
