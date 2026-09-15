import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "project7",
  description: "Humanitarian analytics dashboard for refugee community data",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
