"use client";
import React, { useState } from "react";
import { PanelToggle } from "./PanelToggle";

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

function activateOnEnterSpace(fn: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); }
  };
}

export default function Sidebar({ collapsed, onToggle, channels, channelsOn, onToggleChannel, onToggleAll, channelCounts }: Props) {
  const allOn = channels.every((c) => channelsOn[c] !== false);
  const [dragWidth, setDragWidth] = useState<number | null>(null);

  const displayW = dragWidth !== null ? dragWidth : (collapsed ? 56 : 236);
  const isCollapsed = dragWidth !== null ? dragWidth < 100 : collapsed;

  function startDrag(e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = collapsed ? 56 : 236;
    const onMove = (ev: MouseEvent) => {
      setDragWidth(Math.max(40, Math.min(360, startW + ev.clientX - startX)));
    };
    const onUp = (ev: MouseEvent) => {
      const finalW = Math.max(40, Math.min(360, startW + ev.clientX - startX));
      setDragWidth(null);
      const willCollapse = finalW < 150;
      if (willCollapse !== collapsed) onToggle();
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  return (
    <nav
      aria-label="Main navigation"
      style={{
        width: displayW,
        flex: "none",
        background: "rgba(18,16,30,.68)",
        backdropFilter: "blur(20px)",
        borderRight: "1px solid rgba(255,255,255,.07)",
        display: "flex",
        flexDirection: "column",
        padding: "14px 10px",
        gap: 2,
        transition: dragWidth !== null ? "none" : "width .2s",
        overflow: "hidden",
        zIndex: 20,
        position: "relative",
        height: "100%",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "2px 6px 16px" }}>
        {!isCollapsed && (
          <span style={{ font: "700 14px 'Instrument Sans', sans-serif", letterSpacing: "-.01em", whiteSpace: "nowrap", color: "#EDEBFA" }}>
            Open Seldon
          </span>
        )}
        <PanelToggle
          pointRight={isCollapsed}
          onClick={onToggle}
          ariaLabel={isCollapsed ? "Expand navigation" : "Collapse navigation"}
        />
      </div>

      {/* Pages */}
      {PAGES.map((p) => (
        <div
          key={p.glyph}
          role="button"
          tabIndex={0}
          aria-label={p.label + (p.dot ? " (has notifications)" : "")}
          aria-current={p.active ? "page" : undefined}
          onKeyDown={activateOnEnterSpace(() => {})}
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
          <span aria-hidden="true" style={{ width: 20, flexShrink: 0, textAlign: "center", font: "700 10px 'Space Mono', monospace", letterSpacing: ".04em" }}>
            {p.glyph}
          </span>
          {!isCollapsed && <span style={{ font: "500 13px 'Instrument Sans', sans-serif", flex: 1 }}>{p.label}</span>}
          {!isCollapsed && p.dot && <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: "#E8553E", flexShrink: 0 }} />}
        </div>
      ))}

      {/* Divider */}
      <div role="separator" style={{ height: 1, background: "rgba(255,255,255,.07)", margin: "12px 6px" }} />

      {/* Channels header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 8px 8px", whiteSpace: "nowrap" }}>
        {!isCollapsed && <span id="channels-label" style={{ font: "400 10px 'Space Mono', monospace", color: "#9A93B8", letterSpacing: ".1em" }}>CHANNELS</span>}
        {!isCollapsed && (
          <button
            onClick={onToggleAll}
            onKeyDown={activateOnEnterSpace(onToggleAll)}
            aria-label={allOn ? "Deselect all channels" : "Select all channels"}
            style={{ font: "400 10px 'Space Mono', monospace", color: "#8B7CF6", cursor: "pointer", background: "none", border: "none", padding: 0 }}
          >
            {allOn ? "none" : "all"}
          </button>
        )}
      </div>

      {/* Channel rows */}
      <div role="group" aria-labelledby="channels-label">
        {channels.map((ch) => {
          const on = channelsOn[ch] !== false;
          return (
            <div
              key={ch}
              role="checkbox"
              aria-checked={on}
              aria-label={ch}
              tabIndex={0}
              onClick={() => onToggleChannel(ch)}
              onKeyDown={activateOnEnterSpace(() => onToggleChannel(ch))}
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
              <span aria-hidden="true" style={{
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
              {!isCollapsed && (
                <>
                  <span style={{ font: "400 12px 'Instrument Sans', sans-serif", color: "#C9C4E4", flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {ch}
                  </span>
                  <span aria-hidden="true" style={{ font: "400 11px 'Space Mono', monospace", color: "#9A93B8" }}>
                    {channelCounts[ch] ?? 0}
                  </span>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ flex: 1 }} />

      {/* Settings */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Settings"
        onKeyDown={activateOnEnterSpace(() => {})}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: 8,
          borderRadius: 6,
          color: "#9A93B8",
          cursor: "pointer",
          whiteSpace: "nowrap",
          borderTop: "1px solid rgba(255,255,255,.07)",
          marginTop: 8,
          paddingTop: 14,
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.color = "#EDEBFA"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.color = "#9A93B8"; }}
      >
        <span aria-hidden="true" style={{ width: 20, flexShrink: 0, textAlign: "center", font: "400 13px 'Space Mono', monospace" }}>⚙</span>
        {!isCollapsed && <span style={{ font: "500 13px 'Instrument Sans', sans-serif" }}>Settings</span>}
      </div>

      {/* Right-edge drag handle */}
      <div
        onMouseDown={startDrag}
        aria-hidden="true"
        style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 6, cursor: "ew-resize", zIndex: 5 }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(139,124,246,.25)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
      />
    </nav>
  );
}
