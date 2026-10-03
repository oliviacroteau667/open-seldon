"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { DeckGL } from "@deck.gl/react";
import { _GlobeView as GlobeView, LinearInterpolator, type GlobeViewState } from "@deck.gl/core";
import { BitmapLayer, GeoJsonLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import { TileLayer } from "@deck.gl/geo-layers";
import type { FeatureCollection, Feature, Polygon, MultiPolygon, GeoJsonProperties } from "geojson";
import { feature as topoFeature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Message, CityCluster } from "@/types";
import { buildCityClusters } from "@/types";
import { useTheme } from "./ThemeProvider";

// Esri World Gray Canvas raster tiles draped onto the globe — free with attribution, no API key.
// "Base" has no labels; "Reference" is the matching label layer, drawn above the choropleth.
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas";
const RASTER = {
  dark: { base: `${ESRI}/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`, labels: `${ESRI}/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}` },
  light: { base: `${ESRI}/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`, labels: `${ESRI}/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}` },
};
const RASTER_MAX_ZOOM = 16;

const GLOBE_VIEW = new GlobeView({ id: "globe", controller: true });

function rasterLayer(id: string, url: string, opacity = 1) {
  return new TileLayer({
    id,
    data: url,
    minZoom: 0,
    maxZoom: RASTER_MAX_ZOOM,
    tileSize: 256,
    opacity,
    renderSubLayers: (props) => {
      const [[west, south], [east, north]] = props.tile.boundingBox;
      return new BitmapLayer({
        ...props,
        data: undefined,
        image: props.data as ImageBitmap,
        bounds: [west, south, east, north],
      });
    },
  });
}

// World country boundaries — Natural Earth 10m via world-atlas TopoJSON (tracks the basemap borders closely)
const WORLD_TOPOJSON_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-10m.json";

const countryName = (f: Feature) =>
  String(f.properties?.["ADMIN"] ?? f.properties?.["NAME"] ?? f.properties?.["name"] ?? "");

// Region GeoJSON URL — override via NEXT_PUBLIC_REGION_GEOJSON_URL for other deployments.
// Default: Poland voivodeships (open data, ppatrzyk/polska-geojson)
const REGION_GEOJSON_URL =
  process.env.NEXT_PUBLIC_REGION_GEOJSON_URL ??
  "https://raw.githubusercontent.com/ppatrzyk/polska-geojson/master/województwa/województwa-medium.geojson";

// Name property key in the GeoJSON features.
// Override via NEXT_PUBLIC_REGION_NAME_PROP for other datasets.
const REGION_NAME_PROP =
  process.env.NEXT_PUBLIC_REGION_NAME_PROP ?? "name";

interface Props {
  messages: Message[];
  showRegions: boolean;
  onToggleRegions: () => void;
  selectedCity?: string | null;
  onCityClick?: (city: string | null) => void;
  selectedRegion?: string | null;
  onRegionClick?: (name: string | null) => void;
  onCityRegionMap?: (map: Record<string, string>) => void;
  sidebarWidth?: number;
  rightInset?: number; // width of panels covering the map's right edge
  highlightCities?: Set<string>;
  highlightRegions?: Set<string>;
  flyTo?: { longitude: number; latitude: number; zoom: number; key: number } | null;
}

// Ray-casting point-in-polygon (handles Polygon and MultiPolygon)
function pointInPolygon(lon: number, lat: number, feature: Feature<Polygon | MultiPolygon>): boolean {
  const coords = feature.geometry.type === "Polygon"
    ? [feature.geometry.coordinates]
    : feature.geometry.coordinates;

  for (const poly of coords) {
    if (ringContains(poly[0], lon, lat)) return true;
  }
  return false;
}

function ringContains(ring: number[][], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if (((yi > y) !== (yj > y)) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function computeRegionCounts(
  clusters: CityCluster[],
  geojson: FeatureCollection
): Record<string, number> {
  const counts: Record<string, number> = {};
  const features = geojson.features as Feature<Polygon | MultiPolygon, GeoJsonProperties>[];

  for (const cluster of clusters) {
    for (const feature of features) {
      if (!feature.geometry) continue;
      if (pointInPolygon(cluster.lon, cluster.lat, feature as Feature<Polygon | MultiPolygon>)) {
        const name = String(feature.properties?.[REGION_NAME_PROP] ?? "");
        if (name) counts[name] = (counts[name] ?? 0) + cluster.count;
        break;
      }
    }
  }
  return counts;
}

function computeCityToRegion(
  clusters: CityCluster[],
  geojson: FeatureCollection
): Record<string, string> {
  const map: Record<string, string> = {};
  const features = geojson.features as Feature<Polygon | MultiPolygon, GeoJsonProperties>[];
  for (const cluster of clusters) {
    for (const feature of features) {
      if (!feature.geometry) continue;
      if (pointInPolygon(cluster.lon, cluster.lat, feature as Feature<Polygon | MultiPolygon>)) {
        const name = String(feature.properties?.[REGION_NAME_PROP] ?? "");
        if (name) map[cluster.city] = name;
        break;
      }
    }
  }
  return map;
}

function computeCountryCounts(
  messages: Message[],
  geojson: FeatureCollection
): Record<string, number> {
  const counts: Record<string, number> = {};
  const features = geojson.features as Feature<Polygon | MultiPolygon, GeoJsonProperties>[];
  for (const m of messages) {
    for (const loc of m.geocoded_locations ?? []) {
      if (loc.type !== "country") continue;
      for (const feature of features) {
        if (!feature.geometry) continue;
        if (pointInPolygon(loc.lon, loc.lat, feature as Feature<Polygon | MultiPolygon>)) {
          const name = countryName(feature);
          if (name) counts[name] = (counts[name] ?? 0) + 1;
          break;
        }
      }
    }
  }
  return counts;
}

// Geocoded country name (lowercased) → Natural Earth ADMIN name, so highlights match the polygons
function computeCountryNameMap(
  messages: Message[],
  geojson: FeatureCollection
): Record<string, string> {
  const map: Record<string, string> = {};
  const features = geojson.features as Feature<Polygon | MultiPolygon, GeoJsonProperties>[];
  for (const m of messages) {
    for (const loc of m.geocoded_locations ?? []) {
      if (loc.type !== "country") continue;
      const key = loc.name.toLowerCase();
      if (map[key]) continue;
      for (const feature of features) {
        if (!feature.geometry) continue;
        if (pointInPolygon(loc.lon, loc.lat, feature as Feature<Polygon | MultiPolygon>)) {
          map[key] = countryName(feature);
          break;
        }
      }
    }
  }
  return map;
}

function fitViewToMessages(messages: Message[]) {
  const coords = messages.filter((m) => m.lat != null && m.lon != null);
  if (coords.length === 0) {
    return { longitude: 0, latitude: 20, zoom: 1.5 };
  }
  const lats = coords.map((m) => m.lat as number);
  const lons = coords.map((m) => m.lon as number);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const centerLat = (minLat + maxLat) / 2;
  const centerLon = (minLon + maxLon) / 2;
  const spread = Math.max(maxLat - minLat, maxLon - minLon);
  const zoom = spread < 0.5 ? 10 : spread < 2 ? 8 : spread < 5 ? 6 : spread < 15 ? 5 : spread < 40 ? 4 : 2;
  return { longitude: centerLon, latitude: centerLat, zoom };
}

function alphaForCount(count: number, max: number): number {
  if (max === 0 || count === 0) return 0.09;
  return 0.09 + Math.pow(count / max, 0.7) * 0.66;
}

export default function MapStage({ messages, showRegions, onToggleRegions, selectedCity, onCityClick, selectedRegion, onRegionClick, onCityRegionMap, sidebarWidth = 0, rightInset = 0, highlightCities, highlightRegions, flyTo }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isLight = useTheme().resolved === "light";
  const [geojson, setGeojson] = useState<FeatureCollection | null>(null);
  const [worldGeojson, setWorldGeojson] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    fetch(REGION_GEOJSON_URL).then((r) => r.json()).then(setGeojson).catch(console.warn);
    fetch(WORLD_TOPOJSON_URL)
      .then((r) => r.json())
      .then((topo: Topology) => setWorldGeojson(topoFeature(topo, topo.objects.countries as GeometryCollection) as FeatureCollection))
      .catch(console.warn);
  }, []);

  const cityClusters = useMemo(() => buildCityClusters(messages), [messages]);

  const regionCounts = useMemo(
    () => (geojson ? computeRegionCounts(cityClusters, geojson) : {}),
    [cityClusters, geojson]
  );

  const regionMax = useMemo(
    () => Math.max(1, ...Object.values(regionCounts)),
    [regionCounts]
  );

  const cityToRegion = useMemo(
    () => (geojson ? computeCityToRegion(cityClusters, geojson) : {}),
    [cityClusters, geojson]
  );

  useEffect(() => { onCityRegionMap?.(cityToRegion); }, [cityToRegion, onCityRegionMap]);

  const countryCounts = useMemo(
    () => (worldGeojson ? computeCountryCounts(messages, worldGeojson) : {}),
    [messages, worldGeojson]
  );

  const countryMax = useMemo(
    () => Math.max(1, ...Object.values(countryCounts)),
    [countryCounts]
  );

  const countryMaxDisplay = useMemo(
    () => Math.max(0, ...Object.values(countryCounts)),
    [countryCounts]
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialViewState = useMemo(() => fitViewToMessages(messages), []);
  const [viewState, setViewState] = useState<GlobeViewState>({ ...initialViewState, minZoom: 0.4, maxZoom: 14 });
  const zoom = viewState.zoom;

  useEffect(() => {
    if (!flyTo) return;
    // Shift the map centre so the target lands in the middle of the map area that
    // isn't covered by the sidebar or the right-hand panels.
    const fullW = containerRef.current?.clientWidth ?? 0;
    const visibleCenterX = sidebarWidth + (fullW - sidebarWidth - rightInset) / 2;
    const shiftPx = fullW / 2 - visibleCenterX;
    const degPerPx = 360 / (512 * Math.pow(2, flyTo.zoom));
    setViewState((v) => ({
      ...v,
      longitude: flyTo.longitude + shiftPx * degPerPx,
      latitude: flyTo.latitude,
      zoom: flyTo.zoom,
      transitionDuration: 1000,
      transitionEasing: (t: number) => 1 - Math.pow(1 - t, 3),
      transitionInterpolator: new LinearInterpolator({ transitionProps: ["longitude", "latitude", "zoom"] }),
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyTo]);

  const countryNameMap = useMemo(
    () => (worldGeojson ? computeCountryNameMap(messages, worldGeojson) : {}),
    [messages, worldGeojson]
  );

  const highlightedCountries = useMemo(() => {
    const s = new Set<string>();
    for (const n of highlightRegions ?? []) {
      s.add(n);
      const admin = countryNameMap[n.toLowerCase()];
      if (admin) s.add(admin);
    }
    return s;
  }, [highlightRegions, countryNameMap]);

  const hasCityHighlight = (highlightCities?.size ?? 0) > 0;

  // deck.gl needs numeric colours, so mirror the theme's accent / lime here
  const RGB = useMemo((): { accent: [number, number, number]; accentBright: [number, number, number]; lime: [number, number, number] } =>
    isLight
      ? { accent: [106, 91, 224], accentBright: [74, 59, 192], lime: [78, 154, 34] }
      : { accent: [139, 124, 246], accentBright: [179, 168, 255], lime: [100, 184, 55] },
  [isLight]);

  // Pulse clock only runs while a city is highlighted
  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    if (!hasCityHighlight) return;
    let raf = 0;
    const t0 = performance.now();
    const loop = (t: number) => { setPulse((t - t0) / 1000); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [hasCityHighlight]);

  const ringLayer = useMemo(() => {
    if (!hasCityHighlight) return null;
    const wave = (Math.sin(pulse * 4) + 1) / 2;
    return new ScatterplotLayer<CityCluster>({
      id: "city-highlight-ring",
      data: cityClusters.filter((d) => highlightCities!.has(d.city)),
      getPosition: (d) => [d.lon, d.lat, 0],
      radiusUnits: "pixels",
      getRadius: (d) => (d.count > 0 ? 3 + Math.sqrt(d.count) * 1.25 : 2.5) + 8 + wave * 7,
      filled: false,
      stroked: true,
      getLineColor: [...RGB.accentBright, Math.round(230 - wave * 150)],
      lineWidthMinPixels: 2,
      getLineWidth: 2,
      updateTriggers: { getRadius: [cityClusters, pulse], getLineColor: [pulse, RGB] },
    });
  }, [hasCityHighlight, highlightCities, cityClusters, pulse, RGB]);

  const layers = useMemo(() => {
    const out = [];

    // Raster basemap (no labels) draped on the globe; labels are added above the choropleth below
    const raster = isLight ? RASTER.light : RASTER.dark;
    out.push(rasterLayer("basemap", raster.base));

    // World country choropleth — toggled with regions
    if (showRegions && worldGeojson) {
      out.push(
        new GeoJsonLayer({
          id: "countries",
          data: worldGeojson,
          pickable: true,
          stroked: true,
          filled: true,
          getFillColor: (f: Feature) => {
            const name = countryName(f);
            if (highlightedCountries.has(name)) return [...RGB.accentBright, Math.round(0.5 * 255)];
            if (name === selectedRegion) return [...RGB.accentBright, Math.round(0.45 * 255)];
            const count = countryCounts[name] ?? 0;
            const a = count > 0 ? 0.06 + Math.pow(count / countryMax, 0.6) * 0.50 : 0;
            return [...RGB.accent, Math.round(a * 255)];
          },
          getLineColor: (f: Feature) => {
            const name = countryName(f);
            if (highlightedCountries.has(name)) return isLight ? [22, 18, 43, 200] : [237, 235, 250, 220];
            return isLight ? [120, 110, 150, 70] : [80, 70, 100, 50];
          },
          getLineWidth: (f: Feature) => {
            const name = countryName(f);
            return highlightedCountries.has(name) ? 2 : 0.5;
          },
          lineWidthUnits: "pixels",
          updateTriggers: {
            getFillColor: [countryCounts, countryMax, selectedRegion, highlightedCountries, RGB],
            getLineColor: [highlightedCountries, isLight],
            getLineWidth: highlightedCountries,
          },
          transitions: { getFillColor: 300 },
        })
      );
    }

    if (showRegions && geojson) {
      out.push(
        new GeoJsonLayer({
          id: "regions",
          data: geojson,
          pickable: true,
          stroked: true,
          filled: true,
          getFillColor: (f: Feature) => {
            const name = String(f.properties?.[REGION_NAME_PROP] ?? "");
            if (highlightRegions?.has(name)) return [...RGB.accentBright, Math.round(0.6 * 255)];
            if (name === selectedRegion) return [...RGB.accentBright, Math.round(0.55 * 255)];
            const count = regionCounts[name] ?? 0;
            const a = alphaForCount(count, regionMax);
            return [...RGB.accent, Math.round(a * 255)];
          },
          getLineColor: (f: Feature) => {
            const name = String(f.properties?.[REGION_NAME_PROP] ?? "");
            if (highlightRegions?.has(name)) return isLight ? [22, 18, 43, 200] : [237, 235, 250, 230];
            return [...RGB.accentBright, 140];
          },
          lineWidthMinPixels: 1,
          updateTriggers: { getFillColor: [regionCounts, regionMax, selectedRegion, highlightRegions, RGB], getLineColor: [highlightRegions, RGB] },
          transitions: { getFillColor: 300 },
        })
      );
    }

    // Basemap labels sit above the fills so place names stay legible through the choropleth
    out.push(rasterLayer("basemap-labels", raster.labels, isLight ? 0.9 : 0.8));

    // City "signal dots" — small solid lime dots with a soft glow, sized gently by message count
    const dotRadius = (d: CityCluster) => {
      const base = d.count > 0 ? 3 + Math.sqrt(d.count) * 1.25 : 2.5;
      return base + (selectedCity === d.city ? 2 : 0) + (highlightCities?.has(d.city) ? 1.5 : 0);
    };
    const dotColor = (d: CityCluster): [number, number, number] =>
      selectedCity === d.city ? [255, 200, 50]
      : highlightCities?.has(d.city) ? RGB.accentBright
      : RGB.lime;

    out.push(
      new ScatterplotLayer<CityCluster>({
        id: "city-glow",
        data: cityClusters,
        pickable: false,
        getPosition: (d) => [d.lon, d.lat, 0],
        radiusUnits: "pixels",
        getRadius: (d) => dotRadius(d) * 2.4,
        getFillColor: (d) => [...dotColor(d), isLight ? 38 : 55],
        stroked: false,
        updateTriggers: { getRadius: [cityClusters, selectedCity, highlightCities], getFillColor: [selectedCity, highlightCities, RGB, isLight] },
      })
    );
    out.push(
      new ScatterplotLayer<CityCluster>({
        id: "city-scatter",
        data: cityClusters,
        pickable: true,
        getPosition: (d) => [d.lon, d.lat, 0],
        radiusUnits: "pixels",
        getRadius: dotRadius,
        getFillColor: (d) => [...dotColor(d), 235],
        getLineColor: (d) =>
          highlightCities?.has(d.city) ? (isLight ? [22, 18, 43, 200] : [255, 255, 255, 220]) : [255, 255, 255, isLight ? 120 : 70],
        stroked: true,
        lineWidthUnits: "pixels",
        getLineWidth: 1,
        updateTriggers: {
          getRadius: [cityClusters, selectedCity, highlightCities],
          getFillColor: [selectedCity, highlightCities, RGB],
          getLineColor: [highlightCities, isLight],
        },
      })
    );

    // City labels — progressively show more as user zooms in
    const minCountForLabel = zoom < 4 ? 999 : zoom < 5 ? 15 : zoom < 6 ? 5 : zoom < 7 ? 2 : 1;
    out.push(
      new TextLayer<CityCluster>({
        id: "city-labels",
        data: cityClusters.filter((d) => d.count >= minCountForLabel),
        getPosition: (d) => [d.lon, d.lat, 0],
        getText: (d) => `${d.city.toUpperCase()}\n${d.count} msgs`,
        getSize: 11,
        getColor: isLight ? [22, 18, 43, 220] : [237, 235, 250, 200],
        fontFamily: "'Space Mono', monospace",
        getTextAnchor: "start",
        getAlignmentBaseline: "center",
        getPixelOffset: [10, -10],
        updateTriggers: { getText: cityClusters, data: [cityClusters, zoom], getColor: isLight },
      })
    );

    return out;
  }, [geojson, showRegions, cityClusters, regionCounts, regionMax, worldGeojson, countryCounts, countryMax, zoom, selectedRegion, selectedCity, highlightCities, highlightRegions, highlightedCountries, isLight, RGB]);

  const activeStyle = { color: "var(--text)", border: "1px solid var(--accent)" };
  const inactiveStyle = { color: "var(--text-3)", border: "1px solid var(--line)" };

  return (
    <div ref={containerRef} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} role="application" aria-label="Message map">
      {/* DeckGL manages its own canvas; Map provides the basemap underneath */}
      <DeckGL
        views={GLOBE_VIEW}
        viewState={viewState}
        layers={ringLayer ? [...layers, ringLayer] : layers}
        style={{ position: "absolute", top: "0", left: "0", right: "0", bottom: "0" }}
        onViewStateChange={({ viewState: vs }) => setViewState(vs as GlobeViewState)}
        getCursor={({ isDragging, isHovering }) => isDragging ? "grabbing" : isHovering ? "pointer" : "grab"}
        onClick={(info) => {
          if (info.layer?.id === "city-scatter") {
            const city = (info.object as CityCluster).city;
            onCityClick?.(selectedCity === city ? null : city);
            onRegionClick?.(null);
          } else if (info.layer?.id === "regions") {
            const name = String((info.object as Feature).properties?.[REGION_NAME_PROP] ?? "");
            if (name) { onRegionClick?.(selectedRegion === name ? null : name); onCityClick?.(null); }
          } else if (info.layer?.id === "countries") {
            const f = info.object as Feature;
            const name = countryName(f);
            if (name) { onRegionClick?.(selectedRegion === name ? null : name); onCityClick?.(null); }
          } else {
            onCityClick?.(null);
            onRegionClick?.(null);
          }
        }}
      />

      {/* Basemap attribution (Esri World Gray Canvas) */}
      <span aria-label="Map attribution" style={{ position: "absolute", top: 80, right: rightInset + 20, zIndex: 5, pointerEvents: "none", font: "400 9px 'Space Mono', monospace", letterSpacing: ".04em", color: "var(--text-4)" }}>
        Tiles © Esri · © OpenStreetMap contributors
      </span>

      {/* Screen-fixed grid, same texture as the launch screen */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          pointerEvents: "none",
          backgroundImage:
            "repeating-linear-gradient(0deg, var(--grid-line) 0 1px, transparent 1px 40px), repeating-linear-gradient(90deg, var(--grid-line) 0 1px, transparent 1px 40px)",
        }}
      />

      {/* Layer toggles — pointer-events only on these pills */}
      <div style={{ position: "absolute", left: sidebarWidth + 20, top: 76, display: "flex", gap: 6, zIndex: 5, pointerEvents: "none", transition: "left .2s" }}>
        <span aria-hidden="true" style={{ pointerEvents: "none", font: "400 10px 'Space Mono', monospace", letterSpacing: ".06em", color: "var(--text)", background: "var(--panel)", border: "1px solid var(--accent)", padding: "6px 9px", borderRadius: 5, backdropFilter: "blur(20px)" }}>
          POINTS
        </span>
        <button
          onClick={onToggleRegions}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggleRegions(); } }}
          aria-pressed={showRegions}
          aria-label="Toggle regions layer"
          style={{ pointerEvents: "auto", font: "400 10px 'Space Mono', monospace", letterSpacing: ".06em", background: "var(--panel)", padding: "6px 9px", borderRadius: 5, backdropFilter: "blur(20px)", cursor: "pointer", ...(showRegions ? activeStyle : inactiveStyle) }}
        >
          REGIONS
        </button>
      </div>

      {/* Legend */}
      {showRegions && (
        <div aria-label={`Legend: messages per country, max ${countryMaxDisplay}`} style={{ position: "absolute", left: sidebarWidth + 20, top: 114, zIndex: 5, transition: "left .2s", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 6, padding: "10px 12px", backdropFilter: "blur(20px)", font: "400 10px 'Space Mono', monospace", color: "var(--text-3)", letterSpacing: ".04em", display: "flex", flexDirection: "column", gap: 6, pointerEvents: "none" }}>
          <span>MSGS / REGION</span>
          <div style={{ display: "flex", height: 8, width: 120, borderRadius: 2, overflow: "hidden" }}>
            {[0.08, 0.22, 0.38, 0.56, 0.75].map((a, i) => (
              <div key={i} style={{ flex: 1, background: `rgba(${RGB.accent.join(",")},${a})` }} />
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>0</span>
            <span>{countryMaxDisplay}</span>
          </div>
        </div>
      )}
    </div>
  );
}
