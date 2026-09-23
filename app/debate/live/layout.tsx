import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live debate / Learnova",
  description:
    "Open a two-person room with a short code and debate four speeches each. No account is required, and the room is not saved after it closes.",
};

export default function LiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
