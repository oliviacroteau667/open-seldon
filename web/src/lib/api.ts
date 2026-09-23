import type { DashboardData } from "@/types";

export async function fetchDashboard(): Promise<DashboardData> {
  const res = await fetch(`/api/dashboard`);
  if (!res.ok) throw new Error(`dashboard fetch failed: ${res.status}`);
  return res.json();
}

export async function* streamChat(
  message: string,
  contextIds: number[]
): AsyncGenerator<string> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, context_ids: contextIds }),
  });
  if (!res.ok || !res.body) throw new Error("chat request failed");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    yield decoder.decode(value, { stream: true });
  }
}

export async function* streamSummary(): AsyncGenerator<string> {
  const res = await fetch("/api/summary");
  if (!res.ok || !res.body) throw new Error("summary request failed");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    yield decoder.decode(value, { stream: true });
  }
}
