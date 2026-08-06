"use client";

import { Mark, Pick, Say, Stage, tone, useOptions } from "../kit";
import type { Presentation, PresentationProps } from "../types";

/* Balloon pop.

   The options float on strings. The one that was wrong bursts; the one that
   was right stays up and holds.

   Bursting the wrong answer rather than the chosen one would be a lie, so it
   is strictly the chosen one that pops, and only when it was wrong. The bob is
   two pixels: enough to read as buoyant, not enough to move a hit area under a
   pointer already on its way. */

function Balloons(props: PresentationProps) {
  const { options, pick, moodOf, revealed } = useOptions(props);

  return (
    <Stage revealed={revealed} className="flex flex-wrap items-start justify-center gap-4 sm:gap-6">
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
            className="grow-in flex min-w-[7.5rem] max-w-[13rem] flex-1 basis-[8rem] flex-col items-center"
          >
            <span className={`block w-full ${mood === "wrong" ? "burst" : "bob"}`}>
              <span
                className={`flex min-h-[6.5rem] w-full flex-col items-center justify-center gap-2 rounded-[46%_46%_44%_44%/38%_38%_58%_58%] border-2 px-4 py-4 ${tone(
                  mood
                )}`}
              >
                <Mark index={i} mood={mood} round />
                <Say mood={mood} className="text-center text-[0.9375rem]">
                  {option}
                </Say>
              </span>
              {/* The knot. */}
              <span
                aria-hidden
                className={`mx-auto block h-2 w-2 rotate-45 ${
                  mood === "right"
                    ? "bg-solid-mark"
                    : mood === "wrong"
                      ? "bg-broken-mark"
                      : "bg-line-strong"
                }`}
              />
            </span>
            {/* The string. Stays behind when the balloon goes. */}
            <span
              aria-hidden
              className={`block h-10 w-px ${
                mood === "right" ? "bg-solid-mark/60" : "bg-line-strong"
              }`}
            />
          </Pick>
        );
      })}
    </Stage>
  );
}

export const balloons: Presentation = {
  id: "balloons",
  name: "Balloon pop",
  presents: ["recognition", "choice"],
  supports: (q) => (q.options ?? []).every((o) => o.length <= 30),
  Component: Balloons,
};
