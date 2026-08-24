import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Debate · Learnova",
  description:
    "Pick a side and hold it for four speeches against an opponent trying to take it off you. A judged ballot at the end, tournament formats if you want them, and a record of what you have won and lost.",
};

export default function DebateLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative z-10 flex h-full min-h-0 flex-1 flex-col">
      <div className="mx-auto flex w-full min-h-0 max-w-[96rem] flex-1 flex-col overflow-y-auto px-4 py-3 sm:px-6 lg:px-10">
        <main className="flex w-full min-w-0 shrink-0 grow flex-col">{children}</main>
      </div>
    </div>
  );
}
