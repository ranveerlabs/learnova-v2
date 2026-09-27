"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Pick, Say, Stage, tone, useOptions } from "../kit";
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
        pathLength={dashed ? undefined : 1}
        className={dashed ? undefined : "wire-connect"}
      />
      <circle cx={to.x} cy={to.y} r="5" fill={colour} />
    </>
  );
}

function WireSurface(props: PresentationProps) {
  const { options, pick, moodOf, revealed, chosen, answer } = useOptions(props);
  const questionId = props.question.id;

  const board = useRef<HTMLDivElement>(null);
  const stem = useRef<HTMLDivElement>(null);
  const rows = useRef<(HTMLDivElement | null)[]>([]);

  const [start, setStart] = useState<Point | null>(null);
  const [ends, setEnds] = useState<Point[]>([]);
  const [over, setOver] = useState<number | null>(null);

  const measure = useCallback(() => {
    const box = board.current?.getBoundingClientRect();
    const from = stem.current?.getBoundingClientRect();
    if (!box || !from) return;

    setStart({
      x: from.right - box.left,
      y: from.top + from.height / 2 - box.top,
    });
    setEnds(
      rows.current.map((row) => {
        if (!row) return { x: 0, y: 0 };
        const r = row.getBoundingClientRect();
        return { x: r.left - box.left, y: r.top + r.height / 2 - box.top };
      }),
    );
  }, []);

  useLayoutEffect(() => {
    measure();
    board.current?.querySelector("button")?.focus();
    const ro = new ResizeObserver(measure);
    if (board.current) ro.observe(board.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure, questionId]);

  return (
    <Stage
      revealed={revealed}
      className="flex min-h-0 flex-1 flex-col gap-[2vh]"
    >
      <div
        ref={board}
        className="relative grid min-h-0 flex-1 select-none grid-cols-[auto_minmax(0,1fr)] [grid-template-rows:minmax(0,1fr)] items-stretch gap-x-5 sm:gap-x-24"
      >
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        >
          {!revealed && over !== null && start && ends[over] && (
            <Wire key={over} from={start} to={ends[over]} colour="var(--accent)" />
          )}
          {revealed && start && ends[answer] && (
            <Wire
              from={start}
              to={ends[answer]}
              colour="var(--solid-mark)"
              dashed={chosen !== null && chosen !== answer}
              width={4}
            />
          )}
          {revealed &&
            chosen !== null &&
            chosen !== answer &&
            start &&
            ends[chosen] && (
              <Wire
                from={start}
                to={ends[chosen]}
                colour="var(--broken-mark)"
                width={4}
              />
          )}
        </svg>

        <div
          ref={stem}
          className={`flex select-none flex-col items-center justify-center gap-1.5 self-center justify-self-center border-[3px] px-2.5 py-3 sm:gap-2 sm:px-5 sm:py-5 ${
            revealed
              ? "border-line bg-page"
              : "border-accent bg-accent-wash/50"
          }`}
        >
          <span
            aria-hidden
            className="relative grid h-5 w-5 place-items-center sm:h-6 sm:w-6"
          >
            {!revealed && (
              <span className="plug-ready absolute inset-0 bg-accent" />
            )}
            <span
              className={`relative block h-4 w-4 sm:h-5 sm:w-5 ${
                revealed ? "bg-line-strong" : "bg-accent"
              }`}
            />
          </span>
        </div>

        <div className="flex min-h-0 w-full flex-col justify-center gap-[1.5vh]">
          {options.map((o, i) => {
            const mood = moodOf(i);
            const targeted = !revealed && over === i;

            return (
              <div
                key={i}
                ref={(el) => {
                  rows.current[i] = el;
                }}
                onFocus={() => setOver(i)}
                onBlur={() => setOver(null)}
                onMouseEnter={() => setOver(i)}
                onMouseLeave={() => setOver(null)}
                className="flex max-h-[6.5rem] min-h-0 flex-1 basis-0"
              >
                <Pick
                  index={i}
                  option={o}
                  mood={mood}
                  revealed={revealed}
                  onPick={pick}
                  className={`rise-in relative flex w-full items-center gap-2.5 overflow-hidden border-[3px] px-3 py-2 sm:gap-4 sm:px-5 sm:py-4 ${
                    mood === "right" ? "right-pop right-sheen" : ""
                  } ${targeted ? "border-accent bg-accent-wash" : tone(mood, { hover: false })}`}
                >
                  <span
                    aria-hidden
                    className={`block h-3.5 w-3.5 shrink-0 border-[3px] sm:h-4 sm:w-4 ${
                      mood === "right"
                        ? "border-solid-mark bg-solid-mark"
                        : mood === "wrong"
                          ? "border-broken-mark"
                          : targeted
                            ? "border-accent bg-accent"
                            : "border-line-strong"
                    }`}
                  />
                  <Say
                    mood={mood}
                    className="min-w-0 text-[clamp(1rem,0.7rem+1.1vw+0.7vh,2.125rem)]"
                  >
                    {o}
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
