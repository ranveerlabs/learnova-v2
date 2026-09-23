import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Round mode / Learnova",
  description:
    "Study a topic in five rounds. Each round gives you less help, ending with an explanation in your own words.",
};

export default function RoundLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
