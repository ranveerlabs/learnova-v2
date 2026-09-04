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

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "plain";
}) {
  return (
    <div className="flex flex-col gap-1">
      <span
        className={`font-mono text-[1.5rem] font-semibold tabular-nums leading-none ${
          tone === "good" ? "text-solid-ink" : "text-ink"
        }`}
      >
        {value}
      </span>
      <span
        style={NARROW}
        className="font-sans text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-ink-faint"
      >
        {label}
      </span>
    </div>
  );
}

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
    <section className="mx-auto flex w-full max-w-[46rem] flex-col gap-5 py-4 sm:gap-8 sm:py-8">
      <div className="stage-in flex flex-col gap-2">
        <span
          style={NARROW}
          className="font-sans text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-accent"
        >
          {cleared} cleared
        </span>
        <h2 className="font-read text-[clamp(1.75rem,1.3rem+1.8vw,2.5rem)] leading-[1.1] tracking-[-0.015em] text-ink">
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
        <p
          className="stage-in max-w-[46ch] font-sans text-[0.9375rem] leading-[1.6] text-ink-soft"
          style={{ ["--i" as string]: 1 }}
        >
          {returning
            ? "You have met this before, so that was what stuck. You will see those answers again at the end."
            : "You had not studied yet, so that was a baseline. You will meet those answers again at the end."}
        </p>
      ) : (
        <div
          className="stage-in flex flex-wrap gap-x-8 gap-y-5 sm:gap-x-10 sm:gap-y-6"
          style={{ ["--i" as string]: 1 }}
        >
          <Stat
            label="Correct"
            value={`${summary.correct}/${summary.answered}`}
            tone={
              summary.answered > 0 && summary.correct / summary.answered >= 0.7
                ? "good"
                : "plain"
            }
          />
          <Stat label="Best run" value={`${summary.bestStreak}`} />
          <Stat label="Split" value={formatClock(splitMs)} />
          <Stat label="Total" value={formatClock(runMs)} />
        </div>
      )}

      {summary.turnedAround.length > 0 && (
        <div
          className="stage-in flex flex-col gap-2.5 border-l-[3px] border-solid-mark bg-solid-tint py-3.5 pl-4 pr-4"
          style={{ ["--i" as string]: 2 }}
        >
          <span
            style={NARROW}
            className="font-sans text-[0.625rem] font-bold uppercase tracking-[0.14em] text-solid-ink"
          >
            Turned around
          </span>
          <ul className="flex flex-wrap gap-2">
            {summary.turnedAround.map((concept, i) => (
              <li
                key={concept}
                style={{ ["--i" as string]: i }}
                className="split-land bg-page px-2.5 py-1 font-read text-[0.9375rem] text-solid-ink"
              >
                {concept}
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.stillOpen.length > 0 && (
        <div
          className="stage-in flex flex-col gap-2"
          style={{ ["--i" as string]: 3 }}
        >
          <span
            style={NARROW}
            className="font-sans text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-ink-faint"
          >
            Still open
          </span>
          <p className="font-read text-[0.9375rem] leading-[1.5] text-ink-soft">
            {summary.stillOpen.join(",")}
          </p>
        </div>
      )}

      <div
        className="stage-in flex flex-col gap-3 border border-line bg-sunk/60 p-5"
        style={{ ["--i" as string]: 4 }}
      >
        <span
          style={NARROW}
          className="font-sans text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-ink-faint"
        >
          {upNext.name}, next
        </span>
        <p className="font-read text-[1.25rem] leading-[1.3] text-ink">
          {upNext.taken}
        </p>
        <p className="font-sans text-[0.875rem] leading-[1.55] text-ink-soft">
          {upNext.asks}
        </p>
      </div>

      <button
        onClick={onContinue}
        autoFocus
        style={{ ["--i" as string]: 5 }}
        className="stage-in btn inline-flex items-center gap-2 self-start bg-accent px-6 py-3 font-sans text-[0.9375rem] font-semibold text-on-accent"
      >
        {next === 4 ? "Take it away" : `Start ${upNext.name.toLowerCase()}`}
        <span aria-hidden className="arrow">
          →
        </span>
      </button>
    </section>
  );
}
