"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Map, { type MapRef } from "react-map-gl/maplibre";
import { DeckGL } from "@deck.gl/react";
import { GeoJsonLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import type { FeatureCollection, Feature, Polygon, MultiPolygon, GeoJsonProperties } from "geojson";
import type { Message, CityCluster } from "@/types";
import { buildCityClusters } from "@/types";
import "maplibre-gl/dist/maplibre-gl.css";

// CARTO dark matter — free, no API key required
const BASEMAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

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

function fitViewToMessages(messages: Message[]) {
  const coords = messages.filter((m) => m.lat != null && m.lon != null);
  if (coords.length === 0) {
    return { longitude: 0, latitude: 20, zoom: 2, pitch: 0, bearing: 0 };
  }
  const lats = coords.map((m) => m.lat as number);
  const lons = coords.map((m) => m.lon as number);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const centerLat = (minLat + maxLat) / 2;
  const centerLon = (minLon + maxLon) / 2;
  const spread = Math.max(maxLat - minLat, maxLon - minLon);
  const zoom = spread < 0.5 ? 10 : spread < 2 ? 8 : spread < 5 ? 6 : spread < 15 ? 5 : spread < 40 ? 4 : 2;
  return { longitude: centerLon, latitude: centerLat, zoom, pitch: 0, bearing: 0 };
}

function alphaForCount(count: number, max: number): number {
  if (max === 0 || count === 0) return 0.09;
  return 0.09 + Math.pow(count / max, 0.7) * 0.66;
}

export default function MapStage({ messages, showRegions, onToggleRegions }: Props) {
  const [geojson, setGeojson] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    fetch(REGION_GEOJSON_URL)
      .then((r) => r.json())
      .then(setGeojson)
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

  const initialViewState = useMemo(() => fitViewToMessages(messages), []);

  const layers = useMemo(() => {
    const out = [];

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
            const count = regionCounts[name] ?? 0;
            const a = alphaForCount(count, regionMax);
            return [139, 124, 246, Math.round(a * 255)];
          },
          getLineColor: [179, 168, 255, 140],
          lineWidthMinPixels: 1,
          updateTriggers: { getFillColor: [regionCounts, regionMax] },
          transitions: { getFillColor: 300 },
        })
      );
    }

    // City scatter — sized by message count
    out.push(
      new ScatterplotLayer<CityCluster>({
        id: "city-scatter",
        data: cityClusters,
        pickable: true,
        getPosition: (d) => [d.lon, d.lat, 0],
        // Radius in pixels via radiusUnits, fallback to meters otherwise
        getRadius: (d) => d.count > 0 ? 6 + Math.sqrt(d.count) * 2.6 : 4,
        radiusUnits: "pixels",
        getFillColor: [100, 184, 55, 230],
        getLineColor: [100, 184, 55, 72],
        lineWidthMinPixels: 0,
        stroked: true,
        getLineWidth: 4,
        updateTriggers: { getRadius: cityClusters },
      })
    );

    // City labels
    out.push(
      new TextLayer<CityCluster>({
        id: "city-labels",
        data: cityClusters.filter((d) => d.count > 0),
        getPosition: (d) => [d.lon, d.lat, 0],
        getText: (d) => `${d.city.toUpperCase()}\n${d.count} msgs`,
        getSize: 11,
        getColor: [237, 235, 250, 200],
        fontFamily: "'Space Mono', monospace",
        getTextAnchor: "start",
        getAlignmentBaseline: "center",
        getPixelOffset: [10, -10],
        updateTriggers: { getText: cityClusters },
      })
    );

    return out;
  }, [geojson, showRegions, cityClusters, regionCounts, regionMax]);

  const activeStyle = { color: "#EDEBFA", borderColor: "#8B7CF6" };
  const inactiveStyle = { color: "#9A93B8", borderColor: "#2B2745" };

  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
      {/* DeckGL manages its own canvas; Map provides the basemap underneath */}
      <DeckGL
        initialViewState={initialViewState}
        controller={true}          // full pan / zoom / tilt / rotate
        layers={layers}
        style={{ position: "absolute", top: "0", left: "0", right: "0", bottom: "0" }}
        getCursor={({ isDragging }) => isDragging ? "grabbing" : "grab"}
      >
        <Map
          mapStyle={BASEMAP_STYLE}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          attributionControl={false}
        />
      </DeckGL>

      {/* Layer toggles — pointer-events only on these pills */}
      <div style={{ position: "absolute", left: 20, top: 76, display: "flex", gap: 6, zIndex: 5, pointerEvents: "none" }}>
        <span style={{ pointerEvents: "auto", font: "400 10px 'Space Mono', monospace", letterSpacing: ".06em", color: "#EDEBFA", background: "rgba(18,16,30,.85)", border: "1px solid #8B7CF6", padding: "6px 9px", borderRadius: 5, backdropFilter: "blur(12px)" }}>
          POINTS
        </span>
        <span
          onClick={onToggleRegions}
          style={{ pointerEvents: "auto", font: "400 10px 'Space Mono', monospace", letterSpacing: ".06em", background: "rgba(18,16,30,.85)", padding: "6px 9px", borderRadius: 5, backdropFilter: "blur(12px)", cursor: "pointer", ...(showRegions ? activeStyle : inactiveStyle) }}
        >
          REGIONS
        </span>
      </div>

      {/* Legend */}
      {showRegions && (
        <div style={{ position: "absolute", left: 20, top: 114, zIndex: 5, background: "rgba(18,16,30,.85)", border: "1px solid #2B2745", borderRadius: 6, padding: "10px 12px", backdropFilter: "blur(12px)", font: "400 10px 'Space Mono', monospace", color: "#9A93B8", letterSpacing: ".04em", display: "flex", flexDirection: "column", gap: 6, pointerEvents: "none" }}>
          <span>MSGS / REGION</span>
          <div style={{ display: "flex", height: 8, width: 120, borderRadius: 2, overflow: "hidden" }}>
            {[0.08, 0.22, 0.38, 0.56, 0.75].map((a, i) => (
              <div key={i} style={{ flex: 1, background: `rgba(139,124,246,${a})` }} />
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>0</span>
            <span>{regionMax}</span>
          </div>
        </div>
      )}
    </div>
  );
}
