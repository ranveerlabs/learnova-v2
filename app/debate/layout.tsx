import type { Metadata } from "next";
import { Win } from "../ui";

export const metadata: Metadata = {
  title: "Debate · Learnova",
  description:
    "Pick a side and hold it for four speeches against an opponent trying to take it off you. A judged ballot at the end, tournament formats if you want them, and a record of what you have won and lost.",
};

export default function DebateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative z-10 flex h-full min-h-0 flex-1 flex-col p-4 sm:p-6 lg:p-8">
      <Win
        title="Debate"
        closeHref="/"
        className="mx-auto w-full min-h-0 max-w-[96rem] flex-1"
        bodyClassName="px-4 py-4 sm:px-6 lg:px-10"
      >
        <main className="flex w-full min-w-0 flex-col">{children}</main>
      </Win>
    </div>
  );
}
