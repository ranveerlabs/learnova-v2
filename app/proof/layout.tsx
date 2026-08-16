import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The same question, twice · Learnova",
  description:
    "An AI study tool asked about a rubber roofing compound it has never heard of invents a protein, confidently and in detail. Asked again with the spec sheet in front of it, it gets the answer right and quotes the line it came from. The same model, live, both times.",
};

export default function ProofLayout({ children }: { children: React.ReactNode }) {
  return children;
}
