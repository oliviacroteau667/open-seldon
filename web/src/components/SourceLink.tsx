"use client";
import React from "react";

export type SourceKind = "telegram" | "reddit";

// Every channel is Telegram today; swap this for a per-channel lookup when other sources land.
export function sourceForChannel(_channel: string): SourceKind {
  return "telegram";
}

export const sourceUrls: Record<SourceKind, { channel: (c: string) => string; message: (c: string, id: number) => string; name: string }> = {
  telegram: {
    name: "Telegram",
    channel: (c) => `https://t.me/${c}`,
    message: (c, id) => `https://t.me/${c}/${id}`,
  },
  reddit: {
    name: "Reddit",
    channel: (c) => `https://www.reddit.com/r/${c}/new/`,
    message: (c, id) => `https://www.reddit.com/r/${c}/comments/${id}`,
  },
};

export function SourceIcon({ kind, size = 12 }: { kind: SourceKind; size?: number }) {
  if (kind === "reddit") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
        <path d="M22 12.1a2.4 2.4 0 0 0-4.1-1.7 11.7 11.7 0 0 0-5.5-1.7l1-4.4 3.1.7a1.7 1.7 0 1 0 .2-1l-3.6-.8a.5.5 0 0 0-.6.4l-1.1 5.1a11.8 11.8 0 0 0-5.7 1.7 2.4 2.4 0 1 0-2.7 3.9 4.6 4.6 0 0 0 0 .7c0 3.6 4.1 6.5 9.2 6.5s9.2-2.9 9.2-6.5a4.6 4.6 0 0 0 0-.7 2.4 2.4 0 0 0 .6-2.2zM7 13.8a1.7 1.7 0 1 1 1.7 1.7A1.7 1.7 0 0 1 7 13.8zm9.7 4.6a6.3 6.3 0 0 1-4.7 1.3 6.3 6.3 0 0 1-4.7-1.3.5.5 0 0 1 .7-.7 5.4 5.4 0 0 0 4 1 5.4 5.4 0 0 0 4-1 .5.5 0 1 1 .7.7zm-.3-2.9a1.7 1.7 0 1 1 1.7-1.7 1.7 1.7 0 0 1-1.7 1.7z" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M21.6 3.2 2.5 10.6c-1.3.5-1.3 1.3-.2 1.6l4.8 1.5 1.9 5.8c.2.6.4.8.9.8s.7-.2 1-.5l2.3-2.3 4.8 3.6c.9.5 1.5.2 1.8-.8l3.2-15.3c.3-1.3-.5-1.9-1.4-1.6zM8.4 13.4 18.9 6.8c.5-.3.9-.1.6.2l-8.6 7.8-.3 3.6-2.2-5z" />
    </svg>
  );
}

interface LinkProps {
  kind: SourceKind;
  href: string;
  label: string;
  size?: number;
}

// External link to the source; stops propagation so it never triggers the row/card it sits in
export function SourceLink({ kind, href, label, size = 12 }: LinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: size + 8, height: size + 8, borderRadius: 4, color: "var(--text-3)", flexShrink: 0, transition: "color .15s, background .15s" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--accent)"; (e.currentTarget as HTMLAnchorElement).style.background = "var(--accent-tint)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-3)"; (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
    >
      <SourceIcon kind={kind} size={size} />
    </a>
  );
}
