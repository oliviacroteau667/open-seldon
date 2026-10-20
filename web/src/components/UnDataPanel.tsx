"use client";
import React, { useEffect, useMemo, useState } from "react";
import type { ChoroplethChoice, LayersSummary, SummaryIndicator } from "@/types";
import { fetchLayersSummary } from "@/lib/api";

const SANS = "'Instrument Sans', sans-serif";
const MONO = "'Space Mono', monospace";

export const UN_COUNTRIES = ["UKR", "POL", "MDA", "ROU", "SVK", "HUN"];
const NAMES: Record<string, string> = { UKR: "Ukraine", POL: "Poland", MDA: "Moldova", ROU: "Romania", SVK: "Slovakia", HUN: "Hungary" };

function num(v: number | null): string {
  if (v == null) return "—";
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(v >= 1e5 ? 0 : 1) + "k";
  return v.toLocaleString("en-GB");
}

// Period dates are plain ISO days; format them in UTC or "2026-09-01" shows as August in the Americas
const fmtMonth = (d: string) => new Date(d).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
const fmtYear = (d: string) => String(new Date(d).getUTCFullYear());

function period(i: SummaryIndicator): string {
  return i.period_end ? `${fmtMonth(i.period_start)} – ${fmtMonth(i.period_end)}` : fmtMonth(i.period_start);
}

// Headline cards from HAPI indicators at admin0, per country, until boundaries make choropleths possible
function buildCards(iso3: string, s: LayersSummary) {
  const rows = s.indicators.filter((i) => i.iso3 === iso3);
  const by = (ind: string, pick?: (i: SummaryIndicator) => boolean) => rows.filter((i) => i.indicator === ind && (!pick || pick(i)));
  // `map` marks cards whose indicator exists per admin1 area and can be drawn as a choropleth
  const cards: { value: string; label: string; source: string; map?: { slug: string; indicator: string } }[] = [];

  const ipc = by("ipc_phase", (i) => i.extra_key.startsWith("3+") || i.value_text === "3+");
  if (ipc.length) cards.push({ value: num(ipc[0].value), label: "IPC phase 3+ population", source: `IPC via HDX HAPI · ${period(ipc[0])}` });

  const ref = (s.refugees ?? []).find((r) => r.iso3 === iso3);
  if (ref) {
    const year = fmtYear(ref.period_start);
    if (iso3 === "UKR") {
      if (ref.others_of_concern != null) cards.push({ value: num(ref.others_of_concern), label: "Others of concern to UNHCR (in country)", source: `UNHCR via HDX HAPI · ${year}` });
    } else {
      cards.push({ value: num(ref.total), label: "Refugees & asylum-seekers hosted", source: `UNHCR via HDX HAPI · ${year}` });
      if (ref.from_ukraine != null) cards.push({ value: num(ref.from_ukraine), label: "Of which from Ukraine", source: `UNHCR via HDX HAPI · ${year}` });
    }
  }

  const risk = by("inform_risk");
  if (risk.length) cards.push({ value: risk[0].value_text ?? num(risk[0].value), label: `INFORM risk${risk[0].extra?.global_rank ? ` · rank ${risk[0].extra.global_rank}` : ""}`, source: `INFORM (UNDP / JRC) via HDX HAPI · ${period(risk[0])}` });

  const conflict = by("conflict_events");
  if (conflict.length) {
    const total = conflict.reduce((a, i) => a + (i.value ?? 0), 0);
    const fat = conflict.reduce((a, i) => a + (Number(i.extra?.fatalities) || 0), 0);
    cards.push({ value: num(total), label: `Conflict events · ${fat ? `${num(fat)} fatalities` : period(conflict[0])}`, source: `ACLED via HDX HAPI · ${period(conflict[0])} · accessed ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}` }); // HAPI conflict rows are national for these countries, so no by-area option
  }

  const pres = (s.operational_presence ?? []).find((r) => r.iso3 === iso3);
  if (pres) cards.push({ value: num(pres.orgs), label: `Organisations present (3W) · ${pres.areas} areas`, source: `OCHA 3W via HDX HAPI · ${fmtYear(pres.period_start)}` });

  // Insecurity Insight monthly national counts (coordinates are censored for Ukraine, so counts not points)
  const month = (i: SummaryIndicator) => fmtMonth(i.period_start);
  const health = by("ii_health");
  const II = "Insecurity Insight via HDX · CC BY-SA";
  if (health.length) cards.push({ value: num(health[0].value), label: `Attacks on health care · ${month(health[0])}${health[0].extra?.killed ? ` · ${health[0].extra.killed} killed` : ""}`, source: II, map: { slug: "insecurity_insight", indicator: "ii_health" } });
  const explosive = by("ii_explosive");
  if (explosive.length) cards.push({ value: num(explosive[0].value), label: `Explosive weapon incidents · ${month(explosive[0])}`, source: II, map: { slug: "insecurity_insight", indicator: "ii_explosive" } });
  const edu = by("ii_education");
  if (edu.length) cards.push({ value: num(edu[0].value), label: `Attacks on education · ${month(edu[0])}`, source: II, map: { slug: "insecurity_insight", indicator: "ii_education" } });
  const aid = by("ii_aid");
  if (aid.length) cards.push({ value: num(aid[0].value), label: `Aid worker incidents · ${month(aid[0])}${aid[0].extra?.killed ? ` · ${aid[0].extra.killed} killed` : ""}`, source: II, map: { slug: "insecurity_insight", indicator: "ii_aid" } });

  const alerts = s.gdacs_last_30d.filter((a) => a.iso3 === iso3);
  if (alerts.length) {
    const n = alerts.reduce((a, r) => a + r.n, 0);
    const red = alerts.find((a) => a.alert_level === "red")?.n ?? 0;
    cards.push({ value: num(n), label: `GDACS alerts · 30 days${red ? ` · ${red} red` : ""}`, source: "GDACS" });
  }
  return cards;
}

interface Props {
  onClose: () => void;
  choropleth?: ChoroplethChoice | null;
  onChoropleth?: (choice: ChoroplethChoice | null) => void;
}

export default function UnDataPanel({ onClose, choropleth, onChoropleth }: Props) {
  const [summary, setSummary] = useState<LayersSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [iso3, setIso3] = useState("UKR");
  useEffect(() => {
    fetchLayersSummary(UN_COUNTRIES).then(setSummary).catch((e) => setError(String(e)));
  }, []);
  const cards = useMemo(() => (summary ? buildCards(iso3, summary) : []), [summary, iso3]);

  return (
    <div role="region" aria-label="UN data" style={{ background: "var(--panel-strong)", border: "1px solid var(--line)", borderRadius: 10, backdropFilter: "blur(20px)", boxShadow: "var(--shadow)", padding: "12px 14px 14px", width: 420, maxWidth: "calc(100vw - 40px)", color: "var(--text)", font: `400 12px ${SANS}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ font: `400 10px ${MONO}`, letterSpacing: ".12em", color: "var(--text-3)" }}>UN DATA · LATEST PERIODS</span>
        <button onClick={onClose} aria-label="Close" style={{ marginLeft: "auto", background: "none", border: 0, color: "var(--text-3)", cursor: "pointer", font: `400 16px ${SANS}`, lineHeight: 1, padding: 0 }}>×</button>
      </div>
      <div role="tablist" aria-label="Country" style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 10 }}>
        {UN_COUNTRIES.map((c) => (
          <button key={c} role="tab" aria-selected={c === iso3} onClick={() => setIso3(c)}
            style={{ font: `500 11px ${SANS}`, padding: "4px 9px", borderRadius: 999, cursor: "pointer", border: `1px solid ${c === iso3 ? "var(--accent)" : "var(--line)"}`, background: c === iso3 ? "var(--accent-tint)" : "transparent", color: c === iso3 ? "var(--text)" : "var(--text-3)" }}>
            {NAMES[c] ?? c}
          </button>
        ))}
      </div>
      {error && <div style={{ color: "var(--negative)", marginTop: 10 }}>Could not load UN data: {error}</div>}
      {!error && !summary && <div style={{ color: "var(--text-3)", marginTop: 10, font: `400 10px ${MONO}` }}>LOADING…</div>}
      {summary && cards.length === 0 && <div style={{ color: "var(--text-3)", marginTop: 10 }}>No indicators yet for {NAMES[iso3] ?? iso3}. The nightly HDX HAPI pull fills these in.</div>}
      {cards.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8, marginTop: 10 }}>
          {cards.map((c) => {
            const active = !!c.map && choropleth?.slug === c.map.slug && choropleth?.indicator === c.map.indicator && choropleth?.iso3 === iso3;
            return (
              <div key={c.label} style={{ background: "var(--card)", border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`, borderRadius: 8, padding: "9px 10px", minWidth: 0, display: "flex", flexDirection: "column" }}>
                <div style={{ font: `600 19px ${SANS}`, fontVariantNumeric: "tabular-nums" }}>{c.value}</div>
                <div style={{ font: `400 9px ${MONO}`, letterSpacing: ".08em", color: "var(--text-3)", textTransform: "uppercase", marginTop: 2 }}>{c.label}</div>
                <div style={{ font: `400 8.5px ${MONO}`, color: "var(--text-4)", marginTop: 6, lineHeight: 1.4, flex: 1 }}>{c.source}</div>
                {c.map && onChoropleth && (
                  <button
                    onClick={() => onChoropleth(active ? null : { ...c.map!, iso3, label: c.label.split(" · ")[0], source: c.source })}
                    aria-pressed={active}
                    style={{ marginTop: 7, alignSelf: "flex-start", font: `400 9px ${MONO}`, letterSpacing: ".08em", padding: "3px 7px", borderRadius: 4, cursor: "pointer", border: `1px solid ${active ? "var(--accent)" : "var(--line)"}`, background: active ? "var(--accent-tint)" : "transparent", color: active ? "var(--text)" : "var(--text-3)" }}
                  >
                    {active ? "ON MAP" : "SHOW BY AREA"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
