import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Silkscreen } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const silkscreen = Silkscreen({
  variable: "--font-pixel",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const viewport: Viewport = {
  interactiveWidget: "resizes-visual",
};

export const metadata: Metadata = {
  title: "Learnova",
  description:
    "Guess at a topic until the hints run out and you are explaining it with nothing on screen, then argue for it against a model or against a friend.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plexMono.variable} ${silkscreen.variable} h-dvh overflow-hidden antialiased`}
    >
      <body className="flex h-full flex-col overflow-hidden">
        <div className="page-glow" aria-hidden />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
