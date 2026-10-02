"use client";
import React from "react";

// Brand checkbox indicator: the mark's two hands close around the signal dot when checked.
// Purely visual — the parent row supplies role="checkbox", aria-checked and the label.
export function MarkCheck({ checked, size = 20 }: { checked: boolean; size?: number }) {
  return (
    <svg className="os-mark-check" data-checked={checked} viewBox="0 0 20 20" aria-hidden="true" style={{ width: size, height: size }}>
      <path className="hand l" d="M3.82 9.49 A6.5 6.5 0 0 0 8.37 17.79" />
      <path className="hand r" d="M11.63 17.79 A6.5 6.5 0 0 0 16.18 9.49" />
      <circle className="dot" cx="10" cy="7.5" r="2.2" />
    </svg>
  );
}
