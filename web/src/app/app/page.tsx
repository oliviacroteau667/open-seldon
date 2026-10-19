import type { Metadata } from "next";
import Dashboard from "@/components/Dashboard";

export const metadata: Metadata = {
  title: "Open Seldon — Dashboard",
};

export default function AppPage() {
  return <Dashboard />;
}
