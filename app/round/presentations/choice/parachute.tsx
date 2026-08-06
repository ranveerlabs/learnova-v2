"use client";

import { Mark, Pick, Say, Stage, paint, tone, useOptions } from "../kit";
import type { Presentation, PresentationProps } from "../types";

/* Parachute landing.

   Each option hangs under a canopy above its own landing pad. Choosing one
   sets it down.

   They descend once, on arrival, and then hold. A canopy still drifting while
   a student reads it would be an answer that has to be caught, and catching is
   not what this round measures. */

function Parachute(props: PresentationProps) {
  const { options, pick, moodOf, revealed, chosen, answer } = useOptions(props);
  const landed = revealed ? (answer >= 0 ? answer : chosen) : null;

  return (
    <Stage revealed={revealed} className="flex flex-wrap items-end justify-center gap-4 sm:gap-5">
      {options.map((option, i) => {
        const mood = moodOf(i);
        const down = landed === i;

        return (
          <Pick
            key={i}
            index={i}
            option={option}
            mood={mood}
            revealed={revealed}
            onPick={pick}
            className="deliver flex min-w-[8rem] max-w-[12.5rem] flex-1 basis-[8rem] flex-col items-center"
          >
            {/* The canopy. */}
            <span aria-hidden className={`block ${down ? "" : "sway"}`}>
              <svg width="86" height="46" viewBox="0 0 86 46">
                <path
                  d="M4 30 A39 30 0 0 1 82 30"
                  fill="none"
                  stroke={paint(mood)}
                  strokeWidth="2.5"
                />
                <path d="M4 30 L43 44" stroke={paint(mood)} strokeWidth="1.2" opacity="0.7" />
                <path d="M30 33 L43 44" stroke={paint(mood)} strokeWidth="1.2" opacity="0.7" />
                <path d="M56 33 L43 44" stroke={paint(mood)} strokeWidth="1.2" opacity="0.7" />
                <path d="M82 30 L43 44" stroke={paint(mood)} strokeWidth="1.2" opacity="0.7" />
              </svg>
            </span>

            {/* The payload. */}
            <span
              className={`-mt-1 flex w-full flex-col items-center gap-1.5 rounded-[3px] border-2 px-3 py-2.5 ${tone(
                mood
              )} ${down ? "block-drop" : ""}`}
            >
              <Mark index={i} mood={mood} />
              <Say mood={mood} className="text-center text-[0.9375rem]">
                {option}
              </Say>
            </span>

            {/* The pad. */}
            <span
              aria-hidden
              className={`mt-2 block h-1.5 w-full rounded-full ${
                mood === "right"
                  ? "bg-solid-mark"
                  : mood === "wrong"
                    ? "bg-broken-mark"
                    : "bg-line-strong"
              } ${down ? "" : "opacity-45"}`}
            />
          </Pick>
        );
      })}
    </Stage>
  );
}

export const parachute: Presentation = {
  id: "parachute",
  name: "Parachute landing",
  presents: ["recognition", "choice"],
  supports: (q) => (q.options ?? []).every((o) => o.length <= 30),
  Component: Parachute,
};
