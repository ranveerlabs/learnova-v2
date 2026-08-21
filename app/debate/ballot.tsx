"use client";

import type { Book } from "../standing";
import { Record } from "../tally";
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

/* The ballot.

   ── What this screen is for, and what it was doing instead ───────────────
   Somebody who has just finished a round wants three things, in this order:
   did I win, what does that make my record, and what do I do differently
   next time. This screen used to answer all three and then keep going, into ten
   dimension scores across two columns, a speaker points figure, a strongest
   line, a weakest line, and a closing paragraph about the separation between
   what the model judges and what the app computes. Every one of those was
   accurate. Together they turned the end of a debate into a report.

   The cost was not the scrolling. It was that the one line worth acting on,
   the fix for the next round, sat fifth in a stack of things that all looked
   equally important, and the fastest way to make something unread is to give
   it the same weight as nine things beside it.

   So the face of the ballot is now the decision, the record, and the fix. The
   rest is not gone: it is behind one disclosure, which is the same shape
   Round Mode's results screen settled on for the same reason. A competitive
   debater who wants their speaks is exactly the person who will open a fold
   labelled with them.

   Nothing on this screen is invented here. Every figure came back from the
   judge except the record, which is a count of judgements already made. The
   elo that used to sit under the verdict is gone along with the file that
   computed it; standing.ts says why. */

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
  book,
  setup,
  opponentName,
  onAgain,
  againLabel = "Another round",
}: {
  ballot: Ballot;
  /** The record this round has just been added to, where it was added to one.

      Absent in a live 1v1 room, and absent on purpose rather than pending.
      Nothing about a live room is written down anywhere — not the room, not
      the transcript, not the result — and a record is a thing written down.
      A live round produces a verdict and counts for nothing, which is the
      promise the mode is built on rather than a gap in it. */
  book?: Book;
  setup: Setup;
  /** Who the other side was, for the scoresheet column and the key moments.

      Defaults to the tier's name, which is right for every single-player
      round and wrong for a live one, where the opponent is a person and the
      column should say so. */
  opponentName?: string;
  onAgain: () => void;
  againLabel?: string;
}) {
  const won = ballot.winner === "user";
  const drew = ballot.winner === "draw";
  const opponent = { name: opponentName ?? tier(setup.tierId).name };

  /* The decision, in three channels rather than one.

     It was a coloured heading beside a plain left rule, which is colour doing
     the whole job on the loudest line of the screen. Now the block it sits in
     is washed in the same hue, so the result is legible from the far side of
     a room and from the corner of an eye, and the words still say it on their
     own for anybody the colour does not reach. */
  const word = won ? "You won it" : drew ? "A draw" : "You lost it";
  const ink = won ? "text-solid-ink" : drew ? "text-shaky-ink" : "text-broken-ink";
  const rule = won ? "border-solid-mark" : drew ? "border-shaky-mark" : "border-broken-mark";
  const wash = won ? "bg-solid-tint" : drew ? "bg-shaky-tint" : "bg-broken-tint";

  return (
    <section className="flex w-full flex-col gap-6 pb-4">
      {/* What was argued, on the note it was written on.

          It was a line of grey prose under a label, which is how you set a
          caption and not how you set the subject of the round. The motion is
          the one thing on this screen that is neither a judgement nor a
          number: it is what the student brought, in their own words, and a
          sticky note is exactly the object for a thing somebody wrote down
          before any of this started. It is also the only colour on the screen
          that does not mean anything, which is what keeps it from competing
          with the marks below it. */}
      <div className="flex flex-col gap-3">
        {/* Who you played is only named when it is a tier.

            The line is "Open debate · Novice · For", and it survives the
            opponent's name being swapped for anything except a pronoun. In a
            live room the opponent is "Them", and "Open debate · Them · For"
            reads on sight as *they* were arguing For — a middle dot is not a
            strong enough separator to stop it, and this sits directly above
            the verdict, which is the worst place in the app to leave a
            question about which side was whose. A live round drops the
            segment: there is no tier to name, and the two things left are
            the two things that matter. */}
        <Label>
          {setup.tab === "competitive" ? setup.format : "Open debate"}
          {setup.tierId ? ` · ${opponent.name}` : ""} · {sideWord(setup.side)}
        </Label>
        <div
          className="sticky flex min-h-[7.5rem] w-fit min-w-[11rem] max-w-[20rem] items-start rounded-[2px] pb-6 pl-5 pr-6 pt-5"
          style={{ ["--tilt" as string]: "-1.3deg" }}
        >
          <p className="font-hand text-[1.5rem] leading-[1.15]">{setup.motion}</p>
        </div>
      </div>

      {/* The decision, and what it makes your record.

          There was a phrase after the verdict saying how decisively it went,
          "comfortably" or "on the narrowest of margins". It came from the
          judge's own margin, so it was true, and it was also a second verdict
          sitting beside the first in smaller type, inviting the reader to work
          out how the two related. The margin is still on the ballot, in the
          scoresheet, where a number belongs.

          On a live round there is no record under the verdict, and nothing
          takes its place. The block is the verdict on its own, which is what
          a live round actually produced: see `book` above for why there is
          nothing to count. A greyed-out record, or a "not counted" caption,
          would both be a space set aside for something that is never coming. */}
      {/* Width fits the content rather than the column. Run full bleed, the
          wash was mostly empty colour with a verdict in the corner of it,
          which reads as a banner nobody filled in. */}
      <div
        className={`flex w-fit min-w-[18rem] max-w-full flex-col gap-4 rounded-[3px] border-l-[5px] py-4 pl-4 pr-8 ${rule} ${wash}`}
      >
        {/* Stamped, not set.

            It was the app's own sans at its largest weight, which is a
            heading: correct, legible, and the same object as every other
            heading in the app, on the one line in the mode that is not a
            heading at all. A verdict is a thing pressed onto a ballot at the
            end of a round, so it is drawn as one — the pixel face inside a
            hard ruled box, off-square, arriving from above the screen with a
            bounce. The colour and the wash behind it are unchanged, and the
            words still say it on their own for anybody the colour does not
            reach. See the `stamp` keyframes in globals.css. */}
        <h2
          className={`stamp self-start border-[3px] px-3.5 py-2.5 font-pixel text-[clamp(1.125rem,0.85rem+1.1vw,1.75rem)] leading-none ${rule} ${ink}`}
        >
          {word}
        </h2>

        {/* The record, under the verdict rather than over it: what you have
            played is a consequence of the round and putting it first would
            make it the point. Same component the setup screen draws, so the
            figures somebody leaves with are the figures they come back to. */}
        {book && <Record book={book} />}
      </div>

      {/* The one thing to do differently, and the only piece of the judge's
          written feedback on the face of the screen. It is here rather than in
          the fold because it is the only line that changes what happens next,
          and it is washed for the same reason: on a screen where the verdict
          is a block of colour, an instruction drawn as plain text with a hair
          rule beside it is the quietest thing present and the one thing worth
          acting on. */}
      <div className="flex flex-col gap-1 rounded-[3px] border-l-[4px] border-accent bg-accent-wash py-3 pl-4 pr-4">
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

      {/* Where it turned, told apart by who said it.

          Both speakers used to be the same grey card with the same grey rule,
          separated only by which name the second line opened with, so a
          screen showing three moments read as three quotes from one voice.
          Whose line it was is the first thing you need here: two of your own
          moments is a round you controlled, two of theirs is a round that
          happened to you.

          Yours takes the accent, which is the app's colour for the student's
          own side and is already what marks your speech in the transcript.
          Theirs takes the grey mark family, which is the app's colour for
          absence and is not one of the three judgement hues, so nothing here
          can be misread as a mark on your words. The name still leads the
          second line, so the colour is never carrying it alone. */}
      {ballot.key_moments.length > 0 && (
        <div className="flex flex-col gap-3">
          <Label>Where it turned</Label>
          <ul className="flex flex-col gap-2">
            {ballot.key_moments.map((m, i) => {
              const mine = m.speaker === "user";
              return (
                <li
                  key={i}
                  className={`rounded-[3px] border-l-[4px] px-4 py-3 ${
                    mine ? "border-accent bg-accent-wash" : "border-gap-mark bg-gap-tint"
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
                    </span>{" "}
                    · {m.why_it_mattered}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Back to the top, and it says so anticlockwise. The one thing this
          button must not look like is "next": it goes back to the screen the
          round started on, not on to another part of this one. */}
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

/** Everything a real ballot has that a person does not need to see to know
    how the round went.

    Closed by default and named by what is inside it, so the two people who
    open it can tell from the summary that it is their door: a competitive
    debater looking for their speaks, and anybody who wants to know which
    dimension actually lost them the round. */
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
        <span aria-hidden className="inline-block transition-transform group-open:rotate-90">
          ›
        </span>
        {setup.tab === "competitive" ? "Speaks and the full scoresheet" : "The full scoresheet"}
      </summary>

      <div className="mt-4 flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          {/* No "How it was scored" heading over this. The fold it is inside
              is called "the full scoresheet" and opening it is what put the
              scoresheet on screen; a heading repeating the word is a line to
              read that says nothing the click did not. */}
          {/* Speaker points, on the tournament ballot only.

              They are the most recognisable thing on a real ballot and the
              first number a competitive debater looks for. They are worked
              out here from the five dimension scores the judge already gave,
              in the spirit the rest of this file works in: the model is
              asked for the judgements it can actually make and never for a
              number on a scale it has no feel for. A model asked directly for speaker
              points returns 28.5 almost every time, because 28.5 is what the
              internet says the average is, and a figure that never moves is
              not a measurement. */}
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
          <Note kind="Strongest" said={ballot.feedback.biggest_strength} tone="solid" />
          <Note kind="Weakest" said={ballot.feedback.biggest_weakness} tone="broken" />
        </div>
      </div>
    </details>
  );
}

/** Speaker points, on the 25 to 30 scale a real ballot uses.

    The mean of the five dimensions, mapped so that 50 out of 100 lands on
    27.5, which is what an average round is actually given, and reported to
    the nearest half point because that is the resolution tournaments use.
    Arithmetic on judgements already made: nothing here is a call the model
    was not already asked for. */
function speakerPoints(scores: Scores): number {
  const mean = DIMENSIONS.reduce((sum, d) => sum + scores[d], 0) / DIMENSIONS.length;
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
    <div className="overflow-hidden rounded-[3px] border border-line">
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
        {/* Wide enough for the longest tier name at this tracking. It was
            twelve and clipped "Varsity" to "Varsi…", which named the column
            after nothing. */}
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

function Note({ kind, said, tone }: { kind: string; said: string; tone: "solid" | "broken" }) {
  const rule = tone === "solid" ? "border-solid-mark" : "border-broken-mark";
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
