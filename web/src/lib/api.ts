import type { DashboardData, Layer, LayerEventsResponse, LayersSummary } from "@/types";

export async function fetchDashboard(): Promise<DashboardData> {
  const res = await fetch(`/api/dashboard`);
  if (!res.ok) throw new Error(`dashboard fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchLayers(): Promise<Layer[]> {
  const res = await fetch(`/api/layers`);
  if (!res.ok) throw new Error(`layers fetch failed: ${res.status}`);
  return (await res.json()).layers;
}

export async function fetchLayerEvents(slug: string, sinceDays = 90): Promise<LayerEventsResponse> {
  const since = new Date(Date.now() - sinceDays * 86400000).toISOString();
  const res = await fetch(`/api/layers/${encodeURIComponent(slug)}/events?since=${encodeURIComponent(since)}`);
  if (!res.ok) throw new Error(`layer ${slug} fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchLayersSummary(iso3: string[]): Promise<LayersSummary> {
  const res = await fetch(`/api/layers/summary?iso3=${encodeURIComponent(iso3.join(","))}`);
  if (!res.ok) throw new Error(`layers summary fetch failed: ${res.status}`);
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
