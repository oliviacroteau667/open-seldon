"use client";
import React from "react";

interface Props {
  pointRight: boolean;
  onClick: (e: React.MouseEvent) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  ariaLabel?: string;
}

export function PanelToggle({ pointRight, onClick, onMouseDown, ariaLabel }: Props) {
  return (
    <button
      onClick={onClick}
      onMouseDown={onMouseDown}
      aria-label={ariaLabel ?? (pointRight ? "Expand" : "Collapse")}
      style={{
        width: 28,
        height: 28,
        flexShrink: 0,
        display: "grid",
        placeItems: "center",
        border: "1px solid #2B2745",
        borderRadius: 6,
        color: "#9A93B8",
        font: "400 12px 'Space Mono', monospace",
        cursor: "pointer",
        userSelect: "none",
        background: "transparent",
        padding: 0,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = "#EDEBFA";
        (e.currentTarget as HTMLButtonElement).style.borderColor = "#8B7CF6";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = "#9A93B8";
        (e.currentTarget as HTMLButtonElement).style.borderColor = "#2B2745";
      }}
    >
      {pointRight ? "›" : "‹"}
    </button>
  );
}
