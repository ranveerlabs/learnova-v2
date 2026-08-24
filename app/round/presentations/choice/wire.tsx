"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Mark, Pick, Say, Stage, tone, useOptions } from "../kit";
import type { Presentation, PresentationProps } from "../types";

type Point = { x: number; y: number };

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
  const { options, pick, moodOf, revealed, chosen, answer } = useOptions(props, { keys: false });
  const questionId = props.question.id;

  const board = useRef<HTMLDivElement>(null);
  const stem = useRef<HTMLDivElement>(null);
  const rows = useRef<(HTMLDivElement | null)[]>([]);

  const [start, setStart] = useState<Point | null>(null);
  const [ends, setEnds] = useState<Point[]>([]);
  const [pointer, setPointer] = useState<Point | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [held, setHeld] = useState(false);

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
  const gap = ends[0] && start ? ends[0].x - start.x : 0;
  const showHint = !revealed && !held && !live && start !== null && gap > 18;

  return (
    <Stage revealed={revealed} className="flex min-h-0 flex-1 flex-col gap-[2vh]">
      {!revealed && (
        <p
          style={{ fontVariationSettings: '"wdth" 88' }}
          className="shrink-0 font-sans text-[clamp(0.75rem,0.55rem+0.55vw+0.35vh,1.125rem)] font-bold uppercase tracking-[0.1em] text-accent"
        >
          Drag the wire to the answer
        </p>
      )}

      <div
        ref={board}
        className="relative grid min-h-0 flex-1 select-none grid-cols-[auto_minmax(0,1fr)] [grid-template-rows:minmax(0,1fr)] items-stretch gap-x-5 sm:gap-x-24"
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={() => {
          setPointer(null);
          setOver(null);
        }}
      >
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

        <div
          ref={stem}
          onPointerDown={(e) => {
            if (revealed) return;
            e.preventDefault();
            setHeld(true);
            const box = board.current?.getBoundingClientRect();
            if (box) setPointer({ x: e.clientX - box.left, y: e.clientY - box.top });
          }}
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
                className="flex max-h-[6.5rem] min-h-0 flex-1 basis-0"
              >
                <Pick
                  index={i}
                  option={option}
                  mood={mood}
                  revealed={revealed}
                  className={`rise-in relative flex w-full items-center gap-2.5 overflow-hidden rounded-[6px] border-[3px] px-3 py-2 sm:gap-4 sm:px-5 sm:py-4 ${
                    mood === "right" ? "right-pop right-sheen" : ""
                  } ${targeted ? "border-accent bg-accent-wash" : tone(mood, { hover: false })}`}
                >
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
  supports: (q) => (q.options?.length ?? 0) >= 3,
  Component: WireSurface,
};
