"use client";

import { Label, PrimaryButton } from "../ui";
import {
  type Ballot,
  DIMENSIONS,
  type Dimension,
  type Setup,
  type Scores,
  sideWord,
  tier,
} from "./types";

const NARROW: React.CSSProperties = { fontVariationSettings: '"wdth" 88' };

const LABEL: Record<Dimension, string> = {
  logic: "Logic",
  evidence: "Evidence",
  rebuttal: "Rebuttal",
  structure: "Structure",
  clarity: "Clarity",
};

export function Ballot({
  ballot,
  setup,
  opponentName,
  onAgain,
  againLabel = "Another round",
}: {
  ballot: Ballot;
  setup: Setup;
  opponentName?: string;
  onAgain: () => void;
  againLabel?: string;
}) {
  const won = ballot.winner === "user";
  const drew = ballot.winner === "draw";
  const opponent = { name: opponentName ?? tier(setup.tierId).name };

  const word = won ? "You won it" : drew ? "A draw" : "You lost it";
  const ink = won
    ? "text-solid-ink"
    : drew
      ? "text-shaky-ink"
      : "text-broken-ink";
  const rule = won
    ? "border-solid-mark"
    : drew
      ? "border-shaky-mark"
      : "border-broken-mark";
  const wash = won
    ? "bg-solid-tint"
    : drew
      ? "bg-shaky-tint"
      : "bg-broken-tint";

  return (
    <section className="flex w-full flex-col gap-6 pb-4">
      <div className="flex flex-col gap-3">
        <Label>
          {setup.tab === "competitive" ? setup.format : "Open debate"}
          {setup.tierId ? ` · ${opponent.name}` : ""} · {sideWord(setup.side)}
        </Label>
        <div
          className="sticky flex min-h-[7.5rem] w-fit min-w-[11rem] max-w-[20rem] items-start pb-6 pl-5 pr-6 pt-5"
          style={{ ["--tilt" as string]: "-1.3deg" }}
        >
          <p className="font-hand text-[1.5rem] leading-[1.15]">
            {setup.motion}
          </p>
        </div>
      </div>

      <div
        className={`flex w-fit min-w-[18rem] max-w-full flex-col gap-4 border-l-[5px] py-4 pl-4 pr-8 ${rule} ${wash}`}
      >
        <h2
          className={`stamp self-start border-[3px] px-3.5 py-2.5 font-pixel text-[clamp(1.125rem,0.85rem+1.1vw,1.75rem)] leading-none ${rule} ${ink}`}
        >
          {word}
        </h2>
      </div>

      <div className="flex flex-col gap-1 border-l-[4px] border-accent bg-accent-wash py-3 pl-4 pr-4">
        <span
          style={NARROW}
          className="font-sans text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-accent"
        >
          Next round, fix this
        </span>
        <p className="font-read text-[1.0625rem] leading-[1.5] text-ink">
          {ballot.feedback.one_fix_for_next_round}
        </p>
      </div>

      {ballot.key_moments.length > 0 && (
        <div className="flex flex-col gap-3">
          <Label>Where it turned</Label>
          <ul className="flex flex-col gap-2">
            {ballot.key_moments.map((m, i) => {
              const mine = m.speaker === "user";
              return (
                <li
                  key={i}
                  className={`border-l-[4px] px-4 py-3 ${
                    mine
                      ? "border-accent bg-accent-wash"
                      : "border-gap-mark bg-gap-tint"
                  }`}
                >
                  <p className="font-read text-[1rem] leading-[1.5] text-ink">
                    &ldquo;{m.quote_paraphrase}&rdquo;
                  </p>
                  <p className="mt-1.5 font-sans text-[0.8125rem] leading-[1.5] text-ink-soft">
                    <span
                      style={NARROW}
                      className={`font-semibold uppercase tracking-[0.1em] ${
                        mine ? "text-accent" : "text-gap-ink"
                      }`}
                    >
                      {mine ? "You" : opponent.name}
                    </span>
                    {""}· {m.why_it_mattered}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <PrimaryButton onClick={onAgain}>
          {againLabel}
          <span aria-hidden className="rewound">
            ↺
          </span>
        </PrimaryButton>
      </div>

      <Detail ballot={ballot} setup={setup} opponentName={opponent.name} />
    </section>
  );
}

function Detail({
  ballot,
  setup,
  opponentName,
}: {
  ballot: Ballot;
  setup: Setup;
  opponentName: string;
}) {
  return (
    <details className="group flex flex-col gap-4 border-t border-line pt-4">
      <summary
        style={NARROW}
        className="inline-flex cursor-pointer list-none items-center gap-1.5 font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-ink-faint transition-colors hover:text-ink-soft"
      >
        <span
          aria-hidden
          className="inline-block transition-transform group-open:rotate-90"
        >
          ›
        </span>
        {setup.tab === "competitive"
          ? "Speaks and the full scoresheet"
          : "The full scoresheet"}
      </summary>

      <div className="mt-4 flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          {setup.tab === "competitive" && (
            <span
              className="self-end font-mono text-[0.8125rem] tabular-nums text-ink-soft"
              title="Derived from the five scores below, on the 25 to 30 scale a tournament ballot uses. Not a sixth number from the judge."
            >
              {speakerPoints(ballot.scores.user).toFixed(1)} speaks
            </span>
          )}
          <Table
            user={ballot.scores.user}
            opponent={ballot.scores.opponent}
            opponentName={opponentName}
          />
        </div>

        <div className="flex flex-col gap-3">
          <Note
            kind="Strongest"
            said={ballot.feedback.biggest_strength}
            tone="solid"
          />
          <Note
            kind="Weakest"
            said={ballot.feedback.biggest_weakness}
            tone="broken"
          />
        </div>
      </div>
    </details>
  );
}

function speakerPoints(scores: Scores) {
  const mean =
    DIMENSIONS.reduce((n, d) => n + scores[d], 0) / DIMENSIONS.length;
  return Math.round((25 + mean / 20) * 2) / 2;
}

function Table({
  user,
  opponent,
  opponentName,
}: {
  user: Scores;
  opponent: Scores;
  opponentName: string;
}) {
  return (
    <div className="overflow-hidden border border-line">
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 border-b border-line bg-sunk/60 px-3.5 py-2">
        <span
          style={NARROW}
          className="font-sans text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-ink-faint"
        >
          Dimension
        </span>
        <span
          style={NARROW}
          className="w-10 text-right font-sans text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-ink-faint"
        >
          You
        </span>
        <span
          style={NARROW}
          className="w-[4.5rem] text-right font-sans text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-ink-faint"
        >
          {opponentName}
        </span>
      </div>
      {DIMENSIONS.map((d) => {
        const ahead = user[d] > opponent[d];
        const behind = user[d] < opponent[d];
        return (
          <div
            key={d}
            className="grid grid-cols-[1fr_auto_auto] gap-x-4 border-b border-line px-3.5 py-2 last:border-b-0"
          >
            <span className="font-sans text-[0.875rem] text-ink">
              {LABEL[d]}
            </span>
            <span
              className={`w-10 text-right font-mono text-[0.875rem] font-semibold tabular-nums ${
                ahead
                  ? "text-solid-ink"
                  : behind
                    ? "text-broken-ink"
                    : "text-ink"
              }`}
            >
              {user[d]}
            </span>
            <span className="w-[4.5rem] text-right font-mono text-[0.875rem] tabular-nums text-ink-soft">
              {opponent[d]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Note({
  kind,
  said,
  tone,
}: {
  kind: string;
  said: string;
  tone: "solid" | "broken";
}) {
  const rule = tone === "solid" ? "border-solid-mark" : "border-broken-mark";
  return (
    <div className={`flex flex-col gap-1 border-l-[3px] pl-3.5 ${rule}`}>
      <span
        style={NARROW}
        className="font-sans text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-ink-faint"
      >
        {kind}
      </span>
      <p className="font-read text-[1.0625rem] leading-[1.5] text-ink">
        {said}
      </p>
    </div>
  );
}
