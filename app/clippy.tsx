"use client";

import { useState } from "react";
import Link from "next/link";
import { PixelSprite } from "./paper";

// the assistant. it only ever says two true things and then gets out of the way
export function Clippy({ sha, limits }: { sha: string; limits: number }) {
  const [open, setOpen] = useState(true);

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        title="What is this build"
        aria-label="Show the build note"
        className="xp-btn fixed bottom-4 right-4 z-40 !px-2 !py-2"
      >
        <PixelSprite name="clip" scale={2} />
      </button>
    );

  return (
    <aside className="fixed bottom-3 right-3 z-40 flex max-w-[min(21rem,calc(100vw-1.5rem))] items-end gap-2">
      <div style={{ background: "var(--supply-gold)" }} className="win min-w-0">
        <div className="flex items-center justify-between gap-2 border-b-2 border-line px-2.5 py-1.5">
          <span className="font-pixel text-[0.5625rem] uppercase text-[#101010]">
            This build
          </span>
          <button
            onClick={() => setOpen(false)}
            className="title-btn !h-4 !w-4 !text-[0.5rem]"
            aria-label="Hide the build note"
          >
            <span aria-hidden>X</span>
          </button>
        </div>

        <dl className="flex flex-col gap-1 px-2.5 py-2 font-pixel text-[0.625rem] text-[#101010]">
          <div className="flex justify-between gap-3">
            <dt>commit</dt>
            <dd>{sha}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>known limitations</dt>
            <dd>{limits}</dd>
          </div>
        </dl>

        <Link
          href="/feed"
          className="block border-t-2 border-line px-2.5 py-1.5 font-pixel text-[0.5625rem] uppercase text-[#101010] underline decoration-[#101010]/40 underline-offset-4 hover:decoration-[#101010]"
        >
          read them
        </Link>
      </div>

      <PixelSprite
        name="clip"
        scale={3}
        title="Learnova's paperclip"
        className="shrink-0"
      />
    </aside>
  );
}
