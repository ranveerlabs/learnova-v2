"use client";

import { formatClock } from "./engine";
import type { RoundSummary } from "./engine";
import type { Round } from "./types";

/* The beat between rounds.

   Two jobs, and they pull against each other. It has to feel like clearing a
   level, and it has to be true. So everything on it is counted from this
   session's answers: the split is a real elapsed time, a turnaround is a
   concept the student actually got wrong earlier and right just now, and when
   nothing turned around it says so instead of finding something flattering.

   What makes it feel like a level is not an invented number, it is the next
   line: being told exactly what help is about to be taken away. */

const NARROW: React.CSSProperties = { fontVariationSettings: '"wdth" 88' };

/** What the next round takes away. Written as a loss on purpose: the student
    should feel the scaffolding going, because that is the mechanic. */
const NEXT: Record<Round, { name: string; taken: string; asks: string }> = {
  1: {
    name: "Round 1",
    taken: "Two of the four options are wrong now, not one.",
    asks: "Pick the right answer out of four.",
  },
  2: {
    name: "Round 2",
    taken: "The options are gone.",
    asks: "Type the missing term yourself.",
  },
  3: {
    name: "Round 3",
    taken: "The sentence is gone. You get its pieces, out of order.",
    asks: "Build the explanation.",
  },
  4: {
    name: "Round 4",
    taken: "Everything is gone. Nothing on screen but the question.",
    asks: "Say it in your own words, out loud or typed.",
  },
};

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "plain" }) {
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
  onContinue,
}: {
  summary: RoundSummary;
  next: Round;
  splitMs: number;
  runMs: number;
  onContinue: () => void;
}) {
  const cleared = summary.stage === 0 ? "Cold open" : `Round ${summary.stage}`;
  const upNext = NEXT[next];

  return (
    <section className="mx-auto flex w-full max-w-[46rem] flex-col gap-8 py-8">
      <div className="stage-in flex flex-col gap-2">
        <span
          style={NARROW}
          className="font-sans text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-accent"
        >
          {cleared} cleared
        </span>
        <h2 className="font-read text-[clamp(1.75rem,1.3rem+1.8vw,2.5rem)] leading-[1.1] tracking-[-0.015em] text-ink">
          {summary.stage === 0
            ? "That was you guessing. Now it starts."
            : summary.turnedAround.length > 0
              ? "Something just moved."
              : "Round done."}
        </h2>
      </div>

      {/* The numbers, all of them real. The cold open deliberately shows no
          score at all: it is a baseline taken before any studying, and putting
          a mark on it would tell a student they had failed something they were
          never meant to pass. */}
      {summary.stage === 0 ? (
        <p className="stage-in max-w-[54ch] font-sans text-[0.9375rem] leading-[1.65] text-ink-soft" style={{ ["--i" as string]: 1 }}>
          No score for that one, on purpose. Guessing before you study is a real technique: it
          primes you to notice the answer when it arrives, and missing was always the expected
          outcome. Your answers are kept, and at the end you will see them next to what you can do
          once the help is gone.
        </p>
      ) : (
        <div className="stage-in flex flex-wrap gap-x-10 gap-y-6" style={{ ["--i" as string]: 1 }}>
          <Stat
            label="Correct"
            value={`${summary.correct}/${summary.answered}`}
            tone={summary.answered > 0 && summary.correct / summary.answered >= 0.7 ? "good" : "plain"}
          />
          <Stat label="Best run" value={`${summary.bestStreak}`} />
          <Stat label="Points" value={summary.points.toLocaleString()} />
          <Stat label="Split" value={formatClock(splitMs)} />
          <Stat label="Total" value={formatClock(runMs)} />
        </div>
      )}

      {summary.timedOut > 0 && (
        <p className="stage-in font-sans text-[0.8125rem] leading-[1.55] text-ink-faint" style={{ ["--i" as string]: 2 }}>
          {summary.timedOut} question{summary.timedOut === 1 ? "" : "s"} ran out of time. Those are
          not counted as wrong anywhere: you did not answer them, which is not the same as getting
          them wrong.
        </p>
      )}

      {/* Real movement, named. This is the single most motivating true thing
          the session can say, so it gets the most room. */}
      {summary.turnedAround.length > 0 && (
        <div
          className="stage-in flex flex-col gap-2.5 rounded-[3px] border-l-[3px] border-solid-mark bg-solid-tint py-3.5 pl-4 pr-4"
          style={{ ["--i" as string]: 2 }}
        >
          <span
            style={NARROW}
            className="font-sans text-[0.625rem] font-bold uppercase tracking-[0.14em] text-solid-ink"
          >
            You had these wrong before, and right just now
          </span>
          <ul className="flex flex-wrap gap-2">
            {summary.turnedAround.map((concept, i) => (
              <li
                key={concept}
                style={{ ["--i" as string]: i }}
                className="split-land rounded-[3px] bg-page px-2.5 py-1 font-read text-[0.9375rem] text-solid-ink"
              >
                {concept}
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.stillOpen.length > 0 && (
        <div className="stage-in flex flex-col gap-2" style={{ ["--i" as string]: 3 }}>
          <span
            style={NARROW}
            className="font-sans text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-ink-faint"
          >
            Not right yet, at any stage
          </span>
          <p className="font-read text-[0.9375rem] leading-[1.5] text-ink-soft">
            {summary.stillOpen.join(", ")}
          </p>
        </div>
      )}

      {/* The hook into the next round: what is being taken away. */}
      <div
        className="stage-in flex flex-col gap-3 rounded-[3px] border border-line bg-sunk/60 p-5"
        style={{ ["--i" as string]: 4 }}
      >
        <span
          style={NARROW}
          className="font-sans text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-ink-faint"
        >
          {upNext.name}, next
        </span>
        <p className="font-read text-[1.25rem] leading-[1.3] text-ink">{upNext.taken}</p>
        <p className="font-sans text-[0.875rem] leading-[1.55] text-ink-soft">{upNext.asks}</p>
      </div>

      <button
        onClick={onContinue}
        autoFocus
        style={{ ["--i" as string]: 5 }}
        className="stage-in btn inline-flex items-center gap-2 self-start rounded-[3px] bg-accent px-6 py-3 font-sans text-[0.9375rem] font-semibold text-on-accent"
      >
        {next === 4 ? "Take it away" : `Start ${upNext.name.toLowerCase()}`}
        <span aria-hidden className="arrow">→</span>
      </button>
    </section>
  );
}
