"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Mark, Pick, Say, Stage, tone, useOptions } from "../kit";
import type { Presentation, PresentationProps } from "../types";

/* Wire connect.

   The question sits on the left as a terminal, the candidates on the right,
   and the student draws a wire between them.

   Three ways to connect, all equal, none faster than the others:
   - press 1 to 4
   - click the candidate
   - drag from the terminal to anywhere in the candidate's row

   The drag is deliberately forgiving. The drop target is the whole row, the
   wire snaps to whichever row the pointer is over, and releasing anywhere else
   simply cancels. Nothing here can be failed by an unsteady hand.

   The terminal used to be labelled "Connect". It is not any more: a round
   shows the question, the options and the timer, and a presentation narrating
   its own metaphor was one of the things crowding the retrieval. */

type Point = { x: number; y: number };

/** A wire with a little slack in it, the way a real one hangs. */
function Wire({
  from,
  to,
  colour,
  dashed,
}: {
  from: Point;
  to: Point;
  colour: string;
  dashed?: boolean;
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
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={dashed ? "5 5" : undefined}
      />
      <circle cx={to.x} cy={to.y} r="3.5" fill={colour} />
    </>
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

  return (
    <Stage revealed={revealed}>
      <div
        ref={board}
        className="relative grid select-none grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-[auto_minmax(0,1.4fr)] sm:gap-10"
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
          {revealed && start && ends[answer] && (
            <Wire from={start} to={ends[answer]} colour="var(--solid-mark)" />
          )}
          {revealed && chosen !== null && chosen !== answer && start && ends[chosen] && (
            <Wire from={start} to={ends[chosen]} colour="var(--broken-mark)" dashed />
          )}
          {!revealed && live && start && pointer && (
            <Wire
              from={start}
              to={over !== null && ends[over] ? ends[over] : pointer}
              colour="var(--accent)"
            />
          )}
        </svg>

        <div
          ref={stem}
          onPointerDown={(e) => {
            if (revealed) return;
            e.preventDefault();
            const box = board.current?.getBoundingClientRect();
            if (box) setPointer({ x: e.clientX - box.left, y: e.clientY - box.top });
          }}
          className={`flex items-center gap-3 self-center rounded-[3px] border-2 bg-page px-4 py-4 ${
            revealed ? "border-line" : "cursor-grab border-accent active:cursor-grabbing"
          }`}
        >
          <span
            aria-hidden
            className={`block h-3.5 w-3.5 rounded-full ${
              revealed ? "bg-line-strong" : "bg-accent"
            }`}
          />
        </div>

        <div className="flex flex-col gap-2.5">
          {options.map((option, i) => {
            const mood = moodOf(i);
            const targeted = !revealed && over === i;

            return (
              <div
                key={i}
                ref={(el) => {
                  rows.current[i] = el;
                }}
                className="flex"
              >
                <Pick
                  index={i}
                  option={option}
                  mood={mood}
                  revealed={revealed}
                  onPick={pick}
                  className={`rise-in flex w-full items-center gap-3 rounded-[3px] border-2 px-4 py-3 ${
                    targeted ? "border-accent bg-accent-wash" : tone(mood)
                  }`}
                >
                  {/* The terminal the wire lands on. */}
                  <span
                    aria-hidden
                    className={`block h-3 w-3 shrink-0 rounded-full border-2 ${
                      mood === "right"
                        ? "border-solid-mark bg-solid-mark"
                        : mood === "wrong"
                          ? "border-broken-mark"
                          : targeted
                            ? "border-accent bg-accent"
                            : "border-line-strong"
                    }`}
                  />
                  <Mark index={i} mood={mood} className="h-5 w-5 text-[0.625rem]" />
                  <Say mood={mood}>{option}</Say>
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
