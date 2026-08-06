"use client";

import { Mark, Pick, Say, Stage, paint, tone, useOptions } from "../kit";
import type { Presentation, PresentationProps } from "../types";

/* Pipe fitting.

   One inlet on the left and a run of pipe to each option. Fitting a pipe sends
   the flow down it.

   No rotating tiles, no laying a route: the pipes are already laid, and
   choosing which one to open is the entire interaction. Rotating tiles under a
   fifteen second clock would be a puzzle sitting on top of a question, and the
   student would be timed on the puzzle. */

function Pipes(props: PresentationProps) {
  const { options, pick, moodOf, revealed, chosen, answer } = useOptions(props);
  const flowing = revealed ? (answer >= 0 ? answer : chosen) : null;

  return (
    <Stage revealed={revealed} className="flex items-stretch gap-2 sm:gap-3">
      {/* The inlet and the header pipe every branch comes off. */}
      <div aria-hidden className="relative w-9 shrink-0 sm:w-12">
        <span className="absolute inset-y-4 left-1/2 block w-2.5 -translate-x-1/2 rounded-full border-2 border-line-strong bg-sunk" />
        <span className="absolute left-1/2 top-1 grid h-6 w-6 -translate-x-1/2 place-items-center rounded-full border-2 border-accent bg-page">
          <span className="block h-2 w-2 rounded-full bg-accent" />
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        {options.map((option, i) => {
          const mood = moodOf(i);
          const live = flowing === i;

          return (
            <Pick
              key={i}
              index={i}
              option={option}
              mood={mood}
              revealed={revealed}
              onPick={pick}
              className={`rise-in flex items-center gap-2.5 rounded-[3px] border-2 py-2.5 pl-2 pr-3.5 ${tone(
                mood
              )}`}
            >
              {/* The branch. A flange, then the run, then the valve. */}
              <span aria-hidden className="relative flex h-8 w-16 shrink-0 items-center sm:w-24">
                <svg width="100%" height="32" viewBox="0 0 96 32" preserveAspectRatio="none">
                  <path
                    d="M0 16 H96"
                    stroke={paint(mood)}
                    strokeWidth="9"
                    strokeLinecap="butt"
                    opacity="0.28"
                  />
                  <path
                    d="M0 16 H96"
                    className={live ? "flow" : ""}
                    stroke={paint(mood)}
                    strokeWidth="4"
                    strokeLinecap="round"
                    opacity={live ? 1 : 0.5}
                  />
                  <rect
                    x="18"
                    y="6"
                    width="5"
                    height="20"
                    rx="1"
                    fill={paint(mood)}
                    opacity="0.55"
                  />
                  <rect
                    x="66"
                    y="6"
                    width="5"
                    height="20"
                    rx="1"
                    fill={paint(mood)}
                    opacity="0.55"
                  />
                </svg>
              </span>

              <Mark index={i} mood={mood} />
              <Say mood={mood} className="min-w-0">
                {option}
              </Say>
            </Pick>
          );
        })}
      </div>
    </Stage>
  );
}

export const pipes: Presentation = {
  id: "pipes",
  name: "Pipe fitting",
  presents: ["recognition", "choice"],
  Component: Pipes,
};
