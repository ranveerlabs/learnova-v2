import type { Metadata, Viewport } from "next";
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

/* The on-screen keyboard must not resize the game.

   Next already emits `width=device-width, initial-scale=1`, which is the whole
   of what most pages need. The one field worth setting here is the last one:
   by default a phone keyboard shrinks the LAYOUT viewport, so `100dvh`
   collapses to the strip above the keyboard and every screen re-lays itself
   out around it. On a page pinned to the viewport that is not a small
   adjustment: opening the keyboard in Round 2 or Round 4 re-flowed the whole
   board under the student's thumb, mid-answer.

   `resizes-visual` leaves the layout alone and moves only what is visible, so
   the frame stays exactly the size it was and the browser pans to whatever has
   focus. The board a student was looking at before the keyboard opened is the
   same board afterwards. */
export const viewport: Viewport = {
  interactiveWidget: "resizes-visual",
};

/* The root names the app, and each mode names itself over the top of it. The
   title used to be "Learnova, Round Mode" for every page in the app including
   the debate ones, which was true when there was one mode. */
export const metadata: Metadata = {
  title: "Learnova",
  description:
    "Two ways to know something. Learn it until you can explain it with nothing on screen, then defend it against an opponent trying to take it off you.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${archivo.variable} ${plexMono.variable} ${patrickHand.variable} ${silkscreen.variable} h-dvh overflow-hidden antialiased`}
    >
      {/* The page is exactly the viewport and never scrolls.

          This is a room game. Somebody is holding a phone or a laptop and four
          other people are reading it over their shoulder, and not one of them
          is going to scroll. Whatever the round needs to say has to be on
          screen at the moment it needs saying, so the shell is pinned to the
          viewport and the screens inside it are built to fit it rather than to
          flow past it. The two screens that genuinely cannot promise that, the
          front door with notes pasted into it and the results, scroll inside
          their own panel so the frame around them still never moves. */}
      <body className="flex h-full flex-col overflow-hidden">
        <div className="page-glow" aria-hidden />
        {children}
      </body>
    </html>
  );
}
