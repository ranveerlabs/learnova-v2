"use client";

import { Mark, Pick, Say, Stage, paint, tone, useOptions } from "../kit";
import type { Presentation, PresentationProps } from "../types";

/* Hoops.

   A hoop per option. The shot goes in when the option is chosen, and it goes
   in every time: what is being tested is which hoop, not whether the shot
   drops. */

function Hoops(props: PresentationProps) {
  const { options, pick, moodOf, revealed, chosen } = useOptions(props);

  return (
    <Stage revealed={revealed} className="flex flex-wrap justify-center gap-4 sm:gap-5">
      {options.map((option, i) => {
        const mood = moodOf(i);
        const shot = revealed && chosen === i;

        return (
          <Pick
            key={i}
            index={i}
            option={option}
            mood={mood}
            revealed={revealed}
            onPick={pick}
            className={`fall-in flex min-w-[8.5rem] max-w-[13rem] flex-1 basis-[8.5rem] flex-col items-center gap-2 rounded-[3px] border-2 px-3 py-3 ${tone(
              mood
            )}`}
          >
            <span aria-hidden className="relative block">
              <svg width="90" height="62" viewBox="0 0 90 62">
                {/* Backboard. */}
                <rect
                  x="20"
                  y="2"
                  width="50"
                  height="32"
                  rx="2"
                  fill="none"
                  stroke={paint(mood)}
                  strokeWidth="2"
                  opacity="0.75"
                />
                <rect
                  x="35"
                  y="16"
                  width="20"
                  height="14"
                  rx="1"
                  fill="none"
                  stroke={paint(mood)}
                  strokeWidth="1.4"
                  opacity="0.55"
                />
                {/* Rim and net. */}
                <ellipse
                  cx="45"
                  cy="36"
                  rx="15"
                  ry="4.5"
                  fill="none"
                  stroke={paint(mood)}
                  strokeWidth="2.5"
                />
                <path
                  d="M31 37 L36 52 M39 39 L41 53 M51 39 L49 53 M59 37 L54 52 M36 52 L54 52"
                  fill="none"
                  stroke={paint(mood)}
                  strokeWidth="1.2"
                  opacity="0.6"
                />
                {shot && (
                  <circle
                    className="travel"
                    style={{ ["--fx" as string]: "-26px", ["--fy" as string]: "34px" }}
                    cx="45"
                    cy="47"
                    r="7"
                    fill="none"
                    stroke={paint(mood)}
                    strokeWidth="2.5"
                  />
                )}
              </svg>
              <span className="absolute left-1/2 top-[5px] -translate-x-1/2">
                <Mark index={i} mood={mood} className="h-5 w-5 text-[0.625rem]" />
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

export const hoops: Presentation = {
  id: "hoops",
  name: "Hoops",
  presents: ["recognition", "choice"],
  supports: (q) => (q.options ?? []).every((o) => o.length <= 30),
  Component: Hoops,
};
