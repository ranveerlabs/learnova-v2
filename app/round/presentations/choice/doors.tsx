"use client";

import { Mark, Pick, Say, Stage, tone, useOptions } from "../kit";
import type { Presentation, PresentationProps } from "../types";

/* Doors.

   A row of numbered doors, the answer written on each. Picking one opens it;
   the door that was right swings open whether or not it was the one chosen, so
   the correct answer is always shown.

   The answer is on the front of the door rather than behind it. A door that
   has to be opened to find out what is behind it would be a guess, and a guess
   is not retrieval. */

function Doors(props: PresentationProps) {
  const { options, pick, moodOf, revealed } = useOptions(props);

  return (
    <Stage revealed={revealed} className="flex flex-wrap justify-center gap-3 sm:gap-4">
      {options.map((option, i) => {
        const mood = moodOf(i);
        const opened = revealed && mood === "right";

        return (
          <Pick
            key={i}
            index={i}
            option={option}
            mood={mood}
            revealed={revealed}
            onPick={pick}
            className="fall-in relative min-w-[8.5rem] flex-1 basis-[8.5rem] sm:max-w-[13rem]"
          >
            {/* The frame stays put; the panel is what turns. */}
            <span
              className={`block overflow-hidden rounded-t-[10px] border-2 border-b-0 border-line-strong bg-sunk px-1.5 pt-1.5 ${
                mood === "right" ? "border-solid-mark" : mood === "wrong" ? "border-broken-mark" : ""
              }`}
            >
              <span
                className={`flex h-[10.5rem] flex-col justify-between rounded-t-[6px] border-2 px-3 py-3 ${tone(
                  mood
                )} ${opened ? "door-open" : ""}`}
              >
                <span className="flex items-start justify-between gap-2">
                  <Mark index={i} mood={mood} />
                  {/* The handle. */}
                  <span
                    aria-hidden
                    className="mt-1 block h-2 w-2 rounded-full bg-line-strong"
                  />
                </span>
                <Say mood={mood} className="text-[0.9375rem]">
                  {option}
                </Say>
              </span>
            </span>
            {/* The threshold, so an open door has somewhere to open into. */}
            <span
              aria-hidden
              className={`block h-1.5 rounded-b-[3px] ${
                mood === "right"
                  ? "bg-solid-mark"
                  : mood === "wrong"
                    ? "bg-broken-mark"
                    : "bg-line-strong"
              }`}
            />
          </Pick>
        );
      })}
    </Stage>
  );
}

export const doors: Presentation = {
  id: "doors",
  name: "Doors",
  presents: ["recognition", "choice"],
  /* A door is a tall narrow panel and a sentence will not sit on one. */
  supports: (q) => (q.options ?? []).every((o) => o.length <= 34),
  Component: Doors,
};
