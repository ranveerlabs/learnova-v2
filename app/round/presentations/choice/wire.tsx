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
     them. Falls back to nothing until the first measurement lands. */
  const gap = ends[0] && start ? ends[0].x - start.x : 0;
  const showHint = !revealed && !held && !live && start !== null && gap > 40;

  return (
    <Stage revealed={revealed} className="flex min-h-0 flex-col gap-[2vh]">
      {/* The gesture, in one line, above the board.

          It is chrome during a retrieval and it stays anyway. A student who
          cannot work out how to answer is not being helped to retrieve
          anything by the absence of a sentence telling them how. */}
      {!revealed && (
        <p
          style={{ fontVariationSettings: '"wdth" 88' }}
          className="font-sans text-[clamp(0.875rem,0.6rem+0.7vw,1.125rem)] font-bold uppercase tracking-[0.1em] text-accent"
        >
          Drag the wire to the answer
        </p>
      )}

      {/* The gap between the two columns is the wire. It used to be ten units,
          which left about forty pixels for a cable to hang in, and a forty
          pixel cable does not look like a cable. It is now the widest single
          measurement on the board, on purpose: the distance is the part of
          this that says "these two things are not connected yet". */}
      <div
        ref={board}
        className="relative grid min-h-0 select-none grid-cols-[minmax(0,1fr)] items-stretch gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-x-24"
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
          /* `justify-self-center` keeps it from stretching. On a phone the two
             columns become one, and without this the plug spreads into a
             full-width bar with a dot lost in the middle of it, spending
             height the options need. */
          className={`flex touch-none select-none flex-col items-center justify-center gap-2 self-center justify-self-center rounded-[6px] border-[3px] px-5 py-5 ${
            revealed
              ? "border-line bg-page"
              : "cursor-grab border-accent bg-accent-wash/50 active:cursor-grabbing"
          }`}
        >
          {!revealed && (
            <span
              style={{ fontVariationSettings: '"wdth" 88' }}
              className="font-sans text-[0.6875rem] font-bold uppercase leading-none tracking-[0.14em] text-accent"
            >
              Drag
            </span>
          )}
          <span aria-hidden className="relative grid h-6 w-6 place-items-center">
            {!revealed && !live && (
              <span className="plug-ready absolute inset-0 rounded-full bg-accent" />
            )}
            <span
              className={`relative block h-5 w-5 rounded-full ${
                revealed ? "bg-line-strong" : "bg-accent"
              }`}
            />
          </span>
        </div>

        <div className="flex min-h-0 flex-col justify-center gap-[1.5vh]">
          {options.map((option, i) => {
            const mood = moodOf(i);
            const targeted = !revealed && over === i;

            return (
              <div
                key={i}
                ref={(el) => {
                  rows.current[i] = el;
                }}
                /* Sized off the viewport rather than off the leftover space.
                   Taking the slack made four options on a tall screen into
                   four empty panels with two words floating in the middle of
                   each; a clamped share of the height keeps them fat on a
                   monitor and still lets four of them fit a laptop. */
                className="flex h-[clamp(3.25rem,10vh,6.5rem)] shrink-0"
              >
                <Pick
                  index={i}
                  option={option}
                  mood={mood}
                  revealed={revealed}
                  onPick={pick}
                  className={`rise-in relative flex w-full items-center gap-4 rounded-[6px] border-[3px] px-5 py-4 ${
                    mood === "right" ? "right-pop right-sheen" : ""
                  } ${targeted ? "border-accent bg-accent-wash" : tone(mood)}`}
                >
                  {/* The socket the wire lands in. */}
                  <span
                    aria-hidden
                    className={`block h-4 w-4 shrink-0 rounded-full border-[3px] ${
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
                    className="h-9 w-9 rounded-[4px] border-2 text-[0.9375rem]"
                  />
                  <Say mood={mood} className="text-[clamp(1.25rem,0.9rem+1.3vw,2.125rem)]">
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
