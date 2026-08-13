import type { Metadata } from "next";

/* Round Mode's frame is inside page.tsx and stays there: the viewport lock is
   part of what the mode IS, and it has to sit around the phase switch rather
   than around the route. This layout exists for the one thing a "use client"
   page cannot do for itself, which is name itself in the browser's tab. */

export const metadata: Metadata = {
  title: "Round Mode · Learnova",
  description:
    "Name a topic and start guessing. Five rounds take the help away one step at a time, until you are explaining it in your own words with nothing on screen. The gap between recognising and explaining is the whole point.",
};

export default function RoundLayout({ children }: { children: React.ReactNode }) {
  return children;
}
