"use client";

import { Mark, Pick, Say, Stage, tone, useOptions } from "../kit";
import type { Presentation, PresentationProps } from "../types";

/* Match-3 pairing.

   A line with one tile missing and the candidates below it. The chosen tile
   goes into the gap, and a line that is right clears.

   The two tiles already in the line are scenery and carry no information. That
   is deliberate: a matching game whose pieces hint at which one fits would be
   handing over the answer in the shape of a puzzle, and this presentation is
   not allowed to know anything the question did not say. */

function Match3(props: PresentationProps) {
  const { options, pick, moodOf, revealed, chosen } = useOptions(props);
  const placed = revealed ? chosen : null;
  const cleared = revealed && placed !== null && moodOf(placed) === "right";

  return (
    <Stage revealed={revealed} className="mx-auto w-full max-w-[36rem]">
      {/* The line. */}
      <div className="mb-4 flex items-stretch justify-center gap-2">
        {[0, 1].map((n) => (
          <span
            key={n}
            aria-hidden
            className={`grid h-14 w-14 place-items-center rounded-[4px] border-2 border-line-strong bg-sunk ${
              cleared ? "clear-away" : ""
            }`}
            style={{ ["--i" as string]: n }}
          >
            <span className="block h-4 w-4 rotate-45 rounded-[2px] border-2 border-line-strong" />
          </span>
        ))}

        <span
          aria-hidden
          className={`grid h-14 min-w-[7rem] place-items-center rounded-[4px] px-3 ${
            placed === null
              ? "slot-empty"
              : `border-2 ${tone(moodOf(placed))} ${cleared ? "clear-away" : ""}`
          }`}
        >
          {placed !== null && (
            <span className="snap flex items-center gap-2">
              <Mark index={placed} mood={moodOf(placed)} className="h-5 w-5 text-[0.625rem]" />
              <Say mood={moodOf(placed)} className="text-[0.875rem]">
                {options[placed]}
              </Say>
            </span>
          )}
        </span>
      </div>

      {/* The tray of candidates. */}
      <div className="grid gap-2.5 sm:grid-cols-2">
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
              className={`grow-in flex items-center gap-3 rounded-[4px] border-2 px-3 py-3 ${tone(
                mood
              )} ${placed === i && !cleared ? "opacity-60" : ""}`}
            >
              <Mark index={i} mood={mood} />
              <Say mood={mood} className="min-w-0 text-[0.9375rem]">
                {option}
              </Say>
            </Pick>
          );
        })}
      </div>
    </Stage>
  );
}

export const match3: Presentation = {
  id: "match3",
  name: "Match-3 pairing",
  presents: ["recognition", "choice"],
  supports: (q) => (q.options ?? []).every((o) => o.length <= 30),
  Component: Match3,
};
