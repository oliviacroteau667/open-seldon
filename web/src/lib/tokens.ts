// Documentation copy of the theme tokens defined in app/globals.css (that file is the source of truth).
export interface TokenDoc { name: string; dark: string; light: string; note: string }

export const COLOR_TOKENS: TokenDoc[] = [
  { name: "--bg", dark: "#0A0912", light: "#ECEAF3", note: "Page background" },
  { name: "--panel", dark: "rgba(22,19,38,.6)", light: "rgba(224,220,238,.5)", note: "Glass panels (with backdrop blur)" },
  { name: "--panel-strong", dark: "rgba(22,19,38,.86)", light: "rgba(224,220,238,.82)", note: "Popovers, elevated panels" },
  { name: "--card", dark: "rgba(30,27,48,.82)", light: "rgba(244,242,251,.82)", note: "Message cards on a panel" },
  { name: "--border", dark: "#221F33", light: "#D3CFE3", note: "Panel borders" },
  { name: "--border-faint", dark: "rgba(255,255,255,.05)", light: "rgba(20,18,42,.05)", note: "Hairline dividers" },
  { name: "--line", dark: "#2B2745", light: "#CFCBE0", note: "Control borders" },
  { name: "--line-strong", dark: "#3A3555", light: "#BDB8D4", note: "Stronger dividers, inactive bars" },
  { name: "--hover", dark: "rgba(255,255,255,.04)", light: "rgba(20,18,42,.04)", note: "Row hover" },
  { name: "--surface-faint", dark: "rgba(255,255,255,.03)", light: "rgba(20,18,42,.03)", note: "Composer fill" },
  { name: "--text", dark: "#EDEBFA", light: "#14122A", note: "Primary text" },
  { name: "--text-bright", dark: "#FFFFFF", light: "#0A0912", note: "Emphasis" },
  { name: "--text-2", dark: "#C9C4E4", light: "#3A355A", note: "Secondary text" },
  { name: "--text-3", dark: "#9A93B8", light: "#5E5880", note: "Mono labels, muted text" },
  { name: "--text-4", dark: "#5E5880", light: "#8A84A8", note: "Faint text, checkbox off" },
  { name: "--accent", dark: "#8B7CF6", light: "#6A5BE0", note: "Brand purple" },
  { name: "--accent-soft", dark: "#B3A8FF", light: "#4A3BC0", note: "In-range bars, citation chips" },
  { name: "--accent-tint", dark: "rgba(139,124,246,.14)", light: "rgba(106,91,224,.14)", note: "Active row fill" },
  { name: "--accent-tint-strong", dark: "rgba(139,124,246,.28)", light: "rgba(106,91,224,.28)", note: "Drag handles, chip hover" },
  { name: "--accent-outline", dark: "rgba(139,124,246,.5)", light: "rgba(106,91,224,.5)", note: "Active outlines" },
  { name: "--on-accent", dark: "#0A0912", light: "#FAF9FD", note: "Text on the accent fill" },
  { name: "--lime", dark: "#64B837", light: "#4E9A22", note: "Signal dot, positive trend" },
  { name: "--lime-glow", dark: "rgba(100,184,55,.5)", light: "rgba(78,154,34,.5)", note: "Slider handle ring" },
  { name: "--negative", dark: "#E8553E", light: "#D6452F", note: "Alert dot, trend down" },
  { name: "--warn", dark: "#F5A524", light: "#C9810A", note: "CLEAR actions" },
  { name: "--grid-line", dark: "rgba(255,255,255,.035)", light: "rgba(20,18,42,.06)", note: "Map / launch grid" },
];

export const CATEGORY_TOKENS: TokenDoc[] = [
  { name: "--cat-housing", dark: "#E8553E", light: "#D6452F", note: "Accommodation / Housing" },
  { name: "--cat-legal", dark: "#4F8CFF", light: "#3B74E6", note: "Legal Status / Documentation" },
  { name: "--cat-employment", dark: "#22C1B0", light: "#159C8E", note: "Employment" },
  { name: "--cat-language", dark: "#F5A524", light: "#C9810A", note: "Polish Language Proficiency" },
  { name: "--cat-education", dark: "#8B7CF6", light: "#6A5BE0", note: "Education" },
  { name: "--cat-health", dark: "#5FD068", light: "#3E9A47", note: "Health / Mental Health" },
  { name: "--cat-border", dark: "#38BDF8", light: "#1A96CF", note: "Border Crossing" },
  { name: "--cat-safety", dark: "#F472B6", light: "#DB4B9A", note: "Safety / Security" },
];
