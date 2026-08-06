"use client";

import { Mark, Pick, Say, Stage, paint, tone, useOptions } from "../kit";
import type { Presentation, PresentationProps } from "../types";

/* Dart throw.

   Each option is a target. The dart lands where it was aimed, every time: the
   throw is the choosing, and there is nothing between deciding and hitting.

   A dartboard that could be missed would put a motor skill between a student
   and an answer they knew, which is the one thing no presentation here is
   allowed to do. */

function Darts(props: PresentationProps) {
  const { options, pick, moodOf, revealed, chosen } = useOptions(props);

  return (
    <Stage revealed={revealed} className="flex flex-wrap justify-center gap-x-5 gap-y-6">
      {options.map((option, i) => {
        const mood = moodOf(i);
        const stuck = revealed && chosen === i;

        return (
          <Pick
            key={i}
            index={i}
            option={option}
            mood={mood}
            revealed={revealed}
            onPick={pick}
            className={`grow-in flex min-w-[8rem] max-w-[12rem] flex-1 basis-[8rem] flex-col items-center gap-2.5 rounded-[3px] border-2 px-3 py-3.5 ${tone(
              mood
            )}`}
          >
            <span aria-hidden className="relative block">
              <svg width="72" height="72" viewBox="0 0 72 72">
                <circle cx="36" cy="36" r="34" fill="none" stroke={paint(mood)} strokeWidth="2" />
                <circle
                  cx="36"
                  cy="36"
                  r="24"
                  fill="none"
                  stroke={paint(mood)}
                  strokeWidth="1.5"
                  opacity="0.6"
                />
                <circle
                  cx="36"
                  cy="36"
                  r="14"
                  fill="none"
                  stroke={paint(mood)}
                  strokeWidth="1.5"
                  opacity="0.45"
                />
                <circle cx="36" cy="36" r="5" fill={paint(mood)} opacity="0.85" />
              </svg>

              {/* The dart, once it has been thrown. Its flights are a shape, so
                  a hit reads as a hit without the colour. */}
              {stuck && (
                <span
                  className="travel absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                  style={{ ["--fx" as string]: "-38px", ["--fy" as string]: "-30px" }}
                >
                  <svg width="34" height="34" viewBox="0 0 34 34">
                    <path
                      d="M4 4 L20 20"
                      stroke={paint(mood)}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    <path
                      d="M4 4 L4 11 L11 4 Z"
                      fill={paint(mood)}
                    />
                    <circle cx="21" cy="21" r="3" fill={paint(mood)} />
                  </svg>
                </span>
              )}

              <span className="absolute inset-0 grid place-items-center">
                <Mark index={i} mood={mood} round className="h-6 w-6 text-[0.6875rem]" />
              </span>
            </span>

            <Say mood={mood} className="text-center text-[0.9375rem]">
              {option}
            </Say>
          </Pick>
        );
      })}
    </Stage>
  );
}

export const darts: Presentation = {
  id: "darts",
  name: "Dart throw",
  presents: ["recognition", "choice"],
  supports: (q) => (q.options ?? []).every((o) => o.length <= 28),
  Component: Darts,
};
