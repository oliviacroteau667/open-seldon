"use client";
import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { createLockup, createMark } from "@/lib/brand";
import { useTheme, type ThemeMode } from "./ThemeProvider";
import { GlobeIcon, NewspaperIcon, BellIcon } from "./icons";
import GlobeTeaser from "./GlobeTeaser";

export const APP_PATH = "/app";
const REPO_URL = "https://github.com/oliviacroteau667/open-seldon";
const SARAPIS_URL = "https://sarapis.org";
const CONTACT_MAILTO = "mailto:olivia@sarapis.org?subject=" + encodeURIComponent("Open Seldon for our organization");

const SANS = "'Instrument Sans', sans-serif";
const MONO = "'Space Mono', monospace";
const GRID = "repeating-linear-gradient(0deg, var(--grid-line) 0 1px, transparent 1px 40px), repeating-linear-gradient(90deg, var(--grid-line) 0 1px, transparent 1px 40px)";

const TAGLINE = "HUMANITARIAN OSINT, ON DEMAND.";
const PITCH = "Open Seldon is a data hub for humanitarian organizations. Open source intelligence is a goldmine that most humanitarian organizations simply don't have the resources to utilize to their fullest potential. We fill that gap by aggregating open UN datasets, public social media channels, and mission-specific data, to deliver you the clearest picture possible, so your team can focus on life-saving work. We do our work in the open and publish our base code, so you can make Open Seldon yours.";
const MISSION = "In crisis situations, humanitarian organizations rely on local, affected people for intelligence. Open Seldon leverages social media sentiment analysis of Telegram communities to democratize which voices are heard by transforming unstructured, multilingual public data into actionable humanitarian intelligence.";
const OWNERSHIP = "Open Seldon is created and owned by Olivia Croteau, and developed with the support of the Sarapis Foundation. It is free and open source: the code is public, and you are welcome to run it, study it, and build on it.";
const SARAPIS_SHORT ="Sarapis is a New York-incorporated 501(c)(3) nonprofit. We believe the technology public-interest work depends on shouldn't be rented from vendors or locked inside someone else's cloud — it should belong to the people and organizations it serves. So we work in the open with free/libre/open-source tools, and everything we make goes back to the commons.";
const SARAPIS_LONG = "Since 2010, Sarapis has helped nonprofits, community groups, and public agencies build technology they can actually own — free to run, study, share, and improve. In practice that's three kinds of work: delivering complete open-source solutions, facilitating the coalitions civic technology takes to build, and stewarding the open-source platforms the public sector relies on. Our projects span open government, human services, emergency management, and the collaborative economy — in New York City and across the global open-source movement.";

// ── Small pieces ───────────────────────────────────────────────────────────

function useScrollingPage() {
  useEffect(() => {
    document.documentElement.classList.add("lp");
    return () => document.documentElement.classList.remove("lp");
  }, []);
}

function BrandMark({ size = 22, pulse = false }: { size?: number; pulse?: boolean }) {
  const host = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!host.current) return;
    const mark = createMark(host.current, { width: size });
    if (pulse) mark.pulse();
    return () => mark.destroy();
  }, [size, pulse]);
  return <span ref={host} aria-hidden="true" style={{ display: "block", width: size, height: size }} />;
}

// Hero wordmark: plays the drop → revolve → reveal → pulse sequence once
function HeroLockup() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current) return;
    const width = window.innerWidth > 700 ? 420 : Math.min(300, window.innerWidth - 48);
    const c = createLockup(host.current, { width, revealed: false });
    c.start();
    let cancelled = false;
    const t = setTimeout(async () => {
      await c.finish();
      if (cancelled) return;
      await c.reveal();
      if (cancelled) return;
      c.pulse();
    }, 1200);
    return () => { cancelled = true; clearTimeout(t); c.destroy(); };
  }, []);
  return <div ref={host} aria-label="Open Seldon" role="img" style={{ display: "flex", justifyContent: "center" }} />;
}

function ThemeToggle() {
  const { mode, setMode } = useTheme();
  const next: Record<ThemeMode, ThemeMode> = { dark: "light", light: "auto", auto: "dark" };
  return (
    <button
      onClick={() => setMode(next[mode])}
      aria-label={`Theme: ${mode}. Switch to ${next[mode]}`}
      style={{ font: `400 10px ${MONO}`, letterSpacing: ".08em", color: "var(--text-3)", background: "transparent", border: "1px solid var(--line)", borderRadius: 5, padding: "6px 9px", cursor: "pointer" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-3)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--line)"; }}
    >
      {mode.toUpperCase()}
    </button>
  );
}

const btnBase: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 18px", borderRadius: 8,
  font: `600 13px ${SANS}`, textDecoration: "none", cursor: "pointer", border: "1px solid transparent",
  transition: "background .15s, border-color .15s, color .15s",
};
function PrimaryLink({ href, children, external }: { href: string; children: React.ReactNode; external?: boolean }) {
  const style: React.CSSProperties = { ...btnBase, background: "var(--accent)", color: "var(--on-accent)" };
  return external
    ? <a href={href} target="_blank" rel="noopener noreferrer" style={style}>{children}</a>
    : <Link href={href} style={style}>{children}</Link>;
}
function SecondaryLink({ href, children, external }: { href: string; children: React.ReactNode; external?: boolean }) {
  const style: React.CSSProperties = { ...btnBase, background: "transparent", color: "var(--text)", borderColor: "var(--line)" };
  const hover = (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.borderColor = "var(--accent)"; };
  const leave = (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.borderColor = "var(--line)"; };
  return external
    ? <a href={href} target="_blank" rel="noopener noreferrer" style={style} onMouseEnter={hover} onMouseLeave={leave}>{children}</a>
    : <Link href={href} style={style} onMouseEnter={hover} onMouseLeave={leave}>{children}</Link>;
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div style={{ font: `400 10px ${MONO}`, letterSpacing: ".16em", color: "var(--accent)", marginBottom: 12 }}>{children}</div>;
}
function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={{ font: `700 clamp(22px, 3vw, 30px)/1.2 ${SANS}`, letterSpacing: "-.015em", color: "var(--text)", margin: "0 0 14px" }}>{children}</h2>;
}
function Body({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return <p style={{ font: `400 15px/1.65 ${SANS}`, color: muted ? "var(--text-2)" : "var(--text)", margin: 0 }}>{children}</p>;
}

function Card({ icon, title, children }: { icon?: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 18px 20px", backdropFilter: "blur(20px)", display: "flex", flexDirection: "column", gap: 10 }}>
      {icon && <span style={{ color: "var(--accent)", display: "block" }}>{icon}</span>}
      <div style={{ font: `600 15px ${SANS}`, color: "var(--text)" }}>{title}</div>
      <p style={{ font: `400 13px/1.6 ${SANS}`, color: "var(--text-2)", margin: 0 }}>{children}</p>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

// authSlot is rendered by the server (it needs the session); Landing itself is a client component
export default function Landing({ authSlot }: { authSlot?: React.ReactNode }) {
  useScrollingPage();

  return (
    <div style={{ position: "relative", isolation: "isolate", background: "var(--bg)", color: "var(--text)", minHeight: "100vh" }}>
      {/* Fixed backdrop: colour orbs + grid stay put while the page content scrolls over them */}
      <div aria-hidden="true" style={{ position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: "12%", top: "4%", width: "52vmin", height: "52vmin", borderRadius: "50%", background: "var(--accent)", filter: "blur(16vmin)", opacity: .32 }} />
        <div style={{ position: "absolute", left: "60%", top: "42%", width: "40vmin", height: "40vmin", borderRadius: "50%", background: "var(--lime)", filter: "blur(16vmin)", opacity: .18 }} />
        <div style={{ position: "absolute", inset: 0, backgroundImage: GRID }} />
      </div>

      {/* Nav */}
      <header style={{ position: "sticky", top: 0, zIndex: 20, background: "var(--panel)", backdropFilter: "blur(20px)", borderBottom: "1px solid var(--border)" }}>
        <div className="lp-container" style={{ height: 56, display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none", color: "var(--text)" }}>
            <BrandMark size={22} />
            <span style={{ font: `700 14px ${SANS}`, letterSpacing: "-.01em" }}>Open Seldon</span>
          </Link>
          <nav className="lp-nav-links" aria-label="Site" style={{ gap: 18, marginLeft: 18 }}>
            {[["#what", "What it is"], ["#use-cases", "Use cases"], ["#sarapis", "Sarapis"], [REPO_URL, "Source"]].map(([href, label]) => (
              <a key={href} href={href} {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                style={{ font: `500 13px ${SANS}`, color: "var(--text-3)", textDecoration: "none" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-3)"; }}>
                {label}
              </a>
            ))}
          </nav>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <ThemeToggle />
            {authSlot}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section style={{ position: "relative" }}>
        <div className="lp-container" style={{ position: "relative", padding: "72px 16px 56px", textAlign: "center" }}>
          <HeroLockup />
          <div style={{ font: `400 clamp(11px, 1.6vw, 13px) ${MONO}`, letterSpacing: ".15em", color: "var(--text-3)", marginTop: 22 }}>{TAGLINE}</div>
          <p style={{ font: `400 clamp(15px, 1.9vw, 17px)/1.65 ${SANS}`, color: "var(--text-2)", maxWidth: 720, margin: "26px auto 0" }}>{PITCH}</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 30 }}>
            <PrimaryLink href={APP_PATH}>Open the live map →</PrimaryLink>
            <SecondaryLink href={REPO_URL} external>View the source</SecondaryLink>
          </div>
        </div>
      </section>

      {/* Live globe */}
      <section className="lp-section" style={{ paddingTop: 24 }}>
        <div className="lp-container">
          <Eyebrow>LIVE RIGHT NOW</Eyebrow>
          <H2>What the network is seeing today</H2>
          <Body muted>Current messages from the public Telegram channels we monitor, geocoded and tagged by humanitarian need. Drag the globe; open the full map to filter, read, and ask Seldon.</Body>
          <div style={{ height: 24 }} />
          <GlobeTeaser appPath={APP_PATH} />
        </div>
      </section>

      {/* What it is */}
      <section id="what" className="lp-section" style={{ borderTop: "1px solid var(--border-faint)" }}>
        <div className="lp-container">
          <Eyebrow>WHAT IT IS</Eyebrow>
          <H2>Open intelligence, assembled for the people doing the work</H2>
          <div style={{ height: 20 }} />
          <div className="lp-grid-3">
            <Card icon={<GlobeIcon size={20} />} title="Aggregate">
              Open UN datasets, public social media channels, and your mission-specific data, brought into one place instead of a dozen tabs.
            </Card>
            <Card icon={<NewspaperIcon size={20} />} title="Translate, geocode, categorize">
              Multilingual messages are translated, placed on the map, and tagged by need — housing, legal status, health, border crossings, safety and more.
            </Card>
            <Card icon={<BellIcon size={20} />} title="Ask Seldon">
              An analyst that answers questions about what's in view, cites the exact messages it drew on, and points to them on the map.
            </Card>
          </div>
        </div>
      </section>

      {/* Why Telegram */}
      <section className="lp-section" style={{ borderTop: "1px solid var(--border-faint)" }}>
        <div className="lp-container">
          <div className="lp-grid-2" style={{ alignItems: "start" }}>
            <div>
              <Eyebrow>WHOSE VOICES</Eyebrow>
              <H2>Intelligence from the people living the crisis</H2>
              <Body>{MISSION}</Body>
            </div>
            <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px", backdropFilter: "blur(20px)" }}>
              <div style={{ font: `400 10px ${MONO}`, letterSpacing: ".12em", color: "var(--text-3)", marginBottom: 12 }}>HOW A MESSAGE BECOMES INTELLIGENCE</div>
              {[
                ["01", "Collected", "Public channel posts are gathered, including reply threads."],
                ["02", "Translated", "Original language is kept; an English translation is added."],
                ["03", "Located", "Places in the text are recognised and geocoded to the map."],
                ["04", "Categorized", "Each message is tagged with the humanitarian needs it describes."],
                ["05", "Surfaced", "Filtered by place, time and need — or asked about through Seldon."],
              ].map(([n, t, d]) => (
                <div key={n} style={{ display: "grid", gridTemplateColumns: "28px 1fr", gap: 10, padding: "8px 0", borderTop: "1px solid var(--border-faint)" }}>
                  <span style={{ font: `400 10px ${MONO}`, color: "var(--accent)", paddingTop: 2 }}>{n}</span>
                  <div>
                    <div style={{ font: `600 13px ${SANS}`, color: "var(--text)" }}>{t}</div>
                    <div style={{ font: `400 12px/1.5 ${SANS}`, color: "var(--text-2)" }}>{d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section id="use-cases" className="lp-section" style={{ borderTop: "1px solid var(--border-faint)" }}>
        <div className="lp-container">
          <Eyebrow>USE CASES</Eyebrow>
          <H2>Built for field teams, analysts, and coordinators</H2>
          <div style={{ height: 20 }} />
          <div className="lp-grid-4">
            <Card title="Situational awareness">Watch what communities are reporting across a region, as it happens, in one view.</Card>
            <Card title="Needs assessment">See which needs are rising — housing, legal status, health, employment — by place and by week.</Card>
            <Card title="Border and movement">Track crossing conditions, queues and closures as people on the ground describe them.</Card>
            <Card title="Safety and protection">Spot safety incidents and threats early, with the original message one click away.</Card>
          </div>
        </div>
      </section>

      {/* Sarapis */}
      <section id="sarapis" className="lp-section" style={{ borderTop: "1px solid var(--border-faint)" }}>
        <div className="lp-container">
          <div className="lp-grid-2" style={{ alignItems: "start" }}>
            <div>
              <Eyebrow>WHO&apos;S BEHIND IT</Eyebrow>
              <H2>Built by Olivia Croteau, supported by the Sarapis Foundation</H2>
              <Body>{OWNERSHIP}</Body>
              <div style={{ marginTop: 20 }}>
                <SecondaryLink href={SARAPIS_URL} external>About Sarapis ↗</SecondaryLink>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Body>{SARAPIS_SHORT}</Body>
              <Body muted>{SARAPIS_LONG}</Body>
            </div>
          </div>
        </div>
      </section>

      {/* Get your own */}
      <section className="lp-section" style={{ borderTop: "1px solid var(--border-faint)" }}>
        <div className="lp-container">
          <div style={{ position: "relative", overflow: "hidden", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 16, padding: "clamp(28px, 5vw, 48px)", textAlign: "center", backdropFilter: "blur(20px)" }}>
            <div aria-hidden="true" style={{ position: "absolute", left: "50%", top: "-40%", width: "60vmin", height: "60vmin", transform: "translateX(-50%)", borderRadius: "50%", background: "var(--accent)", filter: "blur(14vmin)", opacity: .22, pointerEvents: "none" }} />
            <div style={{ position: "relative" }}>
              <Eyebrow>GET YOUR OWN</Eyebrow>
              <H2>Make Open Seldon yours</H2>
              <p style={{ font: `400 15px/1.65 ${SANS}`, color: "var(--text-2)", maxWidth: 640, margin: "0 auto" }}>
                Open Seldon is free and open source. Point it at the channels and datasets that matter to your mission, run it on your own infrastructure, or get in touch and we&apos;ll help you set it up.
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 26 }}>
                <PrimaryLink href={CONTACT_MAILTO} external>Talk to us</PrimaryLink>
                <SecondaryLink href={REPO_URL} external>Deploy from source ↗</SecondaryLink>
              </div>
              <div style={{ font: `400 11px ${MONO}`, color: "var(--text-4)", marginTop: 14 }}>olivia@sarapis.org</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid var(--border)", padding: "28px 0" }}>
        <div className="lp-container" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <BrandMark size={18} />
            <span style={{ font: `400 11px ${MONO}`, color: "var(--text-3)" }}>© {new Date().getFullYear()} Olivia Croteau · Supported by the Sarapis Foundation · Open source</span>
          </div>
          <nav aria-label="Footer" style={{ marginLeft: "auto", display: "flex", gap: 16, flexWrap: "wrap" }}>
            {[[APP_PATH, "Live map"], [REPO_URL, "GitHub"], [SARAPIS_URL, "Sarapis"], ["/design", "Design"]].map(([href, label]) => (
              <a key={href} href={href} {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})} style={{ font: `400 11px ${MONO}`, color: "var(--text-3)", textDecoration: "none" }}>
                {label}
              </a>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
