import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

// Runs before first paint so the stored theme applies without a flash
const THEME_BOOT = `(function(){try{var m=localStorage.getItem("os-theme")||"dark";var r=m==="auto"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):m;document.documentElement.dataset.theme=r;}catch(e){document.documentElement.dataset.theme="dark";}})();`;

export const metadata: Metadata = {
  title: "Open Seldon",
  description: "Humanitarian analytics dashboard for refugee community monitoring",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-mark.svg", type: "image/svg+xml" },
      { url: "/favicon-mark-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/app-icon-180.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0A0912" },
    { media: "(prefers-color-scheme: light)", color: "#F4F2FB" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
