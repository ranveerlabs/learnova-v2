"use client";

import { Mark, Pick, Say, Stage, paint, tone, useOptions } from "../kit";
import type { Presentation, PresentationProps } from "../types";

/* Constellation.

   A fixed star in the middle and the candidates around it. Choosing one draws
   the line between them, and the line to the correct star is drawn whether or
   not it was the one chosen.

   The stars are placed by index, not at random: a layout that moved between
   renders would move the answer a student was already reaching for. */

/** Where the candidates sit, by how many there are. Percentages of the field,
    kept well inside the edges so a two line label has somewhere to go. */
const FIELDS: Record<number, { x: number; y: number }[]> = {
  2: [
    { x: 22, y: 26 },
    { x: 76, y: 72 },
  ],
  3: [
    { x: 20, y: 24 },
    { x: 80, y: 34 },
    { x: 50, y: 82 },
  ],
  4: [
    { x: 19, y: 22 },
    { x: 79, y: 26 },
    { x: 24, y: 78 },
    { x: 78, y: 76 },
  ],
};

function Constellation(props: PresentationProps) {
  const { options, pick, moodOf, revealed, chosen, answer } = useOptions(props);
  const field = FIELDS[options.length] ?? FIELDS[4];
  const hub = { x: 50, y: 50 };

  return (
    <Stage revealed={revealed} className="mx-auto w-full max-w-[40rem]">
      <div className="relative h-[21rem] rounded-[3px] border border-line bg-sunk/35 sm:h-[23rem]">
        {/* The lines. Decorative: every state they show is also on the stars. */}
        <svg
          aria-hidden
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          {revealed && answer >= 0 && field[answer] && (
            <line
              className="draw-line"
              style={{ ["--len" as string]: 140 }}
              x1={hub.x}
              y1={hub.y}
              x2={field[answer].x}
              y2={field[answer].y}
              stroke="var(--solid-mark)"
              strokeWidth="0.5"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {revealed && chosen !== null && chosen !== answer && field[chosen] && (
            <line
              x1={hub.x}
              y1={hub.y}
              x2={field[chosen].x}
              y2={field[chosen].y}
              stroke="var(--broken-mark)"
              strokeWidth="0.5"
              strokeDasharray="2 2"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {/* The fixed star. */}
        <span
          aria-hidden
          className="absolute left-1/2 top-1/2 grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center"
        >
          <span className="block h-3 w-3 rotate-45 border-2 border-accent bg-page" />
        </span>

        {options.map((option, i) => {
          const mood = moodOf(i);
          const at = field[i] ?? hub;

          return (
            <Pick
              key={i}
              index={i}
              option={option}
              mood={mood}
              revealed={revealed}
              onPick={pick}
              className={`grow-in absolute flex max-w-[10.5rem] -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-[3px] border-2 px-2.5 py-2 ${tone(
                mood
              )}`}
              style={{ left: `${at.x}%`, top: `${at.y}%` }}
            >
              <span aria-hidden className="relative grid h-5 w-5 shrink-0 place-items-center">
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path
                    d="M9 1 L10.8 6.6 L16.6 6.6 L11.9 10.1 L13.7 15.7 L9 12.2 L4.3 15.7 L6.1 10.1 L1.4 6.6 L7.2 6.6 Z"
                    fill={mood === "idle" ? "none" : paint(mood)}
                    stroke={paint(mood)}
                    strokeWidth="1.2"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <Mark index={i} mood={mood} className="h-5 w-5 text-[0.625rem]" />
              <Say mood={mood} className="text-[0.875rem]">
                {option}
              </Say>
            </Pick>
          );
        })}
      </div>
    </Stage>
  );
}

export const constellation: Presentation = {
  id: "constellation",
  name: "Constellation",
  presents: ["recognition", "choice"],
  /* Stars sit in a field with fixed positions, so a long label would run into
     its neighbour rather than wrap somewhere harmless. */
  supports: (q) =>
    (q.options?.length ?? 0) >= 2 &&
    (q.options?.length ?? 0) <= 4 &&
    (q.options ?? []).every((o) => o.length <= 24),
  Component: Constellation,
};
