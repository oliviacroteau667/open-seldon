"use client";
import React, { useCallback, useRef, useState } from "react";

interface Options {
  defaultWidth: number;
  min: number;      // smallest width while open
  max: number;      // largest width while open (may change between renders)
  rail: number;     // width when collapsed
  grow: "right" | "left"; // which drag direction widens the panel
  initialCollapsed?: boolean;
}

export interface DragPanel {
  width: number;
  collapsed: boolean;
  dragging: boolean;
  startDrag: (e: React.MouseEvent) => void;
  setCollapsed: (c: boolean) => void;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// A resizable side panel that snaps to a collapsed rail when dragged below ~60% of its minimum.
export function useDragPanel(opts: Options): DragPanel {
  const [openWidth, setOpenWidth] = useState(opts.defaultWidth);
  const [collapsed, setCollapsed] = useState(opts.initialCollapsed ?? false);
  const [live, setLive] = useState<number | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const snapAt = opts.min * 0.6;

  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const { min, max, rail, grow } = optsRef.current;
    const dir = grow === "right" ? 1 : -1;
    const startX = e.clientX;
    const startW = collapsed ? rail : clamp(openWidth, min, max);
    const raw = (ev: MouseEvent) => startW + dir * (ev.clientX - startX);

    const onMove = (ev: MouseEvent) => setLive(raw(ev));
    const onUp = (ev: MouseEvent) => {
      const r = raw(ev);
      setLive(null);
      if (r < optsRef.current.min * 0.6) {
        setCollapsed(true);
      } else {
        setCollapsed(false);
        setOpenWidth(clamp(r, optsRef.current.min, optsRef.current.max));
      }
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [collapsed, openWidth]);

  const effectiveCollapsed = live !== null ? live < snapAt : collapsed;
  const width = effectiveCollapsed ? opts.rail : clamp(live ?? openWidth, opts.min, opts.max);

  return { width, collapsed: effectiveCollapsed, dragging: live !== null, startDrag, setCollapsed };
}
