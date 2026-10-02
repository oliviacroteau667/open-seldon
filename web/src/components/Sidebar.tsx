"use client";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTheme, type ThemeMode } from "./ThemeProvider";
import { MarkCheck } from "./MarkCheck";

const THEME_MODES: { key: ThemeMode; label: string }[] = [
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
  { key: "auto", label: "Auto" },
];

interface Props {
  width: number;
  collapsed: boolean;
  dragging: boolean;
  onHandleMouseDown: (e: React.MouseEvent) => void;
  channels: string[];
  channelsOn: Record<string, boolean>;
  onToggleChannel: (ch: string) => void;
  onToggleAll: () => void;
  channelCounts: Record<string, number>;
}

const PAGES = [
  { glyph: "DSH", label: "Dashboard", active: true, dot: false },
  { glyph: "MSG", label: "Messages", active: false, dot: false },
  { glyph: "RPT", label: "Reports", active: false, dot: false },
  { glyph: "ALR", label: "Alerts", active: false, dot: true },
];

function activateOnEnterSpace(fn: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); }
  };
}

export default function Sidebar({ width, collapsed: isCollapsed, dragging, onHandleMouseDown, channels, channelsOn, onToggleChannel, onToggleAll, channelCounts }: Props) {
  const allOn = channels.every((c) => channelsOn[c] !== false);
  const { mode, resolved, setMode } = useTheme();
  const brandSuffix = resolved === "light" ? "light" : "dark";

  // Settings popover (portalled: the nav's backdrop-filter would otherwise clip a fixed child)
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [popPos, setPopPos] = useState({ left: 0, bottom: 0 });
  const settingsRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const toggleSettings = () => {
    const r = settingsRef.current?.getBoundingClientRect();
    if (r) setPopPos({ left: isCollapsed ? r.right + 10 : r.left, bottom: window.innerHeight - r.bottom });
    setSettingsOpen((o) => !o);
  };
  useEffect(() => {
    if (!settingsOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!popRef.current?.contains(t) && !settingsRef.current?.contains(t)) setSettingsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSettingsOpen(false); };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
  }, [settingsOpen]);

  return (
    <nav
      aria-label="Main navigation"
      style={{
        width,
        flex: "none",
        background: "var(--panel)",
        backdropFilter: "blur(20px)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        padding: "14px 10px",
        gap: 2,
        transition: dragging ? "none" : "width .2s",
        overflow: "hidden",
        zIndex: 20,
        position: "relative",
        height: "100%",
      }}
    >
      {/* Header — brand lockup when open, mark alone on the collapsed rail */}
      <div style={{ display: "flex", alignItems: "center", padding: isCollapsed ? "4px 0 16px" : "4px 6px 18px", justifyContent: isCollapsed ? "center" : "flex-start", whiteSpace: "nowrap" }}>
        {isCollapsed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/brand/mark-${brandSuffix}.svg`} alt="Open Seldon" width={28} height={28} style={{ display: "block" }} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/brand/logo-primary-${brandSuffix}.svg`} alt="Open Seldon" height={28} style={{ display: "block", height: 28, width: "auto" }} />
        )}
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
            background: p.active ? "var(--accent-tint)" : "transparent",
            color: p.active ? "var(--text)" : "var(--text-3)",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => { if (!p.active) (e.currentTarget as HTMLDivElement).style.background = "var(--hover)"; }}
          onMouseLeave={(e) => { if (!p.active) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
        >
          <span aria-hidden="true" style={{ width: 20, flexShrink: 0, textAlign: "center", font: "700 10px 'Space Mono', monospace", letterSpacing: ".04em" }}>
            {p.glyph}
          </span>
          {!isCollapsed && <span style={{ font: "500 13px 'Instrument Sans', sans-serif", flex: 1 }}>{p.label}</span>}
          {!isCollapsed && p.dot && <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--negative)", flexShrink: 0 }} />}
        </div>
      ))}

      {/* Divider */}
      <div role="separator" style={{ height: 1, background: "var(--border)", margin: "12px 6px" }} />

      {/* Channels header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 8px 8px", whiteSpace: "nowrap" }}>
        {!isCollapsed && <span id="channels-label" style={{ font: "400 10px 'Space Mono', monospace", color: "var(--text-3)", letterSpacing: ".1em" }}>CHANNELS</span>}
        {!isCollapsed && (
          <button
            onClick={onToggleAll}
            onKeyDown={activateOnEnterSpace(onToggleAll)}
            aria-label={allOn ? "Deselect all channels" : "Select all channels"}
            style={{ font: "400 10px 'Space Mono', monospace", color: "var(--accent)", cursor: "pointer", background: "none", border: "none", padding: 0 }}
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
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "var(--hover)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
            >
              <span style={{ display: "grid", placeItems: "center", width: 20, flexShrink: 0 }}>
                <MarkCheck checked={on} size={18} />
              </span>
              {!isCollapsed && (
                <>
                  <span style={{ font: "400 12px 'Instrument Sans', sans-serif", color: on ? "var(--text)" : "var(--text-3)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", transition: "color .25s" }}>
                    {ch}
                  </span>
                  <span aria-hidden="true" style={{ font: "400 11px 'Space Mono', monospace", color: "var(--text-3)" }}>
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
        ref={settingsRef}
        role="button"
        tabIndex={0}
        aria-label="Settings"
        aria-expanded={settingsOpen}
        aria-haspopup="dialog"
        onClick={toggleSettings}
        onKeyDown={activateOnEnterSpace(toggleSettings)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: 8,
          borderRadius: 6,
          color: settingsOpen ? "var(--text)" : "var(--text-3)",
          cursor: "pointer",
          whiteSpace: "nowrap",
          borderTop: "1px solid var(--border)",
          marginTop: 8,
          paddingTop: 14,
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.color = "var(--text)"; }}
        onMouseLeave={(e) => { if (!settingsOpen) (e.currentTarget as HTMLDivElement).style.color = "var(--text-3)"; }}
      >
        <span aria-hidden="true" style={{ width: 20, flexShrink: 0, textAlign: "center", font: "400 13px 'Space Mono', monospace" }}>⚙</span>
        {!isCollapsed && <span style={{ font: "500 13px 'Instrument Sans', sans-serif" }}>Settings</span>}
      </div>

      {settingsOpen && typeof document !== "undefined" && createPortal(
        <div
          ref={popRef}
          role="dialog"
          aria-label="Settings"
          style={{
            position: "fixed",
            left: popPos.left,
            bottom: popPos.bottom,
            width: 232,
            zIndex: 60,
            background: "var(--panel-strong)",
            border: "1px solid var(--line)",
            borderRadius: 10,
            backdropFilter: "blur(20px)",
            boxShadow: "var(--shadow)",
            padding: "14px 14px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <span style={{ font: "400 10px 'Space Mono', monospace", letterSpacing: ".1em", color: "var(--text-3)" }}>SETTINGS</span>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ font: "500 13px 'Instrument Sans', sans-serif", color: "var(--text)" }}>Theme</span>
            <span style={{ font: "400 10px 'Space Mono', monospace", color: "var(--text-4)" }}>
              {mode === "auto" ? `SYSTEM · ${resolved.toUpperCase()}` : mode.toUpperCase()}
            </span>
          </div>
          <div role="radiogroup" aria-label="Theme" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 3, padding: 3, borderRadius: 8, background: "var(--hover)", border: "1px solid var(--line)" }}>
            {THEME_MODES.map((m) => {
              const active = mode === m.key;
              return (
                <button
                  key={m.key}
                  role="radio"
                  aria-checked={active}
                  onClick={() => setMode(m.key)}
                  style={{
                    font: "500 11px 'Instrument Sans', sans-serif",
                    padding: "6px 0",
                    borderRadius: 6,
                    border: "none",
                    cursor: "pointer",
                    background: active ? "var(--accent)" : "transparent",
                    color: active ? "var(--on-accent)" : "var(--text-3)",
                    transition: "background .15s, color .15s",
                  }}
                  onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = "var(--text)"; }}
                  onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = "var(--text-3)"; }}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}

      {/* Right-edge drag handle — drag inward to collapse, outward to expand */}
      <div
        onMouseDown={onHandleMouseDown}
        aria-hidden="true"
        style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: isCollapsed ? 10 : 6, cursor: "ew-resize", zIndex: 5 }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "var(--accent-tint-strong)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
      />
    </nav>
  );
}
