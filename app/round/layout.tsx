import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Round mode / Learnova",
  description:
    "Five-round study sessions from a topic or notes.",
};

export default function RoundLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
