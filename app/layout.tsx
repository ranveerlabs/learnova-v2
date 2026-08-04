import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono, Newsreader, Patrick_Hand, Silkscreen } from "next/font/google";
import "./globals.css";

/* Five faces, five jobs.
   Newsreader sets everything under examination: the student's explanation,
   the source's own words, and the asks. Archivo runs the machinery: labels,
   buttons, the index. Plex Mono is apparatus notation only: sigla, counts.

   The last two never appear once a session starts. Patrick Hand is the hand
   writing on the paper and Silkscreen is what a label maker prints, and both
   belong to the desk at the front door, not to the marking of anyone's work.
   The moment there is an explanation on screen, the page goes quiet again. */

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  display: "swap",
});

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const patrickHand = Patrick_Hand({
  variable: "--font-hand",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const silkscreen = Silkscreen({
  variable: "--font-pixel",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Learnova, Teach-Back",
  description:
    "Explain a concept in your own words. Learnova marks up what you wrote against your source, so you can see where familiarity ends and understanding begins.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${archivo.variable} ${plexMono.variable} ${patrickHand.variable} ${silkscreen.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <div className="page-glow" aria-hidden />
        {children}
      </body>
    </html>
  );
}
