"use client";

import type { Book } from "./standing";

/* What you have played, drawn.

   This is what is left where the elo badge used to be, and it is deliberately
   about a tenth of it. The badge had a rung name, a fill rail, a distance to
   the next rung, a delta chip and a seven-row ladder behind a disclosure,
   because a bare elo means nothing without a scale and all of that was the
   scale. A record needs none of it: twelve and seven is twelve and seven, and
   the only thing a reader has to know to understand it is what a debate is.

   One component for both modes, for the reason the one number had: a person
   should recognise the same object wherever they meet it. What differs is the
   vocabulary, because the two activities are not the same and only one of them
   has a winner. See `Book` in standing.ts. */

const NARROW: React.CSSProperties = { fontVariationSettings: '"wdth" 88' };

/** A figure and what it is a figure of, in the shape the elo left behind:
    the number large enough to read at a glance, the word beside it small.

    ── Why the figures are not coloured ─────────────────────────────────────
    Won in green, lost in the broken-mark magenta and drawn in amber was the
    obvious first pass and it was wrong twice over. It is illegible: on the
    ballot this block sits inside the verdict's own wash, so a magenta "6"
    lands on a green field after a win and a green "12" lands on a magenta one
    after a loss, and one of the three numbers is always the hardest thing on
    the screen to read.

    It is also the wrong claim. Those three hues are the marking palette —
    they mean solid, shaky and broken on a student's own words — and a
    debate you lost is not an error in your writing. The words won, lost and
    drawn are already unambiguous, and the one thing on this screen that is
    allowed to be a colour is the verdict. */
function Figure({
  value,
  label,
  title,
}: {
  value: string;
  label: string;
  title?: string;
}) {
  return (
    <span className="inline-flex items-baseline gap-2" title={title}>
      <span className="font-pixel text-[1.375rem] leading-none tabular-nums text-ink">
        {value}
      </span>
      <span
        style={NARROW}
        className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-ink-faint"
      >
        {label}
      </span>
    </span>
  );
}

/** The debate record: won, lost, and drawn only when there are any.

    Drawn is hidden at zero rather than printed as a nought. Most people never
    draw a round, and a permanent "0 D" on the end teaches everybody who does
    not that the app is keeping a column for something that does not happen to
    them. It appears the first time it is true.

    Nothing here is a rating and nothing on the screen calls it one. The
    tooltip says where the figures came from, which is the whole of the
    accounting now: there is no formula behind them to explain. */
export function Record({ book }: { book: Book }) {
  if (book.debates === 0) {
    return (
      <p className="font-sans text-[0.875rem] leading-[1.6] text-ink-faint">
        No debates yet. The first one is judged the same as the hundredth.
      </p>
    );
  }

  const rounds = `${book.debates} ${book.debates === 1 ? "debate" : "debates"} on this device`;

  return (
    <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
      <Figure value={String(book.won)} label="won" title={rounds} />
      <Figure value={String(book.lost)} label="lost" title={rounds} />
      {book.drawn > 0 && (
        <Figure value={String(book.drawn)} label="drawn" title={rounds} />
      )}
    </div>
  );
}

/** The Round Mode tally, in Round Mode's own words.

    A run has no opponent and cannot be won, so this counts the band the
    results screen already names rather than pretending otherwise: how many of
    the runs finished on this device were strong ones. The threshold is not
    set here — it is `buildReveal`'s, the same one that colours the figure at
    the top of the screen. */
export function Runs({ book }: { book: Book }) {
  if (book.runs === 0) return null;

  return (
    <Figure
      value={`${book.strong}/${book.runs}`}
      label="strong runs"
      title={`${book.runs} ${book.runs === 1 ? "run" : "runs"} finished on this device, ${book.strong} of them in the strong band.`}
    />
  );
}
