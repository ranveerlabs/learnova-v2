"use client";

import { formatClock, type Reveal as RevealData } from "./engine";
import { Arrow, GhostButton, Label, PrimaryButton } from "../ui";
import type { Provenance } from "./types";

/* Where the session lands.

   The honest shape of this screen took more deciding than anything else in the
   mode. The obvious version compares the warm up to Round 4 and prints the
   difference as a percentage, and it would be a lie: the warm up is a
   two-option guess taken before any studying, Round 4 is an explanation
   produced from nothing and marked on a rubric. There is no arithmetic that
   turns one into the other.

   ── One number, then a door ──────────────────────────────────────────────
   What the screen leads with is the rating, and the reasoning is in
   `rating()` in engine.ts. The short version: this used to lead with the run
   time, and time is not a measure of how well you did. The quickest way
   through a round is to answer everything wrong immediately.

   Everything else, including the clock, is behind one disclosure. A student
   who wants the breakdown opens it and gets more than the old screen showed;
   a student who wants to know how they did reads one number and goes again. */

const NARROW: React.CSSProperties = { fontVariationSettings: '"wdth" 88' };

/* ── How a concept ended up, in words a person would use ──────────────────
   The old table reported "got to Round 2" and "not yet right", which asks the
   reader to remember what Round 2 was before it means anything. These say
   what happened instead, and each carries a colour and a shape so the state
   is never colour alone. */

type Standing = {
  word: string;
  ink: string;
  mark: string;
};

const EXPLAINED: Standing = { word: "Explained it", ink: "text-solid-ink", mark: "bg-solid-mark" };
const ALMOST: Standing = { word: "Almost", ink: "text-shaky-ink", mark: "bg-shaky-mark" };
const NOT_YET: Standing = { word: "Not yet", ink: "text-broken-ink", mark: "bg-broken-mark" };
const KNEW_IT: Standing = { word: "Got it right", ink: "text-solid-ink", mark: "bg-solid-mark" };

/** Where a concept finished.

    A Round 4 grade wins when there is one, because producing an explanation
    with nothing on screen is the strongest evidence the session collects.
    Otherwise it comes down to whether they ever got it right at all, which is
    the only other thing the rounds actually establish. */
function standing(line: RevealData["concepts"][number]): Standing {
  if (line.outcome === "solid") return EXPLAINED;
  if (line.outcome === "shaky") return ALMOST;
  if (line.outcome === "not-yet") return NOT_YET;
  return line.reached > 0 ? KNEW_IT : NOT_YET;
}

/** One small labelled fact, inside the disclosure. */
function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[1.375rem] font-semibold leading-none tabular-nums text-ink">
        {value}
      </span>
      <span
        style={NARROW}
        className="font-sans text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-ink-faint"
      >
        {label}
      </span>
    </div>
  );
}

/* The rating's three bands. Colour is the fast channel and the word beside it
   is the one that survives not being able to see the colour. */
const BAND: Record<RevealData["rating"]["band"], { ink: string; note: string }> = {
  strong: { ink: "text-solid-ink", note: "Strong run" },
  fair: { ink: "text-shaky-ink", note: "Some of it landed" },
  weak: { ink: "text-broken-ink", note: "Worth another run" },
};

export function Reveal({
  data,
  topic,
  provenance,
  best,
  runs,
  onRestart,
}: {
  data: RevealData;
  topic: string;
  provenance: Provenance;
  /** The best rating in this tab so far, when there is a previous run. */
  best: { rating: number } | null;
  runs: number;
  onRestart: () => void;
}) {
  const produced = data.productions.length > 0;
  const demonstrated = data.productions.filter((p) => p.outcome === "solid").length;
  const { earned, possible } = data.rating;
  const band = BAND[data.rating.band];
  const beatBest = best !== null && earned > best.rating;

  return (
    <section className="mx-auto flex w-full max-w-[52rem] flex-col gap-6 py-2">
      <div className="stage-in flex flex-col gap-2">
        <Label>{topic}</Label>
        <h2 className="max-w-[24ch] text-balance font-read text-[clamp(1.5rem,1.2rem+1.5vw,2.125rem)] leading-[1.1] tracking-[-0.02em] text-ink">
          {produced
            ? "You started by recognising. You finished by explaining."
            : "You started by recognising."}
        </h2>
      </div>

      {/* The rating, and what it is out of. The denominator is not decoration:
          a bare "+740" says nothing when a short session and a long one are
          scored on different totals. */}
      <div className="stage-in flex flex-col gap-2" style={{ ["--i" as string]: 1 }}>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span
            className={`font-mono text-[clamp(3rem,2rem+4vw,5rem)] font-bold leading-none tabular-nums ${band.ink}`}
          >
            +{earned.toLocaleString()}
          </span>
          <span className="font-mono text-[1.125rem] tabular-nums text-ink-faint">
            of {possible.toLocaleString()}
          </span>
        </div>

        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span
            style={NARROW}
            className={`font-sans text-[0.75rem] font-bold uppercase tracking-[0.14em] ${band.ink}`}
          >
            {band.note}
          </span>
          {best !== null && (
            <span className="font-mono text-[0.8125rem] tabular-nums text-ink-faint">
              {beatBest ? "new best, was" : "best"} +{best.rating.toLocaleString()}
            </span>
          )}
        </p>
      </div>

      <div className="stage-in flex flex-wrap items-center gap-3" style={{ ["--i" as string]: 2 }}>
        <PrimaryButton onClick={onRestart}>
          Run it again <Arrow />
        </PrimaryButton>
        <GhostButton onClick={onRestart}>Study something else</GhostButton>
      </div>

      {/* The door. Closed on arrival, and it names what is behind it. */}
      <details className="stage-in group" style={{ ["--i" as string]: 3 }}>
        <summary
          style={NARROW}
          className="inline-flex cursor-pointer list-none items-center gap-2 rounded-[3px] font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-ink-soft transition-colors hover:text-ink"
        >
          <span aria-hidden className="inline-block transition-transform group-open:rotate-90">
            ›
          </span>
          How each concept went
        </summary>

        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-wrap gap-x-10 gap-y-4">
            <Figure value={formatClock(data.runTime)} label="Run time" />
            {data.open && (
              <Figure
                value={`${data.open.correct}/${data.open.answered}`}
                label="Warm up, on instinct"
              />
            )}
            {produced && (
              <Figure
                value={`${demonstrated}/${data.productions.length}`}
                label="Explained in your own words"
              />
            )}
          </div>

          <ol className="max-h-[27vh] divide-y divide-line overflow-y-auto rounded-[3px] border border-line bg-page">
            {data.concepts.map((line) => {
              const s = standing(line);
              return (
                <li key={line.concept} className="flex items-center gap-3 px-4 py-3">
                  <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${s.mark}`} />
                  <span className="min-w-0 flex-1 font-read text-[1.0625rem] leading-snug text-ink">
                    {line.concept}
                  </span>
                  <span
                    className={`shrink-0 font-sans text-[0.8125rem] font-semibold ${s.ink}`}
                  >
                    {s.word}
                  </span>
                </li>
              );
            })}
          </ol>

          <p className="font-sans text-[0.75rem] leading-[1.6] text-ink-faint">
            <span title="Later rounds are worth more than earlier ones because the help comes away as you climb, and Round 4 is worth the most because nothing was on screen at all.">
              The rating counts every answer, weighted by how little help you had. Speed is not part
              of it.
            </span>{" "}
            {runs > 1 && <>{runs} runs this tab. </>}
            {provenance === "generated" && (
              <span title="Paste notes next time and every question arrives with the line it came from, checked word for word on the server.">
                Written by an AI model from your topic, not your own material.{" "}
              </span>
            )}
            <span title="There are no accounts yet, so there is nowhere honest to keep it.">
              Nothing is saved.
            </span>
          </p>
        </div>
      </details>
    </section>
  );
}
