"use client";
import React from "react";
import type { Layer, LayerEvent } from "@/types";

const SANS = "'Instrument Sans', sans-serif";
const MONO = "'Space Mono', monospace";

const ALERT_COLOR: Record<string, string> = { red: "var(--negative)", orange: "var(--warn)", green: "var(--cat-health)" };

function fmt(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Detail for one external event: title, level, date, a provenance line and a link out. No third-party full text.
export default function LayerDetailCard({ event, layer, onClose }: { event: LayerEvent; layer: Layer | undefined; onClose: () => void }) {
  const alert = event.alert_level?.toLowerCase() ?? null;
  const figure = typeof event.metrics?.["figure"] === "number" ? (event.metrics["figure"] as number).toLocaleString("en-GB") : null;
  return (
    <div role="dialog" aria-label={event.title} style={{ background: "var(--panel-strong)", border: "1px solid var(--line)", borderRadius: 10, backdropFilter: "blur(20px)", boxShadow: "var(--shadow)", padding: "12px 14px", width: 300, maxWidth: "calc(100vw - 40px)", color: "var(--text)", font: `400 12px/1.5 ${SANS}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        {alert && <span aria-label={`${alert} alert`} style={{ marginTop: 5, width: 9, height: 9, borderRadius: 2, transform: "rotate(45deg)", background: ALERT_COLOR[alert] ?? "var(--text-3)", flex: "none" }} />}
        <div style={{ font: `600 13.5px/1.3 ${SANS}`, flex: 1, minWidth: 0 }}>{event.title}</div>
        <button onClick={onClose} aria-label="Close" style={{ background: "none", border: 0, color: "var(--text-3)", cursor: "pointer", font: `400 16px ${SANS}`, lineHeight: 1, padding: 0 }}>×</button>
      </div>
      <div style={{ color: "var(--text-2)", marginTop: 6 }}>
        {alert && <span style={{ textTransform: "capitalize" }}>{alert} alert · </span>}
        {fmt(event.occurred_at)}
        {event.iso3 && <span> · {event.iso3}</span>}
        {event.severity && <div style={{ color: "var(--text-3)" }}>{event.severity}</div>}
        {figure && <div style={{ color: "var(--text-3)" }}>{figure} people</div>}
      </div>
      {event.summary && <div style={{ color: "var(--text-3)", marginTop: 6, maxHeight: 96, overflow: "hidden" }}>{event.summary}</div>}
      <div style={{ font: `400 9px ${MONO}`, letterSpacing: ".06em", color: "var(--text-3)", marginTop: 10, textTransform: "uppercase" }}>
        Source: {layer?.attribution_text ?? event.source_record_id}{event.reported_at ? ` · updated ${fmt(event.reported_at)}` : ""}
      </div>
      {event.url && (
        <a href={event.url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 8, color: "var(--accent)", font: `500 12px ${SANS}`, textDecoration: "none" }}>
          Open at {layer?.provider ?? "source"} ↗
        </a>
      )}
    </div>
  );
}
