"use client";

import { formatClock } from "./engine";
import type { RoundSummary } from "./engine";
import type { Round } from "./types";

const NARROW: React.CSSProperties = { fontVariationSettings: '"wdth" 88' };

const NEXT: Record<Round, { name: string; taken: string; asks: string }> = {
  1: {
    name: "Round 1",
    taken: "Four options now, not two.",
    asks: "Pick the right one.",
  },
  2: { name: "Round 2", taken: "No options.", asks: "Type the missing term." },
  3: {
    name: "Round 3",
    taken: "No sentence. Just its pieces, shuffled.",
    asks: "Build it.",
  },
  4: {
    name: "Round 4",
    taken: "Nothing on screen.",
    asks: "Say it in your own words.",
  },
};

export function Interval({
  summary,
  next,
  splitMs,
  runMs,
  returning,
  onContinue,
}: {
  summary: RoundSummary;
  next: Round;
  splitMs: number;
  runMs: number;
  returning: boolean;
  onContinue: () => void;
}) {
  const cleared = summary.stage === 0 ? "Warm up" : `Round ${summary.stage}`;
  const upNext = NEXT[next];

  return (
    <section className="mx-auto flex w-full max-w-[44rem] flex-col gap-6 py-4 sm:py-8">
      <div className="flex flex-col gap-2">
        <span
          style={NARROW}
          className="font-sans text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-accent"
        >
          {cleared} cleared
        </span>
        <h2 className="font-read text-[clamp(1.75rem,4vw,2.5rem)] leading-[1.1] tracking-[-0.015em] text-ink">
          {summary.stage === 0
            ? returning
              ? "That was what stuck. Now it starts."
              : "That was you guessing. Now it starts."
            : summary.turnedAround.length > 0
              ? "Something just moved."
              : "Round done."}
        </h2>
      </div>

      {summary.stage === 0 ? (
        <p className="max-w-[46ch] font-sans text-[0.9375rem] leading-[1.6] text-ink-soft">
          {returning
            ? "You have met this before, so that was what stuck. You will see those answers again at the end."
            : "You had not studied yet, so that was a baseline. You will meet those answers again at the end."}
        </p>
      ) : (
        <p className="font-read text-[1.375rem] leading-[1.35] text-ink">
          {summary.correct} of {summary.answered} right.
        </p>
      )}

      <p className="font-read text-[1.25rem] leading-[1.35] text-ink">
        <span className="text-ink-faint">{upNext.name}, next. </span>
        {upNext.taken} {upNext.asks}
      </p>

      <button
        onClick={onContinue}
        autoFocus
        className="btn inline-flex items-center gap-2 self-start bg-accent px-6 py-3 font-sans text-[0.9375rem] font-semibold text-on-accent"
      >
        {next === 4 ? "Take it away" : `Start ${upNext.name.toLowerCase()}`}
        <span aria-hidden className="arrow">
          -&gt;
        </span>
      </button>

      {summary.stage !== 0 && (
        <details className="group flex flex-col border-t border-line pt-4">
          <summary
            style={NARROW}
            className="inline-flex cursor-pointer list-none items-center gap-1.5 self-start font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-ink-faint transition-colors hover:text-ink-soft"
          >
            <span
              aria-hidden
              className="inline-block transition-transform group-open:rotate-90"
            >
              &gt;
            </span>
            How that round went
          </summary>

          <div className="mt-4 flex max-w-[34rem] flex-col gap-4">
            <dl className="flex w-fit min-w-[15rem] flex-col gap-1 border-2 border-line bg-sunk px-3 py-2.5 font-mono text-[0.8125rem] text-ink-soft">
              <div className="flex justify-between gap-8">
                <dt>best run</dt>
                <dd className="tabular-nums text-ink">{summary.bestStreak}</dd>
              </div>
              <div className="flex justify-between gap-8">
                <dt>split</dt>
                <dd className="tabular-nums text-ink">{formatClock(splitMs)}</dd>
              </div>
              <div className="flex justify-between gap-8">
                <dt>total</dt>
                <dd className="tabular-nums text-ink">{formatClock(runMs)}</dd>
              </div>
            </dl>

            {summary.turnedAround.length > 0 && (
              <div className="flex flex-col gap-2 border-l-[3px] border-solid-mark bg-solid-tint px-4 py-3">
                <span
                  style={NARROW}
                  className="font-sans text-[0.625rem] font-bold uppercase tracking-[0.14em] text-solid-ink"
                >
                  Turned around
                </span>
                <p className="font-read text-[0.9375rem] leading-[1.5] text-solid-ink">
                  {summary.turnedAround.join(", ")}
                </p>
              </div>
            )}

            {summary.stillOpen.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span
                  style={NARROW}
                  className="font-sans text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-ink-faint"
                >
                  Still open
                </span>
                <p className="font-read text-[0.9375rem] leading-[1.5] text-ink-soft">
                  {summary.stillOpen.join(", ")}
                </p>
              </div>
            )}
          </div>
        </details>
      )}
    </section>
  );
}
