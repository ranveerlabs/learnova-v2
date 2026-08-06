"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Question } from "../types";
import type { Skin, SkinProps } from "./types";

/* Wire connect.

   The question sits on the left as a terminal, the candidates on the right,
   and the student draws a wire between them. It presents "choice" questions:
   the engine has no matching format, and inventing one would be a new
   retrieval mechanic rather than a skin. What it changes is entirely the
   presentation, and the answer it commits is the same option index a plain
   four-option grid would have committed.

   Three ways to connect, all equal, none faster than the others:
   - press 1 to 4
   - click the candidate
   - drag from the terminal to anywhere in the candidate's row

   The drag is deliberately forgiving. The drop target is the whole row, the
   wire snaps to whichever row the pointer is over, and releasing anywhere
   else simply cancels. Nothing here can be failed by an unsteady hand, which
   is the rule: difficulty comes from the question, never from dexterity. */

const KEYS = ["1", "2", "3", "4"];

type Point = { x: number; y: number };

function WireSurface({ question, revealed, chosen, onAnswer }: SkinProps) {
  const options = question.options ?? [];
  const board = useRef<HTMLDivElement>(null);
  const stem = useRef<HTMLDivElement>(null);
  const rows = useRef<(HTMLButtonElement | null)[]>([]);

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
  }, [measure, question.id]);

  useEffect(() => {
    if (revealed) return;
    function onKey(e: KeyboardEvent) {
      const i = KEYS.indexOf(e.key);
      if (i >= 0 && i < options.length) {
        e.preventDefault();
        onAnswer(i);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [options.length, onAnswer, revealed]);

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
    if (target !== null && !revealed) onAnswer(target);
  }

  const live = pointer !== null;
  const answer = question.answerIndex ?? -1;

  return (
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
      <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
        {revealed && start && ends[answer] && (
          <Wire from={start} to={ends[answer]} colour="var(--solid-mark)" />
        )}
        {revealed && chosen !== null && chosen !== answer && start && ends[chosen] && (
          <Wire from={start} to={ends[chosen]} colour="var(--broken-mark)" dashed />
        )}
        {!revealed && live && start && pointer && (
          <Wire from={start} to={over !== null && ends[over] ? ends[over] : pointer} colour="var(--accent)" />
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
        className={`flex items-center gap-3 self-center rounded-[3px] border-2 bg-page px-4 py-3 ${
          revealed ? "border-line" : "cursor-grab border-accent active:cursor-grabbing"
        }`}
      >
        <span
          aria-hidden
          className={`block h-3 w-3 rounded-full ${revealed ? "bg-line-strong" : "bg-accent"}`}
        />
        <span className="font-sans text-[0.8125rem] font-semibold text-ink-soft">Connect</span>
      </div>

      <div className="flex flex-col gap-2.5">
        {options.map((option, i) => {
          const isAnswer = i === answer;
          const isChosen = i === chosen;
          const showRight = revealed && isAnswer;
          const showWrong = revealed && isChosen && !isAnswer;
          const targeted = !revealed && over === i;

          return (
            <button
              key={i}
              ref={(el) => {
                rows.current[i] = el;
              }}
              disabled={revealed}
              onClick={() => onAnswer(i)}
              style={{ ["--i" as string]: i }}
              className={`deal-in-stagger relative flex items-center gap-3 rounded-[3px] border-2 px-4 py-3 text-left transition-colors ${
                showRight
                  ? "right-flash border-solid-mark bg-solid-tint"
                  : showWrong
                    ? "miss-mark border-broken-mark bg-broken-tint"
                    : revealed
                      ? "border-line bg-page opacity-55"
                      : targeted
                        ? "border-accent bg-accent-wash"
                        : "border-line bg-page hover:border-accent hover:bg-accent-wash/40"
              }`}
            >
              {/* The terminal the wire lands on. */}
              <span
                aria-hidden
                className={`block h-3 w-3 shrink-0 rounded-full border-2 ${
                  showRight
                    ? "border-solid-mark bg-solid-mark"
                    : showWrong
                      ? "border-broken-mark"
                      : targeted
                        ? "border-accent bg-accent"
                        : "border-line-strong"
                }`}
              />
              <span
                aria-hidden
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-[2px] border font-mono text-[0.625rem] font-semibold ${
                  showRight
                    ? "border-solid-mark bg-solid-mark text-page"
                    : showWrong
                      ? "border-broken-mark text-broken-ink"
                      : "border-line-strong text-ink-faint"
                }`}
              >
                {showRight ? "✓" : showWrong ? "✕" : KEYS[i]}
              </span>
              <span
                className={`font-read text-[1.0625rem] leading-[1.35] ${
                  showRight
                    ? "font-medium text-solid-ink"
                    : showWrong
                      ? "text-broken-ink"
                      : "text-ink"
                }`}
              >
                {option}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

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
  const d = `M ${from.x} ${from.y} C ${from.x + dx} ${from.y + sag}, ${to.x - dx} ${to.y + sag}, ${to.x} ${to.y}`;

  return (
    <>
      <path d={d} fill="none" stroke={colour} strokeWidth="2.5" strokeLinecap="round"
        strokeDasharray={dashed ? "5 5" : undefined} />
      <circle cx={to.x} cy={to.y} r="3.5" fill={colour} />
    </>
  );
}

export const wire: Skin = {
  id: "wire",
  name: "Wire connect",
  presents: ["choice"],
  /* Two options do not make a patch board worth drawing, and a question whose
     options are missing is not this skin's problem to solve. */
  supports: (q: Question) => (q.options?.length ?? 0) >= 3,
  Component: WireSurface,
};
