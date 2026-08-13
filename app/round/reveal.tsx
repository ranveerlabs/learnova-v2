"use client";

import { useState } from "react";
import type { RatingChange } from "@/lib/elo";
import { conceptStanding, formatClock, type Reveal as RevealData, type Standing } from "./engine";
import { Elo } from "../elo";
import { Arrow, GhostButton, PrimaryButton } from "../ui";
import { conceptKey, forget } from "./record";
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

/** How each standing is drawn. The classification itself is `conceptStanding`
    in engine.ts, because the record keeps the same vocabulary between runs and
    two copies of that judgement would eventually disagree about what a student
    had achieved. This table is only the words and the colours. */
const SHOWN: Record<Standing, { word: string; ink: string; mark: string }> = {
  explained: { word: "Explained it", ink: "text-solid-ink", mark: "bg-solid-mark" },
  almost: { word: "Almost", ink: "text-shaky-ink", mark: "bg-shaky-mark" },
  "not-yet": { word: "Not yet", ink: "text-broken-ink", mark: "bg-broken-mark" },
  recognised: { word: "Got it right", ink: "text-solid-ink", mark: "bg-solid-mark" },
  missed: { word: "Not yet", ink: "text-broken-ink", mark: "bg-broken-mark" },
};

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

/* The rating's three bands.

   Colour is the fast channel and the word beside it is the one that survives
   not being able to see the colour. The wash and the rule are new: the number
   used to be coloured type on the page background, which is a lot of weight
   to hang on the hue of a glyph, and it left the two numbers on this screen,
   the run and the elo, looking like one stack of figures. The run sits in a
   card of its own now, in its own colour; the elo sits plainly underneath.
   Same treatment as the verdict on the debate ballot, on purpose. */
const BAND: Record<
  RevealData["rating"]["band"],
  { ink: string; rule: string; wash: string; note: string }
> = {
  strong: {
    ink: "text-solid-ink",
    rule: "border-solid-mark",
    wash: "bg-solid-tint",
    note: "Strong run",
  },
  fair: {
    ink: "text-shaky-ink",
    rule: "border-shaky-mark",
    wash: "bg-shaky-tint",
    note: "Some of it landed",
  },
  weak: {
    ink: "text-broken-ink",
    rule: "border-broken-mark",
    wash: "bg-broken-tint",
    note: "Worth another run",
  },
};

export function Reveal({
  data,
  topic,
  provenance,
  best,
  elo,
  previously,
  runs,
  onAgain,
  onRestart,
}: {
  data: RevealData;
  topic: string;
  provenance: Provenance;
  /** The best rating on THIS topic, from the record, when there is one. */
  best: { rating: number } | null;
  /** What this run did to the app-wide elo. Null if storage refused it. */
  elo: RatingChange | null;
  /** Where each concept stood before this run, keyed as the record keys them.
      Empty on a first visit, which is what makes "moved" sayable at all. */
  previously: Record<string, Standing>;
  runs: number;
  /** Same topic, new questions. */
  onAgain: () => void;
  /** Back to the entry screen for something else. */
  onRestart: () => void;
}) {
  const produced = data.productions.length > 0;
  const demonstrated = data.productions.filter((p) => p.outcome === "solid").length;
  const { earned, possible } = data.rating;
  const band = BAND[data.rating.band];
  const beatBest = best !== null && earned > best.rating;

  /* What this run changed, against where the last one left off.

     Only in one direction and only over the line that matters: a concept the
     student could not say before and just said. Recognition improving is not
     in here, and neither is anything sliding backwards. This is the sentence
     the whole record exists to make sayable, and it is worth exactly as much
     as it is rare, so it is not padded out with movement that did not happen. */
  const nowExplained = data.concepts.filter((line) => {
    if (conceptStanding(line) !== "explained") return false;
    const before = previously[conceptKey(line.concept)];
    return before !== undefined && before !== "explained";
  });

  const [forgotten, setForgotten] = useState(false);

  return (
    <section className="mx-auto flex w-full max-w-[52rem] flex-col gap-6 py-2">
      {/* The topic, on the note it was written on.

          It was an uppercase grey label, which is how you tag a section and
          not how you name the thing a person just spent ten minutes on. Same
          argument as the motion on the debate ballot, and deliberately the
          same object: the topic is what the student brought and typed
          themselves, it is neither a judgement nor a number, and it is the
          one piece of colour on this screen that does not mean anything. That
          is what keeps it clear of the marks below, where colour is the whole
          vocabulary. */}
      <div className="stage-in flex flex-col gap-4">
        <div
          className="sticky flex min-h-[6.5rem] w-fit min-w-[10rem] max-w-[18rem] items-start self-start rounded-[2px] pb-5 pl-4 pr-6 pt-4"
          style={{ ["--tilt" as string]: "-1.6deg", ["--sticky-paper" as string]: "var(--supply-mint)" }}
        >
          <p className="font-hand text-[1.375rem] leading-[1.15]">{topic}</p>
        </div>

        <h2 className="max-w-[24ch] text-balance font-read text-[clamp(1.5rem,1.2rem+1.5vw,2.125rem)] leading-[1.1] tracking-[-0.02em] text-ink">
          {produced
            ? "You started by recognising. You finished by explaining."
            : "You started by recognising."}
        </h2>
      </div>

      {/* The rating, and what it is out of. The denominator is not decoration:
          a bare "+740" says nothing when a short session and a long one are
          scored on different totals. */}
      <div
        className={`stage-in flex w-fit min-w-[16rem] max-w-full flex-col gap-2 rounded-[3px] border-l-[5px] py-4 pl-4 pr-8 ${band.rule} ${band.wash}`}
        style={{ ["--i" as string]: 1 }}
      >
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

      {/* The app-wide elo, and what this run did to it.

          Two numbers on one screen is a risk, and they are kept apart on
          purpose: the big one above is what this session was worth out of
          what it could have been, and it resets every run. This one carries
          across every run and every debate, and it is the only figure in the
          app that answers "am I getting better at this" rather than "how did
          that go". The rung and the rail are what keep them from being read
          as two versions of the same thing.

          Absent rather than zeroed when storage refused the write, because a
          rating that silently reports 0 is worse than one that is not there. */}
      {elo && (
        <div className="stage-in" style={{ ["--i" as string]: 2 }}>
          <Elo
            rating={elo.after}
            delta={elo.delta}
            title="One elo across Round Mode and Debate, kept in this browser. A run is rated against how hard the material it served you was, so a long easy session moves it very little. Studying can carry it to the top of Sharp; the rungs above that are earned in a debate."
          />
        </div>
      )}

      {/* The one thing a returning student came back to find out.

          It sits above the buttons rather than inside the disclosure, because
          it is the only claim on this screen that could not be made at all
          before a run left anything behind, and because "you could not say
          this last week and you just did" is worth more to somebody than any
          number on the page. It appears when it is true and not otherwise. */}
      {nowExplained.length > 0 && (
        <div
          className="stage-in flex flex-col gap-2 rounded-[3px] border-l-[3px] border-solid-mark bg-solid-tint py-3 pl-4 pr-4"
          style={{ ["--i" as string]: 3 }}
        >
          <span
            style={NARROW}
            className="font-sans text-[0.625rem] font-bold uppercase tracking-[0.14em] text-solid-ink"
          >
            Could not explain this before
          </span>
          <ul className="flex flex-wrap gap-2">
            {nowExplained.map((line, i) => (
              <li
                key={line.concept}
                style={{ ["--i" as string]: i }}
                className="split-land rounded-[3px] bg-page px-2.5 py-1 font-read text-[0.9375rem] text-solid-ink"
              >
                {line.concept}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Two ways out, and now they do two different things.

          They were both wired to the one reset, which banked the run and
          dropped the student on the entry screen with an empty field, so the
          button that said it would repeat the topic was the button that threw
          it away. `again` in session.ts is the behaviour that label always
          claimed: same topic, new questions, straight into the warm up. */}
      <div className="stage-in flex flex-wrap items-center gap-3" style={{ ["--i" as string]: 4 }}>
        <PrimaryButton onClick={onAgain}>
          Run it again <Arrow />
        </PrimaryButton>
        <GhostButton onClick={onRestart}>Study something else</GhostButton>
      </div>

      {/* The door. Closed on arrival, and it names what is behind it. */}
      <details className="stage-in group" style={{ ["--i" as string]: 5 }}>
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
              const s = SHOWN[conceptStanding(line)];
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
            {/* This used to read "Nothing is saved", and it was true until a
                run started leaving something behind. What replaced it says
                exactly what is kept and exactly where, because the difference
                between "on this device" and "in your account" is the whole of
                what a student needs to know to predict whether their progress
                will be there tomorrow, and there is still no account. */}
            <span title="A concept name and how it went, in this browser's local storage. Your answers and anything you wrote are not kept and never leave the page.">
              {forgotten
                ? "Forgotten. This topic starts fresh next time."
                : "Which concepts you have explained is kept in this browser, so the next run on this topic can open on the ones you have not. Nothing you wrote is kept, and none of it leaves this device."}
            </span>{" "}
            {!forgotten && (
              <button
                onClick={() => {
                  forget(topic);
                  setForgotten(true);
                }}
                className="underline decoration-ink-faint/40 underline-offset-4 hover:text-ink-soft hover:decoration-ink-soft"
              >
                Forget {topic}
              </button>
            )}
          </p>
        </div>
      </details>
    </section>
  );
}
