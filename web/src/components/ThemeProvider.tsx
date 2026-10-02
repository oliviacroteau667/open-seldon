"use client";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export type ThemeMode = "light" | "dark" | "auto";
export type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
}

export const THEME_STORAGE_KEY = "os-theme";
export const DEFAULT_THEME: ThemeMode = "dark";

const ThemeContext = createContext<ThemeContextValue>({ mode: DEFAULT_THEME, resolved: "dark", setMode: () => {} });

const systemTheme = (): ResolvedTheme =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

const isMode = (v: unknown): v is ThemeMode => v === "light" || v === "dark" || v === "auto";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(DEFAULT_THEME);
  const [resolved, setResolved] = useState<ResolvedTheme>("dark");

  // Pick up the stored preference after mount (the inline script in layout.tsx already applied it pre-paint)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (isMode(stored)) setModeState(stored);
    } catch { /* storage unavailable */ }
  }, []);

  useEffect(() => {
    const apply = () => {
      const r = mode === "auto" ? systemTheme() : mode;
      setResolved(r);
      document.documentElement.dataset.theme = r;
    };
    apply();
    if (mode !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [mode]);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    try { localStorage.setItem(THEME_STORAGE_KEY, m); } catch { /* storage unavailable */ }
  }, []);

  return <ThemeContext.Provider value={{ mode, resolved, setMode }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
