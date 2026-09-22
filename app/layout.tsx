import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

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
      className="h-dvh overflow-hidden antialiased"
    >
      <body className="flex h-full flex-col overflow-hidden">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
