import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Debate · Learnova",
  description:
    "Pick a side and hold it for four speeches against an opponent trying to take it off you. A judged ballot at the end, tournament formats if you want them, and an elo that is arithmetic rather than a guess.",
};

/* The frame for debate mode.

   Round Mode's shell is inside `app/page.tsx`, because the viewport lock is
   part of what that mode IS: a question is built to fit the frame and the page
   never scrolls. None of that reasoning transfers here. A debate is a
   transcript that grows, and there is no honest way to fit an unbounded number
   of speeches into a fixed frame; what has to stay put is the box you write
   in, and that is arranged inside the screen rather than by pinning the page.

   So this route gets a plain scrolling panel. The one thing it keeps from the
   root layout is that the panel scrolls rather than the document, so the
   background and the glow stay still underneath it.

   `grow shrink-0` on the inner element rather than `flex-1`, for the reason
   written out at length in `app/page.tsx`: a flex child with a shrink factor
   gets squashed to the height of its line, and content centred inside a
   squashed box overflows at the top where nothing can scroll to it. */
export default function DebateLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative z-10 flex h-full min-h-0 flex-1 flex-col">
      <div className="mx-auto flex w-full min-h-0 max-w-[96rem] flex-1 flex-col overflow-y-auto px-4 py-3 sm:px-6 lg:px-10">
        <main className="flex w-full min-w-0 shrink-0 grow flex-col">{children}</main>
      </div>
    </div>
  );
}
