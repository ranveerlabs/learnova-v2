"use client";

import { Mark, Pick, Say, Stage, tone, useOptions } from "../kit";
import type { Presentation, PresentationProps } from "../types";

/* Lane runner.

   Lanes with a finish line at the end of each. Choosing a lane runs it.

   The runner does not run until the lane has been chosen, and the lane is what
   is clicked. An endless runner where the choice has to be made before a
   barrier arrives would be a reflex test with a question printed on it, and
   the question would be the part the student skipped. */

function Lanes(props: PresentationProps) {
  const { options, pick, moodOf, revealed, chosen } = useOptions(props);

  return (
    <Stage revealed={revealed} className="flex flex-col gap-2.5">
      {options.map((option, i) => {
        const mood = moodOf(i);
        const ran = revealed && chosen === i;

        return (
          <Pick
            key={i}
            index={i}
            option={option}
            mood={mood}
            revealed={revealed}
            onPick={pick}
            className={`rise-in flex items-center gap-3 overflow-hidden rounded-[3px] border-2 px-3.5 py-3 ${tone(
              mood
            )}`}
          >
            <Mark index={i} mood={mood} round />
            <Say mood={mood} className="min-w-0 flex-1">
              {option}
            </Say>

            {/* The lane itself, ending in a chequered line. */}
            <span aria-hidden className="relative hidden h-6 w-24 shrink-0 items-center sm:flex">
              <span className="block h-px w-full bg-[repeating-linear-gradient(90deg,var(--line-strong)_0_6px,transparent_6px_12px)]" />
              <span
                className={`absolute inset-y-0 right-0 w-2 bg-[repeating-conic-gradient(var(--line-strong)_0_25%,transparent_0_50%)] bg-[length:6px_6px] ${
                  mood === "right" ? "opacity-100" : "opacity-60"
                }`}
              />
              {/* The runner. Only ever between the start and the line it was
                  sent to, and only after the answer is in. */}
              {ran && (
                <span
                  className="travel absolute left-0 block h-2.5 w-2.5 rounded-full"
                  style={{
                    ["--fx" as string]: "-70px",
                    background:
                      mood === "right" ? "var(--solid-mark)" : "var(--broken-mark)",
                    left: "calc(100% - 1.1rem)",
                  }}
                />
              )}
            </span>
          </Pick>
        );
      })}
    </Stage>
  );
}

export const lanes: Presentation = {
  id: "lanes",
  name: "Lane runner",
  presents: ["recognition", "choice"],
  Component: Lanes,
};
