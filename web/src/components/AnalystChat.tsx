"use client";
import React, { useRef, useState } from "react";
import { streamChat } from "@/lib/api";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

interface Props {
  contextIds: number[];
}

export default function AnalystChat({ contextIds }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    setMessages((ms) => [...ms, { role: "user", text }]);
    setStreaming(true);

    // Add assistant placeholder
    setMessages((ms) => [...ms, { role: "assistant", text: "" }]);

    try {
      for await (const chunk of streamChat(text, contextIds.slice(0, 150))) {
        setMessages((ms) => {
          const copy = [...ms];
          copy[copy.length - 1] = { role: "assistant", text: copy[copy.length - 1].text + chunk };
          return copy;
        });
        // Scroll to bottom
        if (bodyRef.current) {
          bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
        }
      }
    } catch {
      setMessages((ms) => {
        const copy = [...ms];
        copy[copy.length - 1] = { role: "assistant", text: "Error reaching the API. Please try again." };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div style={{
      background: "rgba(18,16,30,.92)",
      border: "1px solid #8B7CF6",
      borderRadius: 10,
      backdropFilter: "blur(12px)",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      boxShadow: "0 20px 60px rgba(0,0,0,.5)",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #2B2745" }}>
        <span style={{ font: "600 13px 'Instrument Sans', sans-serif", color: "#EDEBFA", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#8B7CF6" }} />
          Analyst
        </span>
        <span
          onClick={() => setMinimized((v) => !v)}
          style={{ font: "400 11px 'Space Mono', monospace", color: "#9A93B8", cursor: "pointer" }}
        >
          {minimized ? "□" : "─"}
        </span>
      </div>

      {!minimized && (
        <>
          {/* Messages */}
          <div ref={bodyRef} style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10, maxHeight: 200, overflow: "auto" }}>
            {messages.length === 0 && (
              <div style={{ font: "400 12px/1.5 'Instrument Sans', sans-serif", color: "#9A93B8" }}>
                Ask about the {contextIds.length} messages currently in view.
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                font: `400 13px/1.${m.role === "user" ? "45" : "55"} 'Instrument Sans', sans-serif`,
                background: m.role === "user" ? "#8B7CF6" : "rgba(255,255,255,.04)",
                color: m.role === "user" ? "#0A0912" : "#EDEBFA",
                padding: "8px 12px",
                borderRadius: m.role === "user" ? "10px 10px 2px 10px" : "10px 10px 10px 2px",
                maxWidth: "85%",
              }}>
                {m.text || (streaming && i === messages.length - 1 ? "…" : "")}
              </div>
            ))}
          </div>

          {/* Input */}
          <div
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            style={{ margin: "0 12px 12px", padding: "9px 12px", border: "1px solid #2B2745", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center", background: "transparent" }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask about the filtered messages…"
              disabled={streaming}
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", font: "400 13px 'Instrument Sans', sans-serif", color: "#EDEBFA", "::placeholder": { color: "#9A93B8" } } as React.CSSProperties}
            />
            <span
              onClick={send}
              style={{ font: "400 13px 'Space Mono', monospace", color: streaming ? "#3A3555" : "#8B7CF6", cursor: streaming ? "default" : "pointer" }}
            >
              ↵
            </span>
          </div>
        </>
      )}
    </div>
  );
}
