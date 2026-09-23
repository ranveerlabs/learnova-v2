import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const viewport: Viewport = {
  interactiveWidget: "resizes-visual",
};

export const metadata: Metadata = {
  title: "Learnova",
  description:
    "Study a topic in five rounds with less help each time, or debate a model or friend.",
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
