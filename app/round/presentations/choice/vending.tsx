"use client";

import { Mark, Pick, Say, Stage, tone, useOptions } from "../kit";
import type { Presentation, PresentationProps } from "../types";

/* Vending machine.

   The options sit on shelves behind the glass, each with its own slot code.
   Choosing one drops it into the tray at the bottom.

   The tray is the only thing that changes, and it changes after the answer is
   committed. Nothing on the shelves moves while a student is deciding. */

function Vending(props: PresentationProps) {
  const { options, pick, moodOf, revealed, chosen, answer } = useOptions(props);
  const dispensed = revealed ? (answer >= 0 ? answer : chosen) : null;

  return (
    <Stage revealed={revealed} className="mx-auto w-full max-w-[34rem]">
      <div className="rounded-[6px] border-2 border-line-strong bg-sunk/50 p-2.5">
        {/* The glass. */}
        <div className="grid grid-cols-2 gap-2 rounded-[3px] bg-page/60 p-2">
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
                className={`fall-in flex min-h-[4.75rem] flex-col justify-between gap-2 rounded-[3px] border-2 px-3 py-2.5 ${tone(
                  mood
                )}`}
              >
                <Say mood={mood} className="text-[0.9375rem]">
                  {option}
                </Say>
                <span className="flex items-center justify-between gap-2">
                  <Mark index={i} mood={mood} className="h-5 w-5 text-[0.625rem]" />
                  {/* The coil that would push it forward. */}
                  <span
                    aria-hidden
                    className="h-1.5 flex-1 rounded-full bg-[repeating-linear-gradient(90deg,var(--line-strong)_0_3px,transparent_3px_6px)] opacity-70"
                  />
                </span>
              </Pick>
            );
          })}
        </div>

        {/* The tray. Empty until something has been chosen, and never labelled:
            what lands in it is the answer, which speaks for itself. */}
        <div
          aria-hidden
          className="mt-2.5 flex min-h-[3rem] items-center gap-3 rounded-[3px] border-2 border-line-strong bg-ground/70 px-3 py-2"
        >
          {dispensed !== null && (
            <span
              className={`deliver flex items-center gap-2.5 rounded-[3px] border-2 px-3 py-1.5 ${tone(
                moodOf(dispensed)
              )}`}
            >
              <Mark index={dispensed} mood={moodOf(dispensed)} className="h-5 w-5 text-[0.625rem]" />
              <Say mood={moodOf(dispensed)} className="text-[0.9375rem]">
                {options[dispensed]}
              </Say>
            </span>
          )}
        </div>
      </div>
    </Stage>
  );
}

export const vending: Presentation = {
  id: "vending",
  name: "Vending machine",
  presents: ["choice"],
  /* Four slots behind one pane. Two would be a very empty machine. */
  supports: (q) => (q.options?.length ?? 0) >= 3 && (q.options ?? []).every((o) => o.length <= 34),
  Component: Vending,
};
