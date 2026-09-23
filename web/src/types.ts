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
}

export interface DashboardData {
  messages: Message[];
  channels: string[];
}

export interface Category {
  key: string;
  name: string;
  short: string;
  color: string;
}

export const CATEGORIES: Category[] = [
  { key: "housing",    name: "Accommodation / Housing",        short: "Housing",    color: "#E8553E" },
  { key: "legal",      name: "Legal Status / Documentation",   short: "Legal",      color: "#4F8CFF" },
  { key: "employment", name: "Employment",                      short: "Employment", color: "#22C1B0" },
  { key: "language",   name: "Polish Language Proficiency",     short: "Language",   color: "#F5A524" },
  { key: "education",  name: "Education",                       short: "Education",  color: "#8B7CF6" },
  { key: "health",     name: "Health / Mental Health",          short: "Health",     color: "#5FD068" },
  { key: "border",     name: "Border Crossing",                 short: "Border",     color: "#38BDF8" },
  { key: "safety",     name: "Safety / Security",               short: "Safety",     color: "#F472B6" },
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
