import type { Metadata, Viewport } from "next";
import "@fontsource/instrument-sans/400.css";
import "@fontsource/instrument-sans/500.css";
import "@fontsource/instrument-sans/600.css";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";

// Type matches the Catasto website: Instrument Serif for titles, Instrument Sans for everything else,
// JetBrains Mono for invite links. All fonts are self-hosted so the demo works offline.
const fontVars = {
  "--font-display-brand": '"Instrument Serif", "Iowan Old Style", Georgia, serif',
  "--font-sans-brand": '"Instrument Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  "--font-mono-brand": '"JetBrains Mono Variable", ui-monospace, "SF Mono", Menlo, monospace',
} as React.CSSProperties;

export const metadata: Metadata = {
  title: "Catasto MVP demo",
  description: "One client record for the adviser, CPA and attorney. Fictional data only.",
  applicationName: "Catasto",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { color: "#ffffff" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" style={fontVars} className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full">
        {children}
      </body>
    </html>
  );
}
