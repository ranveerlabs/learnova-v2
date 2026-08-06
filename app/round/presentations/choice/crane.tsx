"use client";

import { Mark, Pick, Say, Stage, tone, useOptions } from "../kit";
import type { Presentation, PresentationProps } from "../types";

/* Crane grab.

   Prizes in a cabinet, a claw on a gantry above them. Choosing a prize sends
   the claw to it.

   Everything a real claw machine is for is absent here on purpose. The claw
   does not miss, it does not drop what it picks up, and it does not have to be
   lined up: the prizes are buttons and the claw is scenery that follows the
   choice. A presentation where the machine can lose for you would be a test of
   dexterity wearing a study tool's clothes. */

function Crane(props: PresentationProps) {
  const { options, pick, moodOf, revealed, chosen, answer } = useOptions(props);
  const held = revealed ? (answer >= 0 ? answer : chosen) : chosen;
  const columns = options.length <= 2 ? options.length : 2;

  return (
    <Stage revealed={revealed} className="mx-auto w-full max-w-[36rem]">
      <div className="rounded-[6px] border-2 border-line-strong bg-sunk/40 p-3">
        {/* The gantry. The claw slides along it to whatever was chosen. */}
        <div aria-hidden className="relative mb-3 h-9">
          <span className="absolute inset-x-1 top-1 block h-1 rounded-full bg-line-strong" />
          <span
            className="absolute top-0 flex w-10 -translate-x-1/2 flex-col items-center"
            style={{
              left:
                held === null
                  ? "50%"
                  : `${((held % columns) + 0.5) * (100 / columns)}%`,
              transition: "left 380ms cubic-bezier(0.3, 0.7, 0.2, 1)",
            }}
          >
            <span className="block h-3 w-3 rounded-[2px] bg-line-strong" />
            <span className="block h-3 w-px bg-line-strong" />
            {/* The claw, drawn as two prongs so it reads without colour. */}
            <span
              className={`flex gap-1 ${held !== null ? "travel" : ""}`}
              style={{ ["--fy" as string]: "-10px", ["--fx" as string]: "0px" }}
            >
              <span
                className={`block h-3 w-1 origin-top -rotate-12 rounded-full ${
                  held !== null && revealed
                    ? moodOf(held) === "right"
                      ? "bg-solid-mark"
                      : "bg-broken-mark"
                    : "bg-ink-faint"
                }`}
              />
              <span
                className={`block h-3 w-1 origin-top rotate-12 rounded-full ${
                  held !== null && revealed
                    ? moodOf(held) === "right"
                      ? "bg-solid-mark"
                      : "bg-broken-mark"
                    : "bg-ink-faint"
                }`}
              />
            </span>
          </span>
        </div>

        <div
          className="grid gap-2.5"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {options.map((option, i) => {
            const mood = moodOf(i);
            const lifted = held === i && revealed;
            return (
              <Pick
                key={i}
                index={i}
                option={option}
                mood={mood}
                revealed={revealed}
                onPick={pick}
                className={`grow-in flex min-h-[4.5rem] items-center gap-2.5 rounded-[999px] border-2 px-4 py-3 ${tone(
                  mood
                )} ${lifted ? "-translate-y-1" : ""}`}
              >
                <Mark index={i} mood={mood} round />
                <Say mood={mood} className="text-[0.9375rem]">
                  {option}
                </Say>
              </Pick>
            );
          })}
        </div>
      </div>
    </Stage>
  );
}

export const crane: Presentation = {
  id: "crane",
  name: "Crane grab",
  presents: ["recognition", "choice"],
  supports: (q) => (q.options ?? []).every((o) => o.length <= 34),
  Component: Crane,
};
