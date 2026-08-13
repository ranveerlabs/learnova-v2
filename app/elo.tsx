"use client";

import { useId, useState } from "react";
import { nextRank, progress, RANKS, rankFor, STUDY_STOPS_BELOW } from "@/lib/elo";

/* The rating, drawn.

   One component, used by both modes, because the whole argument for merging
   the ratings was that a person should recognise the same number wherever
   they meet it. Two tastefully different treatments of one figure would give
   that back.

   ── What it shows and what it does not ───────────────────────────────────
   The number, the rung it sits on, and how far it is from the next one. No
   sparkline of the last eight results, no win rate on the face of it, no
   badge for the streak. Those all existed as sketches and all of them turned
   the thing into a dashboard, which is the failure mode for a number in a
   study app: the more furniture around it, the more it reads as the point of
   the exercise rather than a consequence of it.

   The rail is the piece worth defending. A bare integer going up is almost
   information-free when nobody knows what good looks like, and the rail
   answers that in one glance without a sentence: this is the rung, that is
   how much of it is behind you.

   ── The ladder, behind the badge ─────────────────────────────────────────
   The face of this shows one rung and the distance to the next, which was the
   whole ladder when there were four rungs and is a keyhole now there are
   seven. A person holding Sharp could not see that Dangerous existed, what it
   took, or how much of the climb was already behind them, and a rating whose
   scale is invisible is a number you are asked to care about on trust.

   So the badge is a button and the ladder is what it opens: all seven rungs,
   what each one means as a win rate rather than a threshold, and a mark on
   the one being stood on. Shut by default, because the ladder is context and
   the rating is the thing; on a results screen it would otherwise be the
   largest object in view. */

/** Per rung: how the number, the badge and the rail are coloured.

    Written out rather than composed from the rank id, because Tailwind reads
    class names as literal text and a template string would compile to nothing
    at all. Every badge is a solid fill with reversed type, which is what lets
    the spectrum run seven steps without any of them being mistaken for the
    marks on a student's words. The ramp itself is in globals.css. */
const INK: Record<1 | 2 | 3 | 4 | 5 | 6 | 7, { text: string; rail: string; badge: string }> = {
  1: { text: "text-rank-1-ink", rail: "bg-rank-1-fill", badge: "bg-rank-1-fill text-on-rank" },
  2: { text: "text-rank-2-ink", rail: "bg-rank-2-fill", badge: "bg-rank-2-fill text-on-rank" },
  3: { text: "text-rank-3-ink", rail: "bg-rank-3-fill", badge: "bg-rank-3-fill text-on-rank" },
  4: { text: "text-rank-4-ink", rail: "bg-rank-4-fill", badge: "bg-rank-4-fill text-on-rank" },
  5: { text: "text-rank-5-ink", rail: "bg-rank-5-fill", badge: "bg-rank-5-fill text-on-rank" },
  6: { text: "text-rank-6-ink", rail: "bg-rank-6-fill", badge: "bg-rank-6-fill text-on-rank" },
  7: { text: "text-rank-7-ink", rail: "bg-rank-7-fill", badge: "bg-rank-7-fill text-on-rank" },
};

const NARROW: React.CSSProperties = { fontVariationSettings: '"wdth" 88' };

export function Elo({
  rating,
  /** How far this result moved it. Omitted where there is no result to show,
      which is everywhere except immediately after one. */
  delta,
  /** Hover text. The record behind the number, phrased by whoever knows it. */
  title,
  size = "normal",
}: {
  rating: number;
  delta?: number;
  title?: string;
  size?: "normal" | "large";
}) {
  const rank = rankFor(rating);
  const ink = INK[rank.id];
  const next = nextRank(rating);
  const filled = progress(rating);

  const [openLadder, setOpenLadder] = useState(false);
  const ladderId = useId();

  return (
    <div className="flex min-w-0 flex-col gap-2" title={title}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span
          className={`font-mono font-bold tabular-nums leading-none ${ink.text} ${
            size === "large" ? "text-[clamp(2.5rem,1.8rem+3vw,4rem)]" : "text-[2rem]"
          }`}
        >
          {rating.toLocaleString()}
        </span>

        <span
          style={NARROW}
          className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-ink-faint"
        >
          elo
        </span>

        {/* What the result just did, as its own object.

            It was a bare "+4" in the same weight as the label beside it, and
            at that size it read as a footnote on the rating rather than as
            the thing the last five minutes earned. It is a chip now, carrying
            the sign, the number and the word, so it reads at a glance and
            cannot be taken for part of the rating beside it.

            Drawn on the page colour with a coloured edge rather than on a
            coloured wash, and that is not a style preference. Both screens
            that show this put it inside a block already washed in the result's
            own hue, so a tinted chip was green on green: the pill vanished
            and left floating text. The page colour is the one background
            guaranteed to differ from whatever it is sitting on.

            The unit is not repeated on it. The chip sits one word away from a
            number already labelled "elo", and "244 elo +4 elo" says the same
            thing twice on one line: the sign and the box are what make it a
            change rather than a second rating.

            Only when it moved. A "+0" is a true statement that reads as the
            app shrugging, and a result that genuinely moves nothing is rare
            enough not to be worth a chip. */}
        {delta !== undefined && delta !== 0 && (
          <span
            className={`rounded-[3px] border bg-page px-2 py-1 font-mono text-[0.9375rem] font-bold tabular-nums ${
              delta > 0
                ? "border-solid-mark text-solid-ink"
                : "border-broken-mark text-broken-ink"
            }`}
          >
            {delta > 0 ? "+" : "−"}
            {Math.abs(delta)}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        {/* The word carries the rung on its own. Everything the colour says,
            this says too, which is what makes the ramp safe to use.

            The top rung gets a sheen across the fill. It is the only rung most
            people will never draw, and a ladder wants its last step to look
            like one. */}
        <button
          type="button"
          onClick={() => setOpenLadder((was) => !was)}
          aria-expanded={openLadder}
          aria-controls={ladderId}
          style={NARROW}
          className={`btn inline-flex items-center gap-1.5 rounded-[3px] px-2 py-[0.1875rem] font-sans text-[0.625rem] font-bold uppercase tracking-[0.14em] ${
            ink.badge
          } ${rank.id === 7 ? "rank-apex" : ""}`}
        >
          {rank.name}
          <span
            aria-hidden
            className={`inline-block text-[0.75em] leading-none transition-transform ${
              openLadder ? "rotate-90" : ""
            }`}
          >
            ›
          </span>
        </button>

        {next && (
          <span className="font-mono text-[0.75rem] tabular-nums text-ink-faint">
            {next.from - rating} to {next.name}
          </span>
        )}
      </div>

      {/* The rung, as a bar. Aria-hidden: it restates the two lines above it
          and a screen reader reading "72 percent" here would be reporting a
          figure that appears nowhere else and means nothing on its own. */}
      <div aria-hidden className="h-[3px] w-full max-w-[16rem] overflow-hidden rounded-full bg-line">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-out ${ink.rail}`}
          style={{ width: `${Math.round(filled * 100)}%` }}
        />
      </div>

      {openLadder && <Ladder id={ladderId} rating={rating} />}
    </div>
  );
}

/** The whole ladder, with a mark on where you are standing.

    Every rung is drawn in its own colour whether you have reached it or not.
    Greying the ones ahead was the first version and it was worse: the point
    of showing somebody Legend is that they can see what it looks like, and a
    row of grey rectangles labelled with words is a list, not a ladder. What
    separates reached from unreached is the opacity of the row and the rule
    down the left of the one you are on, both of which leave the colour alone.

    Highest first, so the thing worth climbing toward is at the top and the
    eye travels down to where you are. */
function Ladder({ id, rating }: { id: string; rating: number }) {
  const here = rankFor(rating);

  /* The highest rung a study run can actually leave you on, which is the one
     BELOW the rung `applyRun` stops short of. Named from the rank table so it
     cannot drift: this line first shipped saying "as far as Dangerous" when
     Dangerous is precisely the rung Round Mode can never reach. */
  const stopsAt = RANKS.findIndex((r) => r.name === STUDY_STOPS_BELOW);
  const studyTop = stopsAt > 0 ? RANKS[stopsAt - 1] : null;

  return (
    <div
      id={id}
      className="settle mt-2 flex w-full max-w-[28rem] flex-col gap-px overflow-hidden rounded-[3px] border border-line bg-page"
    >
      {[...RANKS].reverse().map((rank) => {
        const reached = rating >= rank.from;
        const standing = rank.id === here.id;
        return (
          <div
            key={rank.id}
            className={`flex flex-wrap items-baseline gap-x-2.5 gap-y-1 border-l-[3px] px-3 py-2 ${
              standing ? "border-ink bg-sunk/60" : "border-transparent"
            } ${reached ? "" : "opacity-45"}`}
          >
            <span
              style={NARROW}
              className={`inline-flex shrink-0 items-center rounded-[3px] px-1.5 py-[0.125rem] font-sans text-[0.5625rem] font-bold uppercase tracking-[0.14em] ${
                INK[rank.id].badge
              } ${rank.id === 7 ? "rank-apex" : ""}`}
            >
              {rank.name}
            </span>

            <span className="shrink-0 font-mono text-[0.75rem] tabular-nums text-ink-faint">
              {rank.from}
            </span>

            <span className="min-w-0 font-sans text-[0.75rem] leading-[1.45] text-ink-soft">
              {rank.means}
            </span>

            {/* Says in words what the rule and the wash say in shape, so the
                one row that matters is findable without seeing either. */}
            {standing && (
              <span
                style={NARROW}
                className="ml-auto shrink-0 font-sans text-[0.5625rem] font-bold uppercase tracking-[0.14em] text-ink"
              >
                You
              </span>
            )}
          </div>
        );
      })}

      {/* The two things a person will wonder about the moment they can see the
          whole ladder: why the top half never seems to arrive from studying,
          and whether any of this survives a new laptop. Both are true and
          neither is discoverable, so they are stated rather than left to be
          found out. */}
      <p className="border-t border-line px-3 py-2.5 font-sans text-[0.6875rem] leading-[1.5] text-ink-faint">
        {studyTop ? `Round Mode tops out at ${studyTop.name}. ` : ""}Above that the elo only moves
        in a debate. It is kept in this browser on this device, so clearing site data clears it and
        it does not follow you to another machine.
      </p>
    </div>
  );
}
