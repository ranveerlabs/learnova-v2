import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live debate / Learnova",
  description:
    "Open a room with a code. Four speeches each.",
};

export default function LiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
