export interface GeocodedLocation {
  name: string;
  lat: number;
  lon: number;
  type?: "city" | "country" | "region";
}

export interface Message {
  id: number;
  timestamp: string; // ISO
  channel: string;
  city: string | null;
  lat: number | null;
  lon: number | null;
  categories: string[];
  text_translated: string | null;
  text_original: string | null;
  lang: string | null;
  geocoded_locations: GeocodedLocation[];
  reply_to_id: number | null;
}

export interface DashboardData {
  messages: Message[];
  channels: string[];
}

// External open-data layers (docs/open-data-integration.md)
export interface Layer {
  slug: string;
  name: string;
  provider: string;
  kind: "points" | "areas" | "documents" | "boundaries";
  licence_id: string;
  attribution_text: string;
  homepage: string | null;
  default_on: boolean;
  cadence: "daily" | "weekly";
  countries: string[] | null;
  record_count: number;
  last_success_at: string | null;
  last_error: string | null;
}

export interface LayerEvent {
  id: number;
  source_record_id: string;
  event_type: string | null;
  category: string | null;
  title: string;
  summary: string | null;
  url: string | null;
  occurred_at: string;
  reported_at: string | null;
  lat: number | null;
  lon: number | null;
  precision: string | null;
  iso3: string | null;
  severity: string | null;
  alert_level: string | null;
  metrics: Record<string, unknown>;
}

export interface LayerEventsResponse {
  layer: Pick<Layer, "slug" | "name" | "attribution_text" | "licence_id" | "last_success_at">;
  events: LayerEvent[];
}

// One admin area's value for an indicator, joined to its COD-AB boundary when loaded
export interface LayerArea {
  pcode: string;
  iso3: string;
  admin_level: number;
  area_name: string | null;
  admin_name: string | null;
  period_start: string | null; // null when the boundary has no value at the response's period
  period_end: string | null;
  value: number | null;
  value_text: string | null;
  extra: Record<string, unknown>;
  extra_key: string;
  centroid_lat: number | null;
  centroid_lon: number | null;
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown } | null;
}

export interface LayerAreasResponse {
  layer: Pick<Layer, "slug" | "name" | "attribution_text" | "licence_id" | "last_success_at">;
  indicator: string;
  period: string | null; // the single period every area is reported at (boundary-driven responses)
  areas: LayerArea[];
}

// A choropleth the user asked for from a UN data card
export interface ChoroplethChoice {
  slug: string;
  indicator: string;
  iso3: string;
  label: string;
  source: string;
}

export interface SummaryIndicator {
  iso3: string;
  indicator: string;
  extra_key: string;
  period_start: string;
  period_end: string | null;
  value: number | null;
  value_text: string | null;
  extra: Record<string, unknown>;
  attribution_text: string;
}

export interface LayersSummary {
  countries: string[];
  indicators: SummaryIndicator[];
  refugees: { iso3: string; period_start: string; total: number | null; from_ukraine: number | null; others_of_concern: number | null }[];
  operational_presence: { iso3: string; period_start: string; orgs: number; areas: number }[];
  gdacs_last_30d: { iso3: string; alert_level: string | null; n: number }[];
}

// One colour per point source so layers read apart from the lime Telegram dots
export const LAYER_COLORS: Record<string, string> = {
  gdacs: "var(--warn)",
  idmc_hdx: "var(--cat-legal)",
  insecurity_insight: "var(--cat-safety)",
  iom_mmp: "var(--cat-employment)",
};

// Fresh enough? A layer older than twice its cadence is stale.
export function layerIsStale(layer: Layer, now = Date.now()): boolean {
  if (!layer.last_success_at) return true;
  const age = now - new Date(layer.last_success_at).getTime();
  const limit = (layer.cadence === "weekly" ? 14 : 2) * 86400000;
  return age > limit;
}

export interface PlaceRef {
  kind: "city" | "region";
  name: string;
  lat: number;
  lon: number;
}

export interface MapHighlight {
  cities: string[];
  regions: string[];
}

export interface Category {
  key: string;
  name: string;
  short: string;
  color: string;
}

// Colours are CSS variables so each theme can supply its own set (see globals.css)
export const CATEGORIES: Category[] = [
  { key: "housing",    name: "Accommodation / Housing",        short: "Housing",    color: "var(--cat-housing)" },
  { key: "legal",      name: "Legal Status / Documentation",   short: "Legal",      color: "var(--cat-legal)" },
  { key: "employment", name: "Employment",                      short: "Employment", color: "var(--cat-employment)" },
  { key: "language",   name: "Polish Language Proficiency",     short: "Language",   color: "var(--cat-language)" },
  { key: "education",  name: "Education",                       short: "Education",  color: "var(--cat-education)" },
  { key: "health",     name: "Health / Mental Health",          short: "Health",     color: "var(--cat-health)" },
  { key: "border",     name: "Border Crossing",                 short: "Border",     color: "var(--cat-border)" },
  { key: "safety",     name: "Safety / Security",               short: "Safety",     color: "var(--cat-safety)" },
];

// Maps backend category strings → frontend key
export const CAT_TO_KEY: Record<string, string> = {
  "Accommodation/Housing":       "housing",
  "Accommodation / Housing":     "housing",
  "Legal Status/Documentation":  "legal",
  "Legal Status / Documentation":"legal",
  "Employment":                  "employment",
  "Polish Language Proficiency": "language",
  "Education":                   "education",
  "Health/Mental Health":        "health",
  "Health / Mental Health":      "health",
  "Border Crossing":             "border",
  "Safety/Security":             "safety",
  "Safety / Security":           "safety",
};

export function catForKey(key: string): Category {
  return CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[0];
}

export function catKeysForMessage(msg: Message): string[] {
  return msg.categories
    .map((c) => CAT_TO_KEY[c])
    .filter((k): k is string => !!k);
}


// City clustering: group messages by city name, accumulate coordinates
export interface CityCluster {
  city: string;
  lat: number;
  lon: number;
  count: number;
}

export function buildCityClusters(messages: Message[]): CityCluster[] {
  const byCity: Record<string, { lat: number; lon: number; count: number; latSum: number; lonSum: number }> = {};
  for (const m of messages) {
    if (!m.city || m.lat == null || m.lon == null) continue;
    const key = m.city;
    if (!byCity[key]) byCity[key] = { lat: m.lat, lon: m.lon, count: 0, latSum: 0, lonSum: 0 };
    byCity[key].count++;
    byCity[key].latSum += m.lat;
    byCity[key].lonSum += m.lon;
  }
  return Object.entries(byCity).map(([city, d]) => ({
    city,
    lat: d.latSum / d.count,
    lon: d.lonSum / d.count,
    count: d.count,
  }));
}
