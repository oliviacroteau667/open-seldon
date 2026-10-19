import type { Metadata } from "next";
import DesignReference from "@/components/DesignReference";

export const metadata: Metadata = {
  title: "Open Seldon — Design reference",
  robots: { index: false },
};

export default function DesignPage() {
  return <DesignReference />;
}
