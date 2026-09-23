import type { Metadata } from "next";
import { Win } from "../ui";
import { AudioControls } from "../audio-controls";

export const metadata: Metadata = {
  title: "Debate / Learnova",
  description:
    "Pick a side, give four speeches against a model or friend, and get a ballot at the end.",
};

export default function DebateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="debate-scope relative z-10 flex h-full min-h-0 flex-1 flex-col p-3 sm:p-6 lg:p-8">
      <Win
        title="Debate"
        closeHref="/"
        className="mx-auto max-h-full w-full min-h-0 max-w-[60rem] flex-1"
        bodyClassName="px-4 py-4 sm:px-6 lg:px-10"
        actions={<AudioControls />}
      >
        <main className="flex w-full min-w-0 flex-col">{children}</main>
      </Win>
    </div>
  );
}
