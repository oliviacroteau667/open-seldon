"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { COLOR_TOKENS, CATEGORY_TOKENS, type TokenDoc } from "@/lib/tokens";
import { createLockup, createMark, type BrandController } from "@/lib/brand";
import { useTheme } from "./ThemeProvider";
import { MarkCheck } from "./MarkCheck";
import { SourceIcon } from "./SourceLink";
import { GlobeIcon, NewspaperIcon, BellIcon, GearIcon } from "./icons";

const SANS = "'Instrument Sans', sans-serif";
const MONO = "'Space Mono', monospace";

function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ padding: "40px 0", borderTop: "1px solid var(--border-faint)" }}>
      <h2 style={{ font: `700 22px ${SANS}`, letterSpacing: "-.01em", margin: "0 0 6px", color: "var(--text)" }}>{title}</h2>
      {intro && <p style={{ font: `400 13px/1.6 ${SANS}`, color: "var(--text-2)", margin: "0 0 20px", maxWidth: 680 }}>{intro}</p>}
      {children}
    </section>
  );
}

function Swatch({ value }: { value: string }) {
  return <span style={{ display: "inline-block", width: 28, height: 20, borderRadius: 4, background: value, border: "1px solid var(--line)", verticalAlign: "middle", backgroundImage: value.startsWith("rgba") ? undefined : undefined }} />;
}

function TokenTable({ rows }: { rows: TokenDoc[] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 640, font: `400 12px ${SANS}`, color: "var(--text)" }}>
        <thead>
          <tr style={{ font: `400 10px ${MONO}`, letterSpacing: ".1em", color: "var(--text-3)", textAlign: "left" }}>
            {["TOKEN", "DARK", "LIGHT", "USE"].map((h) => <th key={h} style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)", fontWeight: 400 }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.name} style={{ borderBottom: "1px solid var(--border-faint)" }}>
              <td style={{ padding: "8px 10px", font: `400 12px ${MONO}`, color: "var(--accent)" }}>{t.name}</td>
              <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}><span style={{ display: "inline-block", padding: 3, borderRadius: 5, background: "#0A0912" }}><Swatch value={t.dark} /></span> <code style={{ font: `400 11px ${MONO}`, color: "var(--text-2)" }}>{t.dark}</code></td>
              <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}><span style={{ display: "inline-block", padding: 3, borderRadius: 5, background: "#ECEAF3" }}><Swatch value={t.light} /></span> <code style={{ font: `400 11px ${MONO}`, color: "var(--text-2)" }}>{t.light}</code></td>
              <td style={{ padding: "8px 10px", color: "var(--text-2)" }}>{t.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MotionDemo({ kind }: { kind: "mark" | "lockup" }) {
  const host = useRef<HTMLDivElement>(null);
  const ctrl = useRef<BrandController | null>(null);
  const [state, setState] = useState("idle");
  useEffect(() => {
    if (!host.current) return;
    const c = kind === "mark" ? createMark(host.current, { width: 64 }) : createLockup(host.current, { width: 300 });
    ctrl.current = c;
    return () => c.destroy();
  }, [kind]);
  const btn = (label: string, fn: () => void) => (
    <button key={label} onClick={fn} style={{ font: `400 10px ${MONO}`, letterSpacing: ".06em", color: "var(--text-3)", background: "transparent", border: "1px solid var(--line)", borderRadius: 5, padding: "6px 9px", cursor: "pointer" }}>
      {label}
    </button>
  );
  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, backdropFilter: "blur(20px)", display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-start" }}>
      <div ref={host} style={{ minHeight: 64 }} />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {btn("START", () => { ctrl.current?.start(); setState("loading"); })}
        {btn("FINISH", () => { ctrl.current?.finish().then(() => setState("done")); })}
        {btn("PULSE", () => { ctrl.current?.pulse(); setState("pulse"); })}
        {btn("IDLE", () => { ctrl.current?.idle(); setState("idle"); })}
        <span style={{ font: `400 10px ${MONO}`, color: "var(--text-4)", alignSelf: "center" }}>state: {state}</span>
      </div>
    </div>
  );
}

export default function DesignReference() {
  const { mode, setMode, resolved } = useTheme();
  useEffect(() => {
    document.documentElement.classList.add("lp");
    return () => document.documentElement.classList.remove("lp");
  }, []);

  return (
    <div style={{ background: "var(--bg)", color: "var(--text)", minHeight: "100vh" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 20, background: "var(--panel)", backdropFilter: "blur(20px)", borderBottom: "1px solid var(--border)" }}>
        <div className="lp-container" style={{ height: 56, display: "flex", alignItems: "center", gap: 14 }}>
          <Link href="/" style={{ font: `700 14px ${SANS}`, color: "var(--text)", textDecoration: "none" }}>Open Seldon</Link>
          <span style={{ font: `400 10px ${MONO}`, letterSpacing: ".12em", color: "var(--text-3)" }}>DESIGN REFERENCE</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 4, padding: 3, borderRadius: 8, background: "var(--hover)", border: "1px solid var(--line)" }}>
            {(["light", "dark", "auto"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} style={{ font: `500 11px ${SANS}`, padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer", background: mode === m ? "var(--accent)" : "transparent", color: mode === m ? "var(--on-accent)" : "var(--text-3)" }}>
                {m[0].toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="lp-container" style={{ paddingTop: 36, paddingBottom: 80 }}>
        <h1 style={{ font: `700 30px ${SANS}`, letterSpacing: "-.02em", margin: "0 0 8px" }}>Design system</h1>
        <p style={{ font: `400 14px/1.6 ${SANS}`, color: "var(--text-2)", margin: 0, maxWidth: 680 }}>
          The tokens, type and brand pieces the dashboard and site are built from. Values live in <code style={{ font: `400 12px ${MONO}` }}>web/src/app/globals.css</code>; this page documents them and shows the current theme ({resolved}).
        </p>

        <Section id="colors" title="Colour tokens" intro="Every surface and text colour is a CSS variable with a dark and a light value. Components use var(--token) and never a literal.">
          <TokenTable rows={COLOR_TOKENS} />
        </Section>

        <Section id="categories" title="Category colours" intro="The eight humanitarian-need categories. The light set is darkened one step so 11px labels stay readable on light ground.">
          <TokenTable rows={CATEGORY_TOKENS} />
        </Section>

        <Section id="type" title="Typography" intro="Instrument Sans for UI and body text; Space Mono for labels, counts and anything uppercase with letter-spacing.">
          <div className="lp-grid-2">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ font: `700 30px/1.1 ${SANS}`, letterSpacing: "-.02em" }}>Instrument Sans 700 · 30px</div>
              <div style={{ font: `600 15px ${SANS}` }}>Instrument Sans 600 · 15px — card titles, panel headers at 13px</div>
              <div style={{ font: `400 13px/1.6 ${SANS}` }}>Instrument Sans 400 · 13px — message text and body copy at 15px on the site.</div>
              <div style={{ font: `400 12px ${SANS}`, color: "var(--text-2)" }}>Instrument Sans 400 · 12px — secondary rows (text-2)</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ font: `400 11px ${MONO}`, letterSpacing: ".06em" }}>SPACE MONO 400 · 11PX — COUNTS, TIMESTAMPS</div>
              <div style={{ font: `400 10px ${MONO}`, letterSpacing: ".12em", color: "var(--text-3)" }}>SPACE MONO 400 · 10PX · .12EM — SECTION LABELS (TEXT-3)</div>
              <div style={{ font: `700 11px ${MONO}`, color: "var(--accent)" }}>594 <span style={{ fontWeight: 400, color: "var(--text-3)" }}>MSGS</span></div>
              <div style={{ font: `700 9px/1 ${MONO}`, display: "inline-grid", placeItems: "center", width: 18, height: 16, borderRadius: 4, border: "1px solid var(--accent-outline)", background: "var(--accent-tint)", color: "var(--accent-soft)" }}>3</div>
            </div>
          </div>
        </Section>

        <Section id="brand" title="Brand" intro="The mark is two hands around a lime signal dot. The motion controller drops the dot and revolves the hands while loading, lifts it when done, and pulses when live.">
          <div className="lp-grid-2">
            <MotionDemo kind="lockup" />
            <MotionDemo kind="mark" />
          </div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 20, alignItems: "center" }}>
            {[["/brand/logo-primary-dark.svg", "#0A0912"], ["/brand/logo-primary-light.svg", "#ECEAF3"], ["/brand/mark-dark.svg", "#0A0912"], ["/brand/mark-light.svg", "#ECEAF3"]].map(([src, bg]) => (
              // eslint-disable-next-line @next/next/no-img-element
              <span key={src} style={{ display: "inline-flex", alignItems: "center", padding: 14, borderRadius: 10, background: bg, border: "1px solid var(--line)" }}><img src={src} alt="" height={28} style={{ height: 28, width: "auto" }} /></span>
            ))}
          </div>
        </Section>

        <Section id="icons" title="Icons" intro="Thin-stroke 16px line icons (1.5px) for navigation; source glyphs for external links; the mark checkbox for toggles.">
          <div style={{ display: "flex", gap: 22, flexWrap: "wrap", alignItems: "center", color: "var(--text)" }}>
            {[["Dashboard", <GlobeIcon key="g" size={18} />], ["Reports", <NewspaperIcon key="n" size={18} />], ["Alerts", <BellIcon key="b" size={18} />], ["Settings", <GearIcon key="s" size={18} />], ["Telegram", <SourceIcon key="t" kind="telegram" size={16} />], ["Reddit", <SourceIcon key="r" kind="reddit" size={16} />]].map(([label, icon]) => (
              <span key={String(label)} style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                {icon}
                <span style={{ font: `400 10px ${MONO}`, color: "var(--text-3)" }}>{label}</span>
              </span>
            ))}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              <MarkCheck checked size={18} /><MarkCheck checked={false} size={18} />
              <span style={{ font: `400 10px ${MONO}`, color: "var(--text-3)" }}>MarkCheck</span>
            </span>
          </div>
        </Section>

        <Section id="controls" title="Controls" intro="Pill buttons use Space Mono with .06em tracking; active state is a purple border with full text colour.">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ font: `400 10px ${MONO}`, letterSpacing: ".06em", color: "var(--text)", background: "var(--panel)", border: "1px solid var(--accent)", padding: "6px 9px", borderRadius: 5 }}>ACTIVE</span>
            <span style={{ font: `400 10px ${MONO}`, letterSpacing: ".06em", color: "var(--text-3)", background: "var(--panel)", border: "1px solid var(--line)", padding: "6px 9px", borderRadius: 5 }}>INACTIVE</span>
            <span style={{ font: `600 13px ${SANS}`, color: "var(--on-accent)", background: "var(--accent)", padding: "9px 16px", borderRadius: 8 }}>Primary</span>
            <span style={{ font: `600 13px ${SANS}`, color: "var(--text)", border: "1px solid var(--line)", padding: "9px 16px", borderRadius: 8 }}>Secondary</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 18, padding: "0 7px 0 5px", borderRadius: 999, border: "1px solid var(--accent-outline)", background: "var(--accent-tint)", color: "var(--text-2)", font: `500 11px/1 ${SANS}` }}><span style={{ font: `400 9px/1 ${MONO}`, color: "var(--accent)" }}>◎</span>Warsaw</span>
          </div>
        </Section>
      </main>
    </div>
  );
}
