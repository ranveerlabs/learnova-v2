"use client";

import { Working } from "../ui";
import { SPEECH_ORDER, type Speech, type Turn } from "./types";

export function SpeechRail({ at, finished }: { at: number; finished: boolean }) {
  return (
    <nav aria-label="Speeches" className="flex min-w-0 shrink-0 items-center gap-2.5">
      <span className="flex shrink-0 items-center gap-[3px]">
        {SPEECH_ORDER.map((name, i) => {
          const done = finished || i < at;
          const current = !finished && i === at;
          return (
            <span
              key={name}
              title={name}
              aria-label={`${name}: ${done ? "given" : current ? "current" : "ahead"}`}
              aria-current={current ? "step" : undefined}
              className={`block h-3.5 w-3 rounded-[1px] ${
                done
                  ? "bg-solid-mark"
                  : current
                    ? "listening border-2 border-accent bg-accent-wash"
                    : "border-2 border-line-strong"
              }`}
            />
          );
        })}
      </span>
      <span
        className={`truncate font-pixel text-[0.5625rem] leading-none ${
          finished ? "text-solid-ink" : "text-ink-soft"
        }`}
      >
        {finished ? "Round over" : SPEECH_ORDER[Math.min(at, SPEECH_ORDER.length - 1)]}
      </span>
    </nav>
  );
}

export function Said({
  turn,
  tierName,
  speaking = false,
}: {
  turn: Turn;
  tierName: string;
  speaking?: boolean;
}) {
  const mine = turn.speaker === "user";
  return (
    <div
      className={`w-[88%] rounded-[3px] bg-page px-3.5 py-2.5 ${
        mine ? "self-end border-r-[3px] border-accent" : "self-start border-l-[3px] border-line-strong"
      }`}
      role={speaking ? "status" : undefined}
      aria-live={speaking ? "polite" : undefined}
    >
      <p
        className={`mb-1 font-pixel text-[0.5rem] leading-none text-ink-faint ${
          mine ? "text-right" : ""
        }`}
      >
        {mine ? "You" : tierName} · {turn.speech}
      </p>
      <p className="whitespace-pre-wrap font-read text-[1rem] leading-[1.6] text-ink">
        {turn.text}
        {speaking && (
          <span className="ml-1.5">
            <Working />
          </span>
        )}
      </p>
    </div>
  );
}

export function Opening({ said }: { said: string }) {
  return (
    <p className="m-auto max-w-[34ch] text-center font-sans text-[0.875rem] leading-[1.6] text-ink-faint">
      {said}
    </p>
  );
}

export type { Speech };
