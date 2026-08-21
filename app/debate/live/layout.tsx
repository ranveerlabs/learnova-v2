import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live debate · Learnova",
  description:
    "Open a room, send the link, and argue it out four speeches each against a person rather than a model. No account, nothing saved, and the room stops existing when you both close the tab.",
};

/* No frame of its own.

   `app/debate/layout.tsx` is the parent and already does the one thing this
   needs, which is a panel that scrolls under a still background. The only
   reason this file exists is the title: the screens under it are client
   components, and a client component cannot export metadata. */
export default function LiveLayout({ children }: { children: React.ReactNode }) {
  return children;
}
