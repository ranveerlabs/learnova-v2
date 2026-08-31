import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Round Mode · Learnova",
  description:
    "Name a topic and start guessing. Five rounds take the help away one step at a time, until you are explaining it in your own words with nothing on screen. The gap between recognising and explaining is the whole point.",
};

export default function RoundLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
