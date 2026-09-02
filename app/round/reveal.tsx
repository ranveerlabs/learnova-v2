"use client";

import { useState } from "react";
import {
  conceptStanding,
  formatClock,
  type Reveal as RevealData,
  type Standing,
} from "./engine";
import { Arrow, GhostButton, PrimaryButton } from "../ui";
import { conceptKey, forget } from "./record";
import type { Provenance } from "./types";

const NARROW: React.CSSProperties = { fontVariationSettings: '"wdth" 88' };

// 5 standings, 3 words
const SHOWN: Record<Standing, { word: string; ink: string; mark: string }> = {
  explained: {
    word: "Explained it",
    ink: "text-solid-ink",
    mark: "bg-solid-mark",
  },
  almost: { word: "Almost", ink: "text-shaky-ink", mark: "bg-shaky-mark" },
  "not-yet": {
    word: "Not yet",
    ink: "text-broken-ink",
    mark: "bg-broken-mark",
  },
  recognised: {
    word: "Got it right",
    ink: "text-solid-ink",
    mark: "bg-solid-mark",
  },
  missed: { word: "Not yet", ink: "text-broken-ink", mark: "bg-broken-mark" },
};

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
  previously,
  droppedTotal,
  sampled,
  onAgain,
  onRestart,
}: {
  data: RevealData;
  topic: string;
  provenance: Provenance;
  droppedTotal: number;
  sampled: { kept: number; total: number } | null;
  best: { rating: number } | null;
  previously: Record<string, Standing>;
  onAgain: () => void;
  onRestart: () => void;
}) {
  const produced = data.productions.length > 0;
  const said = data.productions.filter((p) => p.outcome === "solid").length;
  const { score } = data.rating;
  const band = BAND[data.rating.band];
  const pb = best !== null && score > best.rating;

  // could not explain it last time, can now. needs a previous run to mean anything
  const nowExplained = data.concepts.filter((l) => {
    if (conceptStanding(l) !== "explained") return false;
    const was = previously[conceptKey(l.concept)];
    return was !== undefined && was !== "explained";
  });

  const [forgotten, setForgotten] = useState(false);

  return (
    <section className="mx-auto flex w-full max-w-[52rem] flex-col gap-6 py-2">
      <div className="stage-in flex flex-col gap-4">
        <div
          className="sticky flex min-h-[6.5rem] w-fit min-w-[10rem] max-w-[18rem] items-start self-start pb-5 pl-4 pr-6 pt-4"
          style={{
            ["--tilt" as string]: "-1.6deg",
            ["--sticky-paper" as string]: "var(--supply-mint)",
          }}
        >
          <p className="font-hand text-[1.375rem] leading-[1.15]">{topic}</p>
        </div>

        <h2 className="max-w-[24ch] text-balance font-read text-[clamp(1.5rem,1.2rem+1.5vw,2.125rem)] leading-[1.1] tracking-[-0.02em] text-ink">
          {produced
            ? "You started by recognising. You finished by explaining."
            : "You started by recognising."}
        </h2>
      </div>

      <div
        className={`stage-in flex w-fit min-w-[16rem] max-w-full flex-col gap-2 border-l-[5px] py-4 pl-4 pr-8 ${band.rule} ${band.wash}`}
        style={{ ["--i" as string]: 1 }}
      >
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span
            className={`font-mono text-[clamp(3rem,2rem+4vw,5rem)] font-bold leading-none tabular-nums ${band.ink}`}
          >
            {score}
          </span>
          <span className="font-mono text-[1.125rem] tabular-nums text-ink-faint">
            out of 10
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
              {pb ? "new best, was" : "best"} {best.rating}
            </span>
          )}
        </p>
      </div>

      {provenance === "generated" ? (
        <p
          className="stage-in -mt-3 font-sans text-[0.8125rem] leading-[1.55] text-ink-faint"
          style={{ ["--i" as string]: 2 }}
          title="Paste notes next time and every question arrives with the line it came from, checked word for word on the server."
        >
          Nothing in this run was checked against a source. You gave a topic, so
          an AI model wrote the questions and marked the answers from its own
          knowledge.
        </p>
      ) : (
        (droppedTotal > 0 || sampled) && (
          <p
            className="stage-in -mt-3 font-sans text-[0.8125rem] leading-[1.55] text-ink-faint"
            style={{ ["--i" as string]: 2 }}
            title="Every question in a grounded session has to quote your material word for word. The quote is checked on the server before the question is served, and anything that cannot be found is dropped rather than shown to you."
          >
            Every question came from your notes.{""}
            {droppedTotal > 0 && (
              <>
                {droppedTotal === 1
                  ? "One more was written and dropped: its quote"
                  : `${droppedTotal} more were written and dropped: their quotes`}
                {""}
                could not be found in your material.{""}
              </>
            )}
            {sampled && (
              <>
                Your material was long, so the questions were written from an
                even spread of it:{""}
                {sampled.kept} passages out of {sampled.total}.
              </>
            )}
          </p>
        )
      )}

      {nowExplained.length > 0 && (
        <div
          className="stage-in flex flex-col gap-2 border-l-[3px] border-solid-mark bg-solid-tint py-3 pl-4 pr-4"
          style={{ ["--i" as string]: 3 }}
        >
          <span
            style={NARROW}
            className="font-sans text-[0.625rem] font-bold uppercase tracking-[0.14em] text-solid-ink"
          >
            Could not explain this before
          </span>
          <ul className="flex flex-wrap gap-2">
            {nowExplained.map((l, i) => (
              <li
                key={l.concept}
                style={{ ["--i" as string]: i }}
                className="split-land bg-page px-2.5 py-1 font-read text-[0.9375rem] text-solid-ink"
              >
                {l.concept}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div
        className="stage-in flex flex-wrap items-center gap-3"
        style={{ ["--i" as string]: 4 }}
      >
        <PrimaryButton onClick={onAgain}>
          Run it again <Arrow />
        </PrimaryButton>
        <GhostButton onClick={onRestart}>Study something else</GhostButton>
      </div>

      <details className="stage-in group" style={{ ["--i" as string]: 5 }}>
        <summary
          style={NARROW}
          className="inline-flex cursor-pointer list-none items-center gap-2 font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-ink-soft transition-colors hover:text-ink"
        >
          <span
            aria-hidden
            className="inline-block transition-transform group-open:rotate-90"
          >
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
                value={`${said}/${data.productions.length}`}
                label="Explained in your own words"
              />
            )}
          </div>

          <ol className="max-h-[27vh] divide-y divide-line overflow-y-auto border border-line bg-page">
            {data.concepts.map((l) => {
              const c = SHOWN[conceptStanding(l)];
              return (
                <li
                  key={l.concept}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <span
                    aria-hidden
                    className={`h-2.5 w-2.5 shrink-0 ${c.mark}`}
                  />
                  <span className="min-w-0 flex-1 font-read text-[1.0625rem] leading-snug text-ink">
                    {l.concept}
                  </span>
                  <span
                    className={`shrink-0 font-sans text-[0.8125rem] font-semibold ${c.ink}`}
                  >
                    {c.word}
                  </span>
                </li>
              );
            })}
          </ol>

          <p className="font-sans text-[0.75rem] leading-[1.6] text-ink-faint">
            {forgotten ? (
              "Forgotten."
            ) : (
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
