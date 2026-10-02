"use client";
import React, { useCallback, useRef } from "react";

interface Props {
  dayCounts: number[];
  range: [number, number];
  onRangeChange: (r: [number, number]) => void;
  days: number;
  totalInRange: number;
  activeChannels: number;
  dayLabel: (idx: number) => string;
}

export default function DateSlider({ dayCounts, range, onRangeChange, days, totalInRange, activeChannels, dayLabel }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragTarget = useRef<"start" | "end" | null>(null);
  const [startIdx, endIdx] = range;

  const max = Math.max(1, ...dayCounts);

  function idxFromClientX(x: number): number {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const frac = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
    return Math.round(frac * (days - 1));
  }

  function moveHandle(which: "start" | "end", i: number) {
    onRangeChange(
      which === "start"
        ? [Math.min(i, endIdx), endIdx]
        : [startIdx, Math.max(i, startIdx)]
    );
  }

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!dragTarget.current) return;
    moveHandle(dragTarget.current, idxFromClientX(e.clientX));
  }, [range, days]); // eslint-disable-line

  const onPointerUp = useCallback(() => {
    dragTarget.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  }, [onPointerMove]);

  function startDrag(e: React.PointerEvent, which: "start" | "end") {
    e.preventDefault();
    dragTarget.current = which;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  const rangeLeft = (startIdx / (days - 1)) * 100;
  const rangeRight = 100 - (endIdx / (days - 1)) * 100;

  return (
    <div style={{
      flex: 1,
      height: 44,
      display: "flex",
      alignItems: "center",
      gap: 14,
      padding: "0 16px",
      background: "var(--panel)",
      border: "1px solid var(--border)",
      borderRadius: 8,
      backdropFilter: "blur(20px)",
    }}>
      {/* Start label */}
      <span style={{ font: "400 11px 'Space Mono', monospace", color: "var(--text-3)", whiteSpace: "nowrap", width: 52 }}>
        {dayLabel(startIdx)}
      </span>

      {/* Track */}
      <div
        ref={trackRef}
        style={{ flex: 1, height: 32, position: "relative", display: "flex", alignItems: "flex-end", gap: 2, touchAction: "none" }}
      >
        {dayCounts.map((count, i) => {
          const inR = i >= startIdx && i <= endIdx;
          const h = Math.max(4, (count / max) * 100);
          return (
            <div
              key={i}
              onClick={() => moveHandle(Math.abs(i - startIdx) <= Math.abs(i - endIdx) ? "start" : "end", i)}
              title={`${dayLabel(i)} · ${count} msgs`}
              style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end", cursor: "pointer", borderRadius: 2 }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "var(--border-faint)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
            >
              <div style={{
                width: "100%",
                height: `${h}%`,
                minHeight: 2,
                background: inR ? "var(--accent-soft)" : "var(--line-strong)",
                borderRadius: "1px 1px 0 0",
                transition: "background .15s",
              }} />
            </div>
          );
        })}

        {/* Baseline */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: -1, height: 2, background: "var(--line)" }} />

        {/* Selected span */}
        <div style={{
          position: "absolute",
          left: `${rangeLeft}%`,
          right: `${rangeRight}%`,
          bottom: -1,
          height: 2,
          background: "var(--lime)",
        }} />

        {/* Start handle */}
        <div
          onPointerDown={(e) => startDrag(e, "start")}
          style={{
            position: "absolute",
            left: `${rangeLeft}%`,
            bottom: -8,
            width: 14,
            height: 14,
            marginLeft: -7,
            borderRadius: "50%",
            background: "var(--bg)",
            border: "2px solid var(--text)",
            cursor: "ew-resize",
            boxShadow: "0 0 0 3px var(--lime-glow)",
          }}
        />

        {/* End handle */}
        <div
          onPointerDown={(e) => startDrag(e, "end")}
          style={{
            position: "absolute",
            right: `${rangeRight}%`,
            bottom: -8,
            width: 14,
            height: 14,
            marginRight: -7,
            borderRadius: "50%",
            background: "var(--bg)",
            border: "2px solid var(--text)",
            cursor: "ew-resize",
            boxShadow: "0 0 0 3px var(--lime-glow)",
          }}
        />
      </div>

      {/* End label */}
      <span style={{ font: "400 11px 'Space Mono', monospace", color: "var(--text-3)", whiteSpace: "nowrap", width: 52, textAlign: "right" }}>
        {dayLabel(endIdx)}
      </span>

      <span style={{ width: 1, height: 20, background: "var(--line)" }} />

      <span style={{ font: "700 11px 'Space Mono', monospace", color: "var(--accent)", whiteSpace: "nowrap" }}>
        {totalInRange}{" "}
        <span style={{ fontWeight: 400, color: "var(--text-3)" }}>MSGS</span>
      </span>
    </div>
  );
}
