"use client";

import type { RatingChange } from "@/lib/elo";
import { Arrow, Label, PrimaryButton } from "../ui";
import { type Ballot, DIMENSIONS, type Dimension, type Setup, type Scores, tier } from "./types";

/* The ballot.

   Written the way a real one reads: the decision, then the reason, then the
   numbers, then the one thing to fix. The rating change is beside the
   decision rather than above it, because a rating is a consequence of the
   round and putting it first would make it the point.

   Nothing on this screen is invented here. Every figure came back from the
   judge except the rating, which was computed in `lib/elo.ts` from the rating
   already held and the tier's declared strength. */

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
  change,
  setup,
  onAgain,
}: {
  ballot: Ballot;
  change: RatingChange;
  setup: Setup;
  onAgain: () => void;
}) {
  const won = ballot.winner === "user";
  const drew = ballot.winner === "draw";
  const opponent = tier(setup.tierId);

  const word = won ? "You won it" : drew ? "A draw" : "You lost it";
  const ink = won ? "text-solid-ink" : drew ? "text-shaky-ink" : "text-broken-ink";
  const rule = won ? "border-solid-mark" : drew ? "border-shaky-mark" : "border-broken-mark";

  /* Rounded to whole percent, because a rating system that reports what it
     expected to three decimal places is claiming a precision it does not
     have about a judge that is not that consistent. */
  const chance = Math.round(change.expected * 100);

  return (
    <section className="mx-auto flex w-full max-w-[52rem] flex-col gap-6 py-4">
      <div className="flex flex-col gap-2">
        <Label>
          {setup.tab === "competitive" ? setup.format : "Open debate"} · {opponent.name} ·{" "}
          {setup.side}
        </Label>
        <p className="font-read text-[1.0625rem] leading-snug text-ink-soft">{setup.motion}</p>
      </div>

      {/* The decision, and how decisively. The margin is shown as words rather
          than as "7/10": it is the judge's confidence, and a bare number
          invites it to be read as a score. */}
      <div className={`flex flex-col gap-3 border-l-[5px] pl-4 ${rule}`}>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h2
            style={NARROW}
            className={`font-sans text-[clamp(1.5rem,1.2rem+1.4vw,2.25rem)] font-bold uppercase tracking-[0.06em] ${ink}`}
          >
            {word}
          </h2>
          <span className="font-sans text-[0.875rem] text-ink-soft">{decisiveness(ballot.margin)}</span>
        </div>

        {/* The rating, and what it was up against. "Expected" is the whole
            content of a rating change: moving from 1200 to 1216 says nothing
            on its own, and "you were given a 31% chance and took it" says all
            of it. */}
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-mono text-[1.75rem] font-bold tabular-nums leading-none text-ink">
            {change.after}
          </span>
          <span
            className={`font-mono text-[1rem] font-semibold tabular-nums ${
              change.delta > 0 ? "text-solid-ink" : change.delta < 0 ? "text-broken-ink" : "text-ink-faint"
            }`}
          >
            {change.delta > 0 ? "+" : ""}
            {change.delta}
          </span>
          <span className="font-sans text-[0.8125rem] text-ink-faint">
            against {opponent.name} at {opponent.rating}, where you were given a {chance}% chance
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Label>How it was scored</Label>
        <Table user={ballot.scores.user} opponent={ballot.scores.opponent} opponentName={opponent.name} />
      </div>

      {ballot.key_moments.length > 0 && (
        <div className="flex flex-col gap-3">
          <Label>Where it turned</Label>
          <ul className="flex flex-col gap-2">
            {ballot.key_moments.map((m, i) => (
              <li
                key={i}
                className={`rounded-[3px] border-l-[3px] bg-sunk/50 px-3.5 py-2.5 ${
                  m.speaker === "user" ? "border-accent" : "border-line-strong"
                }`}
              >
                <p className="font-read text-[1rem] leading-[1.5] text-ink">
                  &ldquo;{m.quote_paraphrase}&rdquo;
                </p>
                <p className="mt-1 font-sans text-[0.8125rem] leading-[1.5] text-ink-soft">
                  {m.speaker === "user" ? "You" : opponent.name} · {m.why_it_mattered}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <Note kind="Strongest" said={ballot.feedback.biggest_strength} tone="solid" />
        <Note kind="Weakest" said={ballot.feedback.biggest_weakness} tone="broken" />
        <Note kind="Next round, fix this" said={ballot.feedback.one_fix_for_next_round} tone="accent" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <PrimaryButton onClick={onAgain}>
          Another round <Arrow />
        </PrimaryButton>
      </div>

      <p className="font-sans text-[0.75rem] leading-[1.6] text-ink-faint">
        <span title="The judge returns a winner, a margin and the dimension scores. The rating is worked out in the app from the rating you already had and the opponent tier's declared strength.">
          The rating is arithmetic, not a judgement: the model decides who won and by how much,
          and nothing else.
        </span>{" "}
        <span title="A model judging the same round twice does not always agree with itself, most often when the round was close.">
          A close round is a close call, and the margin is what keeps one from moving your rating
          as far as a blowout.
        </span>{" "}
        Kept in this browser only.
      </p>
    </section>
  );
}

/** How decisive, in words. The judge's 1 to 10 drives the rating; this is the
    same figure said in a way somebody can act on. */
function decisiveness(margin: number): string {
  if (margin <= 2) return "on the narrowest of margins";
  if (margin <= 4) return "clearly, but it was close";
  if (margin <= 7) return "comfortably";
  return "decisively";
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
    <div className="overflow-hidden rounded-[3px] border border-line">
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 border-b border-line bg-sunk/60 px-3.5 py-2">
        <span style={NARROW} className="font-sans text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-ink-faint">
          Dimension
        </span>
        <span style={NARROW} className="w-10 text-right font-sans text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-ink-faint">
          You
        </span>
        {/* Wide enough for the longest tier name at this tracking. It was
            twelve and clipped "Varsity" to "Varsi…", which named the column
            after nothing. */}
        <span style={NARROW} className="w-[4.5rem] text-right font-sans text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-ink-faint">
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
            <span className="font-sans text-[0.875rem] text-ink">{LABEL[d]}</span>
            <span
              className={`w-10 text-right font-mono text-[0.875rem] font-semibold tabular-nums ${
                ahead ? "text-solid-ink" : behind ? "text-broken-ink" : "text-ink"
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
  tone: "solid" | "broken" | "accent";
}) {
  const rule =
    tone === "solid" ? "border-solid-mark" : tone === "broken" ? "border-broken-mark" : "border-accent";
  return (
    <div className={`flex flex-col gap-1 border-l-[3px] pl-3.5 ${rule}`}>
      <span
        style={NARROW}
        className="font-sans text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-ink-faint"
      >
        {kind}
      </span>
      <p className="font-read text-[1.0625rem] leading-[1.5] text-ink">{said}</p>
    </div>
  );
}
