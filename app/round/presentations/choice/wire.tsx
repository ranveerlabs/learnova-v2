"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Mark, Pick, Say, Stage, tone, useOptions } from "../kit";
import type { Presentation, PresentationProps } from "../types";

/* Wire connect.

   The question sits on the left as a plug, the candidates on the right, and
   the student drags a wire between them.

   Three ways to connect, all equal, none faster than the others:
   - press 1 to 4
   - click the candidate
   - drag from the plug to anywhere in the candidate's row

   The drag is deliberately forgiving. The drop target is the whole row, the
   wire snaps to whichever row the pointer is over, and releasing anywhere else
   simply cancels. Nothing here can be failed by an unsteady hand.

   ── On saying what to do ─────────────────────────────────────────────────
   This used to say nothing at all. The plug was an unlabelled dot, no wire was
   drawn until one was already being dragged, and the reasoning was that a
   presentation narrating its own metaphor crowds the retrieval.

   That reasoning was right about a person sitting alone who has played it
   before, and wrong about the room this is actually for. Four people are
   watching one screen and the one holding it has never seen a wire board in
   their life; a blue dot beside three boxes is not a puzzle they enjoy
   solving, it is a turn they lose. So the board now says it three ways at
   once, none of which is a paragraph:

   - the plug is labelled, and it is shaped like something you grab
   - a stub of wire hangs off it with its dashes marching towards the options,
     which is what a loose end does
   - one short line above the board names the gesture and the number keys

   The stub points at the options in general and at no option in particular:
   an instruction that leans towards one of the four answers would be a hint,
   and a hint is not what is being added here. */

type Point = { x: number; y: number };

/** A wire with a little slack in it, the way a real one hangs. */
function Wire({
  from,
  to,
  colour,
  dashed,
  width = 3.5,
}: {
  from: Point;
  to: Point;
  colour: string;
  dashed?: boolean;
  width?: number;
}) {
  const dx = Math.max(30, Math.abs(to.x - from.x) * 0.55);
  const sag = Math.min(16, Math.abs(to.y - from.y) * 0.12 + 6);
  const d = `M ${from.x} ${from.y} C ${from.x + dx} ${from.y + sag}, ${to.x - dx} ${
    to.y + sag
  }, ${to.x} ${to.y}`;

  return (
    <>
      <path
        d={d}
        fill="none"
        stroke={colour}
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={dashed ? "7 7" : undefined}
      />
      <circle cx={to.x} cy={to.y} r="5" fill={colour} />
    </>
  );
}

/** The loose end, before anybody has picked it up.

    Hangs off the plug, travels part of the way towards the options and stops
    in mid air with an arrowhead on it. Deliberately short of any single row,
    so it says "over there" without saying "that one". */
function HintWire({ from, reach }: { from: Point; reach: number }) {
  const end = { x: from.x + reach, y: from.y + 9 };
  const d = `M ${from.x} ${from.y} C ${from.x + reach * 0.6} ${from.y + 14}, ${
    end.x - reach * 0.3
  } ${end.y + 4}, ${end.x} ${end.y}`;

  return (
    <g className="wire-hint" opacity="0.7">
      <path
        d={d}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="8 8"
      />
      <path
        d={`M ${end.x - 9} ${end.y - 6} L ${end.x + 1} ${end.y} L ${end.x - 9} ${end.y + 6}`}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

function WireSurface(props: PresentationProps) {
  const { options, pick, moodOf, revealed, chosen, answer } = useOptions(props);
  const questionId = props.question.id;

  const board = useRef<HTMLDivElement>(null);
  const stem = useRef<HTMLDivElement>(null);
  /* The rows are measured, so they need a handle. `Pick` renders the button
     and does not forward a ref, so each one is wrapped in a plain element that
     wraps exactly its bounds: the wrapper is what gets hit tested, and it is
     the same rectangle as the button inside it. */
  const rows = useRef<(HTMLDivElement | null)[]>([]);

  const [start, setStart] = useState<Point | null>(null);
  const [ends, setEnds] = useState<Point[]>([]);
  const [pointer, setPointer] = useState<Point | null>(null);
  const [over, setOver] = useState<number | null>(null);
  /* Once they have taken hold of it once, they know. The hint does not come
     back for this question. */
  const [held, setHeld] = useState(false);

  /* Wire ends are measured rather than assumed, so the geometry survives text
     wrapping to two lines, a narrow window, or a different font size. */
  const measure = useCallback(() => {
    const box = board.current?.getBoundingClientRect();
    const from = stem.current?.getBoundingClientRect();
    if (!box || !from) return;

    setStart({ x: from.right - box.left, y: from.top + from.height / 2 - box.top });
    setEnds(
      rows.current.map((row) => {
        if (!row) return { x: 0, y: 0 };
        const r = row.getBoundingClientRect();
        return { x: r.left - box.left, y: r.top + r.height / 2 - box.top };
      })
    );
  }, []);

  useLayoutEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    if (board.current) observer.observe(board.current);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure, questionId]);

  /* Which row the pointer is over, by hit testing the rows themselves rather
     than by guessing from coordinates, so the target is exactly what is
     drawn. */
  function rowAt(clientX: number, clientY: number): number | null {
    for (let i = 0; i < rows.current.length; i++) {
      const r = rows.current[i]?.getBoundingClientRect();
      if (r && clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
        return i;
      }
    }
    return null;
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointer && over === null) return;
    const box = board.current?.getBoundingClientRect();
    if (!box) return;
    setPointer({ x: e.clientX - box.left, y: e.clientY - box.top });
    setOver(rowAt(e.clientX, e.clientY));
  }

  function endDrag(e: React.PointerEvent) {
    const target = rowAt(e.clientX, e.clientY);
    setPointer(null);
    setOver(null);
    if (target !== null) pick(target);
  }

  const live = pointer !== null;
  /* How far the loose end reaches: most of the way to the options, never past
     them. Falls back to nothing until the first measurement lands.

     The bar it has to clear used to be forty pixels, which is a sensible floor
     for the gap on a monitor and was silently fatal on a phone. The board used
     to stack into one column below the `sm` breakpoint, which put the plug
     ABOVE the options rather than beside them, so this distance was zero or
     negative and the hint simply never drew. The whole point of the stub is
     that somebody who has never seen a wire board can tell what to do, and the
     device where somebody has never seen one is the phone being passed around
     the room. The board no longer stacks, and the bar is now the smallest gap
     that can still carry a dash and an arrowhead. */
  const gap = ends[0] && start ? ends[0].x - start.x : 0;
  const showHint = !revealed && !held && !live && start !== null && gap > 18;

  return (
    <Stage revealed={revealed} className="flex min-h-0 flex-1 flex-col gap-[2vh]">
      {/* The gesture, in one line, above the board.

          It is chrome during a retrieval and it stays anyway. A student who
          cannot work out how to answer is not being helped to retrieve
          anything by the absence of a sentence telling them how. */}
      {!revealed && (
        <p
          style={{ fontVariationSettings: '"wdth" 88' }}
          className="shrink-0 font-sans text-[clamp(0.75rem,0.55rem+0.55vw+0.35vh,1.125rem)] font-bold uppercase tracking-[0.1em] text-accent"
        >
          Drag the wire to the answer
        </p>
      )}

      {/* The gap between the two columns is the wire. It used to be ten units,
          which left about forty pixels for a cable to hang in, and a forty
          pixel cable does not look like a cable. It is now the widest single
          measurement on the board, on purpose: the distance is the part of
          this that says "these two things are not connected yet".

          ── Two columns at every width ────────────────────────────────────
          Below `sm` this used to collapse into one, plug on top and options
          underneath, and that quietly took the presentation apart. Every
          coordinate here runs left to right: the wire leaves the right edge of
          the plug and lands on the left edge of a row. Stacked, those two
          points are nearly the same point, so the resting hint never drew at
          all and the answer wire came out as a loop that left the board on one
          side and re-entered on the other, with its endpoint hanging off the
          edge of the screen. What was left on a phone was a labelled dot above
          four boxes and no wire in sight, which is the exact thing the label,
          the stub and the instruction were added to prevent.

          So the columns stay, and what gives way is the distance between them.
          The wire gets shorter on a narrow screen; it does not stop being a
          wire. */}
      <div
        ref={board}
        /* One row, and it is the whole board. Left as `auto` the row would be
           sized by its own contents, and its contents are a column of options
           that are themselves shares of the row: each would have asked the
           other how tall it was and the board would have collapsed to the
           height of its gaps. `1fr` breaks that by handing the row the height
           the board already has. */
        className="relative grid min-h-0 flex-1 select-none grid-cols-[auto_minmax(0,1fr)] [grid-template-rows:minmax(0,1fr)] items-stretch gap-x-5 sm:gap-x-24"
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={() => {
          setPointer(null);
          setOver(null);
        }}
      >
        {/* The wire. Decorative: every state it shows is also carried by the
            nodes themselves, which are what a screen reader reads. */}
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        >
          {showHint && start && <HintWire from={start} reach={gap * 0.72} />}
          {revealed && start && ends[answer] && (
            <Wire from={start} to={ends[answer]} colour="var(--solid-mark)" width={4} />
          )}
          {revealed && chosen !== null && chosen !== answer && start && ends[chosen] && (
            <Wire from={start} to={ends[chosen]} colour="var(--broken-mark)" dashed />
          )}
          {!revealed && live && start && pointer && (
            <Wire
              from={start}
              to={over !== null && ends[over] ? ends[over] : pointer}
              colour="var(--accent)"
              width={4}
            />
          )}
        </svg>

        {/* The plug. Labelled, chunky, and shaped like something with a grip,
            because the previous version of this was a 14 pixel dot and read as
            a decoration rather than as the handle of the whole interaction.
            `touch-none` matters more than it looks: without it a drag on a
            phone is a page scroll, and this is a game played on phones. */}
        <div
          ref={stem}
          onPointerDown={(e) => {
            if (revealed) return;
            e.preventDefault();
            setHeld(true);
            const box = board.current?.getBoundingClientRect();
            if (box) setPointer({ x: e.clientX - box.left, y: e.clientY - box.top });
          }}
          /* `justify-self-center` keeps it from stretching, and `self-center`
             hangs it level with the middle of the options rather than
             stretching down the whole column. Narrow on a phone, where the
             width it takes comes straight out of the words in the answers. */
          className={`flex touch-none select-none flex-col items-center justify-center gap-1.5 self-center justify-self-center rounded-[6px] border-[3px] px-2.5 py-3 sm:gap-2 sm:px-5 sm:py-5 ${
            revealed
              ? "border-line bg-page"
              : "cursor-grab border-accent bg-accent-wash/50 active:cursor-grabbing"
          }`}
        >
          {!revealed && (
            <span
              style={{ fontVariationSettings: '"wdth" 88' }}
              className="font-sans text-[0.5625rem] font-bold uppercase leading-none tracking-[0.1em] text-accent sm:text-[0.6875rem] sm:tracking-[0.14em]"
            >
              Drag
            </span>
          )}
          <span aria-hidden className="relative grid h-5 w-5 place-items-center sm:h-6 sm:w-6">
            {!revealed && !live && (
              <span className="plug-ready absolute inset-0 rounded-full bg-accent" />
            )}
            <span
              className={`relative block h-4 w-4 rounded-full sm:h-5 sm:w-5 ${
                revealed ? "bg-line-strong" : "bg-accent"
              }`}
            />
          </span>
        </div>

        {/* The candidates, filling the row and centred in it once they stop
            growing. */}
        <div className="flex min-h-0 w-full flex-col justify-center gap-[1.5vh]">
          {options.map((option, i) => {
            const mood = moodOf(i);
            const targeted = !revealed && over === i;

            return (
              <div
                key={i}
                ref={(el) => {
                  rows.current[i] = el;
                }}
                /* An equal share of whatever height the board actually has,
                   with the ceiling set on the column above rather than here.

                   This used to be a clamp against the viewport with `shrink-0`
                   on it, which is a height a row will not go below no matter
                   what is asking. Four of those plus a question, an
                   instruction and a verdict do not fit a phone turned on its
                   side, and a column told to centre what it cannot fit spills
                   at both ends: the answers were drawn straight over the
                   question they belonged to. Shares cannot do that. They get
                   tight, and tight is a board you can still read.

                   The ceiling stays, because the reason it was put there
                   stands: four options given a tall monitor and no cap are
                   four empty panels with two words adrift in each. */
                className="flex max-h-[6.5rem] min-h-0 flex-1 basis-0"
              >
                <Pick
                  index={i}
                  option={option}
                  mood={mood}
                  revealed={revealed}
                  onPick={pick}
                  className={`rise-in relative flex w-full items-center gap-2.5 overflow-hidden rounded-[6px] border-[3px] px-3 py-2 sm:gap-4 sm:px-5 sm:py-4 ${
                    mood === "right" ? "right-pop right-sheen" : ""
                  } ${targeted ? "border-accent bg-accent-wash" : tone(mood)}`}
                >
                  {/* The socket the wire lands in. */}
                  <span
                    aria-hidden
                    className={`block h-3.5 w-3.5 shrink-0 rounded-full border-[3px] sm:h-4 sm:w-4 ${
                      mood === "right"
                        ? "border-solid-mark bg-solid-mark"
                        : mood === "wrong"
                          ? "border-broken-mark"
                          : targeted
                            ? "border-accent bg-accent"
                            : "border-line-strong"
                    }`}
                  />
                  <Mark
                    index={i}
                    mood={mood}
                    className="h-[clamp(1.75rem,4.2vh,2.25rem)] w-[clamp(1.75rem,4.2vh,2.25rem)] rounded-[4px] border-2 text-[0.8125rem] sm:text-[0.9375rem]"
                  />
                  <Say
                    mood={mood}
                    className="min-w-0 text-[clamp(1rem,0.7rem+1.1vw+0.7vh,2.125rem)]"
                  >
                    {option}
                  </Say>
                </Pick>
              </div>
            );
          })}
        </div>
      </div>
    </Stage>
  );
}

export const wire: Presentation = {
  id: "wire",
  name: "Wire connect",
  presents: ["choice"],
  /* Two options do not make a patch board worth drawing, and a question whose
     options are missing is not this presentation's problem to solve. */
  supports: (q) => (q.options?.length ?? 0) >= 3,
  Component: WireSurface,
};
