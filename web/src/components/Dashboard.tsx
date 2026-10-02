"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { MapHighlight, Message, PlaceRef } from "@/types";
import { CATEGORIES, catKeysForMessage } from "@/types";
import { fetchDashboard } from "@/lib/api";
import { useWindowSize } from "@/hooks/useWindowSize";
import { useDragPanel } from "@/hooks/useDragPanel";
import Sidebar from "./Sidebar";
import DateSlider from "./DateSlider";
import CategoryBreakdown from "./CategoryBreakdown";
import MessageFeed from "./MessageFeed";
import AnalystChat from "./AnalystChat";

// No SSR — deck.gl and maplibre are browser-only
const MapStage = dynamic(() => import("./MapStage"), { ssr: false, loading: () => null });

function buildDayBuckets(messages: Message[], days: number): number[] {
  const now = Date.now();
  const buckets = new Array<number>(days).fill(0);
  for (const m of messages) {
    const age = Math.floor((now - new Date(m.timestamp).getTime()) / 86400000);
    const idx = days - 1 - age;
    if (idx >= 0 && idx < days) buckets[idx]++;
  }
  return buckets;
}

function dayLabel(idx: number, days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - (days - 1 - idx));
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).toUpperCase();
}

export default function Dashboard() {
  const { width } = useWindowSize();
  const isMobile = width < 640;
  const isSmall = width < 1100;

  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [channels, setChannels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cityFilter, setCityFilter] = useState<string | null>(null);
  const [regionFilter, setRegionFilter] = useState<string | null>(null);
  const [cityToRegion, setCityToRegion] = useState<Record<string, string>>({});
  const [channelsOn, setChannelsOn] = useState<Record<string, boolean>>({});
  const [range, setRange] = useState<[number, number] | null>(null);
  const [showRegions, setShowRegions] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [focusMessageId, setFocusMessageId] = useState<number | null>(null);

  // Seldon → map: highlighted places and fly-to target
  const [mapHighlight, setMapHighlight] = useState<MapHighlight | null>(null);
  const [flyTo, setFlyTo] = useState<{ longitude: number; latitude: number; zoom: number; key: number } | null>(null);
  const highlightCities = useMemo(() => new Set(mapHighlight?.cities ?? []), [mapHighlight]);
  const highlightRegions = useMemo(() => new Set(mapHighlight?.regions ?? []), [mapHighlight]);
  const flyToPlace = useCallback((p: PlaceRef) => {
    setFlyTo({ longitude: p.lon, latitude: p.lat, zoom: p.kind === "city" ? 7 : 5, key: Date.now() });
  }, []);

  // Three drag-collapsible panels: sidebar (left), messages + Seldon (right)
  const sidebar = useDragPanel({ defaultWidth: 236, min: 180, max: 360, rail: 56, grow: "right" });
  const feed = useDragPanel({ defaultWidth: 360, min: 260, max: 640, rail: 44, grow: "left" });
  const chat = useDragPanel({ defaultWidth: 360, min: 300, max: Math.max(300, Math.floor(width / 3)), rail: 44, grow: "left" });

  // Auto-collapse the sidebar and Seldon on small viewports
  const { setCollapsed: setSidebarCollapsed } = sidebar;
  const { setCollapsed: setChatCollapsed } = chat;
  useEffect(() => {
    setSidebarCollapsed(isSmall);
    setChatCollapsed(isSmall);
  }, [isSmall, setSidebarCollapsed, setChatCollapsed]);

  useEffect(() => {
    fetchDashboard()
      .then((data) => {
        setAllMessages(data.messages);
        setChannels(data.channels);
        setChannelsOn(Object.fromEntries(data.channels.map((c) => [c, true])));
        setLoading(false);
      })
      .catch((e) => {
        setError(String(e));
        setLoading(false);
      });
  }, []);

  // Compute day span dynamically from actual message dates
  const DAYS = useMemo(() => {
    if (allMessages.length === 0) return 30;
    const oldest = new Date(allMessages[allMessages.length - 1].timestamp).getTime();
    return Math.ceil((Date.now() - oldest) / 86400000) + 1;
  }, [allMessages]);

  const channelMessages = useMemo(
    () => allMessages.filter((m) => channelsOn[m.channel] !== false),
    [allMessages, channelsOn]
  );

  const messagesById = useMemo(() => new Map(allMessages.map((m) => [m.id, m])), [allMessages]);
  const resolveMessage = useCallback((id: number) => messagesById.get(id), [messagesById]);

  // Known places (lowercased name → coordinates) so Seldon's [@Place] tags can be located
  const placeIndex = useMemo(() => {
    const cities = new Map<string, PlaceRef>();
    const regions = new Map<string, PlaceRef>();
    for (const m of allMessages) {
      if (m.city && m.lat != null && m.lon != null && !cities.has(m.city.toLowerCase())) {
        cities.set(m.city.toLowerCase(), { kind: "city", name: m.city, lat: m.lat, lon: m.lon });
      }
      for (const loc of m.geocoded_locations ?? []) {
        const key = loc.name.toLowerCase();
        if (loc.type === "city" || loc.type == null) {
          if (!cities.has(key)) cities.set(key, { kind: "city", name: loc.name, lat: loc.lat, lon: loc.lon });
        } else if (!regions.has(key)) {
          regions.set(key, { kind: "region", name: loc.name, lat: loc.lat, lon: loc.lon });
        }
      }
    }
    return { cities, regions };
  }, [allMessages]);
  const resolvePlace = useCallback((name: string): PlaceRef | null => {
    const key = name.trim().toLowerCase();
    return placeIndex.cities.get(key) ?? placeIndex.regions.get(key) ?? null;
  }, [placeIndex]);

  const dayCounts = useMemo(() => buildDayBuckets(channelMessages, DAYS), [channelMessages]);

  // Default range: full span once DAYS is known
  const effectiveRange = range ?? [0, DAYS - 1];
  const [startIdx, endIdx] = effectiveRange;

  const inRange = useMemo(() => {
    const now = Date.now();
    return channelMessages.filter((m) => {
      const age = Math.floor((now - new Date(m.timestamp).getTime()) / 86400000);
      const idx = DAYS - 1 - age;
      return idx >= startIdx && idx <= endIdx;
    });
  }, [channelMessages, startIdx, endIdx]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of inRange) {
      for (const key of catKeysForMessage(m)) {
        counts[key] = (counts[key] ?? 0) + 1;
      }
    }
    return counts;
  }, [inRange]);

  // Previous window for trend calculation
  const prevWindowLen = endIdx - startIdx + 1;
  const prevStart = Math.max(0, startIdx - prevWindowLen);
  const prevInRange = useMemo(() => {
    const now = Date.now();
    return channelMessages.filter((m) => {
      const age = Math.floor((now - new Date(m.timestamp).getTime()) / 86400000);
      const idx = DAYS - 1 - age;
      return idx >= prevStart && idx < startIdx;
    });
  }, [channelMessages, prevStart, startIdx]);

  const prevCategoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of prevInRange) {
      for (const key of catKeysForMessage(m)) counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [prevInRange]);

  const displayedMessages = useMemo(() => {
    let msgs = inRange;
    if (categoryFilter) msgs = msgs.filter((m) => catKeysForMessage(m).includes(categoryFilter));
    if (cityFilter) msgs = msgs.filter((m) => m.city === cityFilter);
    if (regionFilter) msgs = msgs.filter((m) => {
      if (m.city && cityToRegion[m.city] === regionFilter) return true;
      return (m.geocoded_locations ?? []).some(
        (loc) => loc.type === "country" && loc.name === regionFilter
      );
    });
    return msgs;
  }, [inRange, categoryFilter, cityFilter, regionFilter, cityToRegion]);

  const channelCounts = useMemo(() => {
    const now = Date.now();
    const counts: Record<string, number> = {};
    for (const m of allMessages) {
      const age = Math.floor((now - new Date(m.timestamp).getTime()) / 86400000);
      const idx = DAYS - 1 - age;
      if (idx >= startIdx && idx <= endIdx) {
        counts[m.channel] = (counts[m.channel] ?? 0) + 1;
      }
    }
    return counts;
  }, [allMessages, startIdx, endIdx]);

  const labelCount = Object.values(categoryCounts).reduce((a, b) => a + b, 0);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0A0912", color: "#9A93B8", font: "400 11px 'Space Mono', monospace" }}>
        LOADING DATA…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0A0912", color: "#E8553E", font: "400 11px 'Space Mono', monospace" }}>
        ERROR: {error}
      </div>
    );
  }

  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100dvh", background: "#0A0912", overflow: "hidden", userSelect: "none" }}>
        {/* Compact top bar */}
        <div style={{ padding: "10px 12px", zIndex: 10 }}>
          <DateSlider
            dayCounts={dayCounts}
            range={effectiveRange}
            onRangeChange={setRange}
            days={DAYS}
            totalInRange={inRange.length}
            activeChannels={channels.filter((c) => channelsOn[c]).length}
            dayLabel={(i) => dayLabel(i, DAYS)}
          />
        </div>
        {/* Map: top half */}
        <div style={{ flex: "0 0 45vh", position: "relative" }}>
          <MapStage messages={inRange} showRegions={showRegions} onToggleRegions={() => setShowRegions((v) => !v)} selectedCity={cityFilter} onCityClick={setCityFilter} selectedRegion={regionFilter} onRegionClick={setRegionFilter} onCityRegionMap={setCityToRegion} />
        </div>
        {/* Scrollable messages below */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px", display: "flex", flexDirection: "column" }}>
          <MessageFeed
            messages={displayedMessages}
            categoryFilter={categoryFilter}
            onCategoryFilter={setCategoryFilter}
            total={inRange.length}
            cityFilter={cityFilter}
            onCityFilter={setCityFilter}
            regionFilter={regionFilter}
            onRegionFilter={setRegionFilter}
            inline
          />
        </div>
      </div>
    );
  }

  const sidebarW = sidebar.width;
  const leftPad = sidebarW + 20;
  const anyDragging = sidebar.dragging || feed.dragging || chat.dragging;
  const overlayTransition = anyDragging ? "none" : "left .2s, right .2s";

  return (
    <div style={{ width: "100%", height: "100vh", background: "#0A0912", overflow: "hidden", userSelect: "none", position: "relative" }}>
      <div style={{ position: "absolute", inset: 0 }}>
        {/* Top bar: always above the map */}
        <div style={{ position: "absolute", left: leftPad, right: 20, top: 16, display: "flex", alignItems: "center", zIndex: 10, pointerEvents: "none", transition: overlayTransition }}>
          <div style={{ flex: "0 1 480px", pointerEvents: "auto" }}>
            <DateSlider
              dayCounts={dayCounts}
              range={effectiveRange}
              onRangeChange={setRange}
              days={DAYS}
              totalInRange={inRange.length}
              activeChannels={channels.filter((c) => channelsOn[c]).length}
              dayLabel={(i) => dayLabel(i, DAYS)}
            />
          </div>
        </div>

        {/* Map fills the entire stage */}
        <MapStage
          messages={inRange}
          showRegions={showRegions}
          onToggleRegions={() => setShowRegions((v) => !v)}
          selectedCity={cityFilter}
          onCityClick={setCityFilter}
          selectedRegion={regionFilter}
          onRegionClick={setRegionFilter}
          onCityRegionMap={setCityToRegion}
          sidebarWidth={sidebarW}
          rightInset={feed.width + chat.width}
          highlightCities={highlightCities}
          highlightRegions={highlightRegions}
          flyTo={flyTo}
        />

        {/* Bottom-left overlay: category breakdown */}
        <div style={{ position: "absolute", left: leftPad, right: feed.width + chat.width + 20, bottom: 20, display: "flex", alignItems: "flex-end", gap: 16, zIndex: 10, pointerEvents: "none", transition: overlayTransition }}>
          <div style={{ pointerEvents: "auto", flex: "1 1 320px", maxWidth: 500, minWidth: 0 }}>
            <CategoryBreakdown
              categoryCounts={categoryCounts}
              prevCategoryCounts={prevCategoryCounts}
              labelCount={labelCount}
              total={inRange.length}
              categoryFilter={categoryFilter}
              onCategoryFilter={setCategoryFilter}
            />
          </div>
        </div>

        {/* Left sidebar: full-height overlay on top of the map */}
        <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, zIndex: 20 }}>
          <Sidebar
            width={sidebar.width}
            collapsed={sidebar.collapsed}
            dragging={sidebar.dragging}
            onHandleMouseDown={sidebar.startDrag}
            channels={channels}
            channelsOn={channelsOn}
            onToggleChannel={(ch) => setChannelsOn((prev) => ({ ...prev, [ch]: !prev[ch] }))}
            onToggleAll={() => {
              const allOn = channels.every((c) => channelsOn[c]);
              setChannelsOn(Object.fromEntries(channels.map((c) => [c, !allOn])));
            }}
            channelCounts={channelCounts}
          />
        </div>

        {/* Right panels: messages + Seldon, full-height overlays on top of the map */}
        <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, zIndex: 10, display: "flex", flexDirection: "row" }}>
          {/* Messages panel */}
          <div style={{
            width: feed.width,
            borderLeft: "1px solid rgba(255,255,255,.07)",
            background: "rgba(18,16,30,.68)",
            backdropFilter: "blur(20px)",
            display: "flex",
            flexDirection: "row",
            overflow: "hidden",
            transition: feed.dragging ? "none" : "width .2s",
          }}>
            <div
              onMouseDown={feed.startDrag}
              aria-hidden="true"
              style={{ width: 6, flexShrink: 0, cursor: "ew-resize", zIndex: 5 }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(139,124,246,.25)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
            />
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <MessageFeed
                messages={displayedMessages}
                allMessages={allMessages}
                categoryFilter={categoryFilter}
                onCategoryFilter={setCategoryFilter}
                total={inRange.length}
                cityFilter={cityFilter}
                onCityFilter={setCityFilter}
                regionFilter={regionFilter}
                onRegionFilter={setRegionFilter}
                focusMessageId={focusMessageId}
                onFocusConsumed={() => setFocusMessageId(null)}
                collapsed={feed.collapsed}
                onRailMouseDown={feed.startDrag}
                flush
              />
            </div>
          </div>

          {/* Seldon panel */}
          <div style={{
            width: chat.width,
            borderLeft: "1px solid rgba(255,255,255,.07)",
            background: "rgba(18,16,30,.68)",
            backdropFilter: "blur(20px)",
            display: "flex",
            flexDirection: "row",
            overflow: "hidden",
            transition: chat.dragging ? "none" : "width .2s",
          }}>
            <div
              onMouseDown={chat.startDrag}
              aria-hidden="true"
              style={{ width: 6, flexShrink: 0, cursor: "ew-resize", zIndex: 5 }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(139,124,246,.25)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
            />
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <AnalystChat
                contextIds={inRange.map((m) => m.id)}
                collapsed={chat.collapsed}
                onRailMouseDown={chat.startDrag}
                onCiteClick={setFocusMessageId}
                resolveMessage={resolveMessage}
                resolvePlace={resolvePlace}
                onHighlight={setMapHighlight}
                onFlyTo={flyToPlace}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

