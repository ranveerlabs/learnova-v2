"use client";

import { Mark, Pick, Say, Stage, tone, useOptions } from "../kit";
import type { Presentation, PresentationProps } from "../types";

/* Elevator.

   The options are floors on a panel. Choosing one sends the car to it: the
   indicator slides to the chosen floor, and the floor that was correct is the
   one the doors open on.

   The car is scenery. Every floor is reachable at any moment, and the button
   for it does not move while the car travels. */

function Elevator(props: PresentationProps) {
  const { options, pick, moodOf, revealed, chosen, answer } = useOptions(props);
  const rows = options.length;

  /* Where the car comes to rest: the correct floor, always, so the answer is
     shown even when it was not the one chosen. */
  const resting = revealed ? (answer >= 0 ? answer : (chosen ?? 0)) : (chosen ?? 0);

  return (
    <Stage revealed={revealed} className="flex items-stretch gap-3 sm:gap-4">
      {/* The shaft. Decorative: the floors themselves carry every state. */}
      <div
        aria-hidden
        className="relative w-12 shrink-0 rounded-[3px] border-2 border-line-strong bg-sunk/60 sm:w-16"
      >
        <span
          className="car-arrive absolute inset-x-1 rounded-[2px] border-2 border-accent bg-accent-wash"
          style={{
            height: `calc(${100 / rows}% - 0.5rem)`,
            top: `calc(${(resting * 100) / rows}% + 0.25rem)`,
            transition: "top 420ms cubic-bezier(0.3, 0.7, 0.2, 1)",
          }}
        >
          <span className="absolute inset-y-2 left-1/2 w-px -translate-x-1/2 bg-accent/50" />
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {options.map((option, i) => {
          const mood = moodOf(i);
          return (
            <Pick
              key={i}
              index={i}
              option={option}
              mood={mood}
              revealed={revealed}
              onPick={pick}
              className={`rise-in flex items-center gap-3 rounded-[3px] border-2 px-3.5 py-3 ${tone(mood)}`}
            >
              <Mark index={i} mood={mood} round />
              <Say mood={mood}>{option}</Say>
            </Pick>
          );
        })}
      </div>
    </Stage>
  );
}

export const elevator: Presentation = {
  id: "elevator",
  name: "Elevator",
  presents: ["recognition", "choice"],
  Component: Elevator,
};
