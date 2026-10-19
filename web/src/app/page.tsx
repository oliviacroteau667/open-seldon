import type { Metadata } from "next";
import Landing from "@/components/Landing";

export const metadata: Metadata = {
  title: "Open Seldon — Humanitarian OSINT, on demand",
  description:
    "Open Seldon is an open-source data hub for humanitarian organizations: public Telegram channels and open datasets, translated, geocoded and categorized by need, on a live globe.",
};

export default function Home() {
  return <Landing />;
}
