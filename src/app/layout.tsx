import type { Metadata, Viewport } from "next";
import "@fontsource/instrument-sans/400.css";
import "@fontsource/instrument-sans/500.css";
import "@fontsource/instrument-sans/600.css";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource-variable/source-serif-4";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import { Providers } from "@/components/app/providers";

// Type matches the Catasto website: Instrument Serif for titles, Instrument Sans for everything else.
// Source Serif 4 sets documents and deliverables, so they read like paper. JetBrains Mono is only
// for the demo bar. All fonts are self-hosted so the demo works offline.
const fontVars = {
  "--font-display-brand": '"Instrument Serif", "Iowan Old Style", Georgia, serif',
  "--font-sans-brand": '"Instrument Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  "--font-serif-brand": '"Source Serif 4 Variable", ui-serif, Georgia, Cambria, serif',
  "--font-mono-brand": '"JetBrains Mono Variable", ui-monospace, "SF Mono", Menlo, monospace',
} as React.CSSProperties;

export const metadata: Metadata = {
  title: "Catasto V1.1 · Harper household (demo)",
  description: "One client record for the planner, CPA and attorney. Fictional demo household.",
  applicationName: "Catasto",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#16181c" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" style={fontVars} className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
