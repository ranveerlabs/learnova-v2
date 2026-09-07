import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Round Mode · Learnova",
  description:
    "Name a topic and start guessing. Five rounds, each one takes a hint away, and the last one is a blank screen you explain it into.",
};

export default function RoundLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
