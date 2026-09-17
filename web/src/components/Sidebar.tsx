"use client";
import React from "react";

interface Props {
  collapsed: boolean;
  onToggle: () => void;
  channels: string[];
  channelsOn: Record<string, boolean>;
  onToggleChannel: (ch: string) => void;
  onToggleAll: () => void;
  channelCounts: Record<string, number>;
}

const PAGES = [
  { glyph: "MAP", label: "Map", active: true, dot: false },
  { glyph: "MSG", label: "Messages", active: false, dot: false },
  { glyph: "RPT", label: "Reports", active: false, dot: false },
  { glyph: "ALR", label: "Alerts", active: false, dot: true },
];

export default function Sidebar({ collapsed, onToggle, channels, channelsOn, onToggleChannel, onToggleAll, channelCounts }: Props) {
  const allOn = channels.every((c) => channelsOn[c] !== false);
  const w = collapsed ? 56 : 236;

  return (
    <div style={{
      width: w,
      flex: "none",
      background: "#0C0B16",
      borderRight: "1px solid #221F33",
      display: "flex",
      flexDirection: "column",
      padding: "14px 10px",
      gap: 2,
      transition: "width .2s",
      overflow: "hidden",
      zIndex: 20,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "2px 6px 16px" }}>
        {!collapsed && (
          <span style={{ font: "700 14px 'Instrument Sans', sans-serif", letterSpacing: "-.01em", whiteSpace: "nowrap", color: "#EDEBFA" }}>
            Open Seldon
          </span>
        )}
        <ToggleBtn collapsed={collapsed} onToggle={onToggle} />
      </div>

      {/* Pages */}
      {PAGES.map((p) => (
        <div
          key={p.glyph}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 8px",
            borderRadius: 6,
            background: p.active ? "rgba(139,124,246,.14)" : "transparent",
            color: p.active ? "#EDEBFA" : "#9A93B8",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => { if (!p.active) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,.04)"; }}
          onMouseLeave={(e) => { if (!p.active) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
        >
          <span style={{ width: 20, flexShrink: 0, textAlign: "center", font: "700 10px 'Space Mono', monospace", letterSpacing: ".04em" }}>
            {p.glyph}
          </span>
          {!collapsed && <span style={{ font: "500 13px 'Instrument Sans', sans-serif", flex: 1 }}>{p.label}</span>}
          {!collapsed && p.dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#E8553E", flexShrink: 0 }} />}
        </div>
      ))}

      {/* Divider */}
      <div style={{ height: 1, background: "#221F33", margin: "12px 6px" }} />

      {/* Channels header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 8px 8px", whiteSpace: "nowrap" }}>
        {!collapsed && <span style={{ font: "400 10px 'Space Mono', monospace", color: "#9A93B8", letterSpacing: ".1em" }}>CHANNELS</span>}
        {!collapsed && (
          <span onClick={onToggleAll} style={{ font: "400 10px 'Space Mono', monospace", color: "#8B7CF6", cursor: "pointer" }}>
            {allOn ? "none" : "all"}
          </span>
        )}
      </div>

      {/* Channel rows */}
      {channels.map((ch) => {
        const on = channelsOn[ch] !== false;
        return (
          <div
            key={ch}
            onClick={() => onToggleChannel(ch)}
            title={ch}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "6px 8px",
              borderRadius: 6,
              cursor: "pointer",
              whiteSpace: "nowrap",
              opacity: on ? 1 : 0.55,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,.04)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
          >
            <span style={{
              width: 16,
              height: 16,
              flexShrink: 0,
              borderRadius: 4,
              border: `1px solid ${on ? "#8B7CF6" : "#3A3555"}`,
              background: on ? "#8B7CF6" : "transparent",
              display: "grid",
              placeItems: "center",
              color: "#0A0912",
              font: "700 11px/1 'Space Mono', monospace",
              margin: "0 2px",
            }}>
              {on ? "✓" : ""}
            </span>
            {!collapsed && (
              <>
                <span style={{ font: "400 12px 'Instrument Sans', sans-serif", color: "#C9C4E4", flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {ch}
                </span>
                <span style={{ font: "400 11px 'Space Mono', monospace", color: "#9A93B8" }}>
                  {channelCounts[ch] ?? 0}
                </span>
              </>
            )}
          </div>
        );
      })}

      <div style={{ flex: 1 }} />

      {/* Settings */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: 8,
        borderRadius: 6,
        color: "#9A93B8",
        cursor: "pointer",
        whiteSpace: "nowrap",
        borderTop: "1px solid #221F33",
        marginTop: 8,
        paddingTop: 14,
      }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.color = "#EDEBFA"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.color = "#9A93B8"; }}
      >
        <span style={{ width: 20, flexShrink: 0, textAlign: "center", font: "400 13px 'Space Mono', monospace" }}>⚙</span>
        {!collapsed && <span style={{ font: "500 13px 'Instrument Sans', sans-serif" }}>Settings</span>}
      </div>
    </div>
  );
}

function ToggleBtn({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <span
      onClick={onToggle}
      style={{
        width: 28,
        height: 28,
        flexShrink: 0,
        display: "grid",
        placeItems: "center",
        border: "1px solid #2B2745",
        borderRadius: 6,
        color: "#9A93B8",
        font: "400 12px 'Space Mono', monospace",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLSpanElement).style.color = "#EDEBFA";
        (e.currentTarget as HTMLSpanElement).style.borderColor = "#8B7CF6";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLSpanElement).style.color = "#9A93B8";
        (e.currentTarget as HTMLSpanElement).style.borderColor = "#2B2745";
      }}
    >
      {collapsed ? "›" : "‹"}
    </span>
  );
}
