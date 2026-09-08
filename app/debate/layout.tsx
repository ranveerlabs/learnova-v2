import type { Metadata } from "next";
import { Win } from "../ui";

export const metadata: Metadata = {
  title: "Debate / Learnova",
  description:
    "Pick a side and hold it for four speeches, against the model or against a friend on a four letter code. Judged ballot at the end, tournament formats if you want them, and a rating that moves with the result.",
};

export default function DebateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative z-10 flex h-full min-h-0 flex-1 flex-col justify-center p-3 sm:p-6 lg:p-8">
      <Win
        title="Debate"
        closeHref="/"
        className="mx-auto max-h-full w-full min-h-0 max-w-[60rem]"
        bodyClassName="px-4 py-4 sm:px-6 lg:px-10"
      >
        <main className="flex w-full min-w-0 flex-col">{children}</main>
      </Win>
    </div>
  );
}
