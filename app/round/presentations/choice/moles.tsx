"use client";

import { Mark, Pick, Say, Stage, tone, useOptions } from "../kit";
import type { Presentation, PresentationProps } from "../types";

/* Whack-a-mole.

   The shape of the arcade cabinet, and none of its mechanic. Every mole is up
   and every mole stays up: they do not surface at random, they do not drop
   after a second, and there is no penalty for hitting the wrong one beyond
   being wrong, which the question was going to charge anyway.

   That is the whole point of listing it as a presentation rather than a game
   mode. The arcade version measures reaction time. The moment reaction time is
   in the loop, the score stops being about whether the student knew the answer,
   and this mode has exactly one job, which is to say whether they knew it. */

function Moles(props: PresentationProps) {
  const { options, pick, moodOf, revealed } = useOptions(props);
  const columns = options.length <= 2 ? 2 : 2;

  return (
    <Stage revealed={revealed} className="mx-auto w-full max-w-[34rem]">
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
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
              className="rise-in flex flex-col items-center"
            >
              {/* The mole. Up, and staying up. */}
              <span
                className={`z-10 flex w-full flex-col items-center gap-1.5 rounded-t-[999px] border-2 border-b-0 px-3 pb-3 pt-4 ${tone(
                  mood
                )}`}
              >
                <Mark index={i} mood={mood} round />
                <Say mood={mood} className="text-center text-[0.9375rem]">
                  {option}
                </Say>
              </span>

              {/* The hole. An ellipse the mole stands in, so the shape reads
                  even with every animation off. */}
              <span
                aria-hidden
                className={`-mt-1 block h-3 w-[92%] rounded-[50%] border-2 ${
                  mood === "right"
                    ? "border-solid-mark bg-solid-tint"
                    : mood === "wrong"
                      ? "border-broken-mark bg-broken-tint"
                      : "border-line-strong bg-sunk"
                }`}
              />
            </Pick>
          );
        })}
      </div>
    </Stage>
  );
}

export const moles: Presentation = {
  id: "moles",
  name: "Whack-a-mole",
  presents: ["recognition", "choice"],
  supports: (q) => (q.options ?? []).every((o) => o.length <= 30),
  Component: Moles,
};
