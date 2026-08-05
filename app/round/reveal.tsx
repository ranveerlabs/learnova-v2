"use client";

import type { Outcome } from "../api/grade/route";
import { formatClock, type Reveal as RevealData } from "./engine";
import { Arrow, GhostButton, Label, PrimaryButton } from "../ui";
import type { Provenance } from "./types";

/* Where the session lands.

   The honest shape of this screen took more deciding than anything else in the
   mode. The obvious version compares the cold open to Round 4 and prints the
   difference as a percentage, and it would be a lie: the cold open is a
   two-option guess taken before any studying, Round 4 is an explanation
   produced from nothing and marked on a rubric. There is no arithmetic that
   turns one into the other. A student who genuinely learned a great deal can
   come out of this with a worse-looking number than they went in with.

   So nothing here subtracts. Both ends are shown with what each one actually
   asked for, and the thing that carries the screen is the change in KIND: you
   started by recognising, and you finished by producing. That is a real
   claim, it is the claim the whole ladder was built to earn, and it does not
   need a fabricated statistic underneath it. */

const NARROW: React.CSSProperties = { fontVariationSettings: '"wdth" 88' };

const OUTCOME_WORD: Record<Outcome, string> = {
  solid: "Demonstrated",
  shaky: "Nearly there",
  "not-yet": "Not yet",
};

const OUTCOME_INK: Record<Outcome, string> = {
  solid: "var(--solid-ink)",
  shaky: "var(--shaky-ink)",
  "not-yet": "var(--broken-ink)",
};

const OUTCOME_MARK: Record<Outcome, string> = {
  solid: "var(--solid-mark)",
  shaky: "var(--shaky-mark)",
  "not-yet": "var(--broken-mark)",
};

const STAGE_NAME: Record<number, string> = {
  0: "cold open",
  1: "Round 1",
  2: "Round 2",
  3: "Round 3",
  4: "Round 4",
};

function Panel({
  label,
  children,
  note,
}: {
  label: string;
  children: React.ReactNode;
  note: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 rounded-[3px] border border-line bg-page p-5">
      <span
        style={NARROW}
        className="font-sans text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-ink-faint"
      >
        {label}
      </span>
      {children}
      <p className="mt-auto font-sans text-[0.75rem] leading-[1.5] text-ink-faint">{note}</p>
    </div>
  );
}

export function Reveal({
  data,
  topic,
  provenance,
  onRestart,
}: {
  data: RevealData;
  topic: string;
  provenance: Provenance;
  onRestart: () => void;
}) {
  const produced = data.productions.length > 0;
  const demonstrated = data.productions.filter((p) => p.outcome === "solid").length;

  return (
    <section className="mx-auto flex w-full max-w-[58rem] flex-col gap-10 py-8">
      <div className="stage-in flex flex-col gap-3">
        <Label>{topic}</Label>
        <h2 className="max-w-[24ch] text-balance font-read text-[clamp(2rem,1.4rem+2.4vw,3rem)] leading-[1.08] tracking-[-0.02em] text-ink">
          {produced
            ? "You started by recognising. You finished by explaining."
            : "You started by recognising."}
        </h2>
        <p className="max-w-[58ch] font-sans text-[0.9375rem] leading-[1.65] text-ink-soft">
          These two are not the same test, so they are not compared with a number. Everything below
          is counted from what you actually did in this session.
        </p>
      </div>

      {/* The two ends of the ladder, side by side, each labelled with what it
          demanded and what guessing alone would have got you. */}
      <div className="stage-in flex flex-col gap-4 sm:flex-row" style={{ ["--i" as string]: 1 }}>
        {data.open && (
          <Panel
            label="Cold open, before studying"
            note={`Two options a question, so pure guessing scores about ${Math.round(
              data.open.chance * data.open.answered
            )} of ${data.open.answered}. No score was shown at the time, on purpose.`}
          >
            <span className="font-mono text-[2.75rem] font-semibold leading-none tabular-nums text-ink">
              {data.open.correct}
              <span className="text-[1.5rem] text-ink-faint">/{data.open.answered}</span>
            </span>
            <span className="font-sans text-[0.8125rem] text-ink-soft">Recognised on instinct</span>
          </Panel>
        )}

        {produced ? (
          <Panel
            label="Round 4, in your own words"
            note="Nothing on screen, no options, marked against the material. Guessing scores nothing here, because there is nothing to guess at."
          >
            <div className="flex flex-col gap-2">
              {data.productions.map((p) => (
                <div key={p.concept} className="flex items-baseline gap-2.5">
                  <span
                    aria-hidden
                    className="mt-1 block h-2.5 w-2.5 shrink-0 rounded-[2px]"
                    style={{ background: OUTCOME_MARK[p.outcome] }}
                  />
                  <span className="min-w-0 flex-1 font-read text-[1rem] leading-tight text-ink">
                    {p.concept}
                  </span>
                  <span
                    style={{ ...NARROW, color: OUTCOME_INK[p.outcome] }}
                    className="shrink-0 font-sans text-[0.625rem] font-bold uppercase tracking-[0.1em]"
                  >
                    {OUTCOME_WORD[p.outcome]}
                  </span>
                </div>
              ))}
            </div>
            <span className="font-sans text-[0.8125rem] text-ink-soft">
              {demonstrated} of {data.productions.length} demonstrated
            </span>
          </Panel>
        ) : (
          <Panel
            label="Round 4"
            note="Round 4 is the only stage that produces real evidence, because it is the only one with nothing on screen to lean on."
          >
            <span className="font-read text-[1.125rem] leading-[1.4] text-ink">
              You did not get to this one.
            </span>
          </Panel>
        )}
      </div>

      {/* The run. Real elapsed time, and honest about what it does and does
          not include. */}
      <div className="stage-in flex flex-col gap-4" style={{ ["--i" as string]: 2 }}>
        <div className="flex items-baseline justify-between gap-4 border-b border-line pb-2">
          <Label>The run</Label>
          <span className="run-clock font-mono text-[1.125rem] font-semibold tabular-nums text-ink">
            {formatClock(data.runTime)}
          </span>
        </div>

        <div className="flex flex-wrap gap-x-8 gap-y-4">
          {data.splits.map((split, i) => (
            <div
              key={split.stage}
              style={{ ["--i" as string]: i }}
              className="split-land flex flex-col gap-1"
            >
              <span className="run-clock font-mono text-[1.0625rem] tabular-nums text-ink-soft">
                {formatClock(split.ms)}
              </span>
              <span
                style={NARROW}
                className="font-sans text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-ink-faint"
              >
                {STAGE_NAME[split.stage]}
              </span>
            </div>
          ))}

          {data.fastestAnswer !== null && (
            <div className="flex flex-col gap-1">
              <span className="run-clock font-mono text-[1.0625rem] tabular-nums text-accent">
                {(data.fastestAnswer / 1000).toFixed(1)}s
              </span>
              <span
                style={NARROW}
                className="font-sans text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-ink-faint"
              >
                Fastest correct
              </span>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <span className="font-mono text-[1.0625rem] tabular-nums text-ink-soft">
              {data.bestStreak}
            </span>
            <span
              style={NARROW}
              className="font-sans text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-ink-faint"
            >
              Best run
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-mono text-[1.0625rem] tabular-nums text-ink-soft">
              {data.points.toLocaleString()}
            </span>
            <span
              style={NARROW}
              className="font-sans text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-ink-faint"
            >
              Points
            </span>
          </div>
        </div>

        <p className="font-sans text-[0.75rem] leading-[1.5] text-ink-faint">
          The clock covers the cold open and Rounds 1 to 3. Round 4 is not timed and is not in it:
          putting a stopwatch on the one moment you have to explain something properly would only
          teach you to say something fast instead of something true.
        </p>
      </div>

      {/* Concept by concept: how far up the ladder each one survived. This is
          the part a student can act on next time. */}
      <div className="stage-in flex flex-col gap-3" style={{ ["--i" as string]: 3 }}>
        <Label>Concept by concept</Label>
        <ol className="divide-y divide-line overflow-hidden rounded-[3px] border border-line bg-page">
          {data.concepts.map((line, i) => (
            <li
              key={line.concept}
              style={{ ["--i" as string]: i }}
              className="split-land flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3"
            >
              <span className="min-w-0 flex-1 font-read text-[1rem] leading-snug text-ink">
                {line.concept}
              </span>

              {line.openAnswered > 0 && (
                <span className="font-mono text-[0.6875rem] tabular-nums text-ink-faint">
                  cold open {line.openCorrect}/{line.openAnswered}
                </span>
              )}

              <span
                style={NARROW}
                className="w-[9rem] shrink-0 text-right font-sans text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-ink-soft"
              >
                {line.outcome
                  ? OUTCOME_WORD[line.outcome]
                  : line.reached > 0
                    ? `got to ${STAGE_NAME[line.reached]}`
                    : "not yet right"}
              </span>
            </li>
          ))}
        </ol>

        {data.timedOut > 0 && (
          <p className="font-sans text-[0.75rem] leading-[1.5] text-ink-faint">
            {data.timedOut} question{data.timedOut === 1 ? "" : "s"} ran out of time and{" "}
            {data.timedOut === 1 ? "is" : "are"} not counted as wrong anywhere above.
          </p>
        )}

        {provenance === "generated" && (
          <p className="font-sans text-[0.75rem] leading-[1.5] text-ink-faint">
            These questions were written by an AI model from the topic you named, not from your own
            material. Paste your notes next time and every question comes with the line it came
            from, checked word for word.
          </p>
        )}
      </div>

      <div className="stage-in flex flex-wrap items-center gap-3" style={{ ["--i" as string]: 4 }}>
        <PrimaryButton onClick={onRestart}>
          Run it again <Arrow />
        </PrimaryButton>
        <GhostButton onClick={onRestart}>Study something else</GhostButton>
      </div>

      <p className="font-sans text-[0.75rem] leading-[1.5] text-ink-faint">
        Nothing from this session is saved. There are no accounts yet, so when you close this tab it
        is gone, and that is the honest state of things rather than a setting.
      </p>
    </section>
  );
}
