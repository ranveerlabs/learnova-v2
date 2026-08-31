import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live debate · Learnova",
  description:
    "Open a room, read out the code, and argue it four speeches each against a person rather than a model. No account, nothing saved, and the room stops existing when you both close the tab.",
};

export default function LiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
