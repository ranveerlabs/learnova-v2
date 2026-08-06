"use client";

import { Mark, Pick, Say, Stage, tone, useOptions } from "../kit";
import type { Presentation, PresentationProps } from "../types";

/* Magnets.

   A pole on the left, the candidates beside it. The one chosen snaps to the
   pole; the one that was right holds there.

   The snap happens after the answer is committed, and it moves the option
   about ten pixels. Nothing has to be dragged into place: attraction is what
   the presentation is about, not what the student has to perform. */

function Magnets(props: PresentationProps) {
  const { options, pick, moodOf, revealed, chosen, answer } = useOptions(props);
  const attached = revealed ? (answer >= 0 ? answer : chosen) : null;

  return (
    <Stage revealed={revealed} className="flex items-stretch gap-3">
      {/* The pole, drawn as a horseshoe magnet lying on its side. */}
      <div
        aria-hidden
        className="relative flex w-11 shrink-0 flex-col justify-center gap-1.5 sm:w-14"
      >
        <span className="block h-8 rounded-l-[3px] rounded-r-[999px] border-2 border-r-0 border-broken-mark bg-broken-tint" />
        <span className="block h-8 rounded-l-[3px] rounded-r-[999px] border-2 border-r-0 border-accent bg-accent-wash" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        {options.map((option, i) => {
          const mood = moodOf(i);
          const stuck = attached === i;

          return (
            <Pick
              key={i}
              index={i}
              option={option}
              mood={mood}
              revealed={revealed}
              onPick={pick}
              className={`rise-in flex items-center gap-3 rounded-[3px] border-2 px-3.5 py-3 ${tone(
                mood
              )} ${stuck ? "snap" : ""}`}
              style={stuck ? { ["--gap" as string]: "-14px" } : undefined}
            >
              {/* Filings on the edge nearest the pole. They lie flat until
                  something is attracting them. */}
              <span
                aria-hidden
                className={`flex h-8 w-4 shrink-0 flex-col justify-between ${
                  stuck ? "" : "opacity-40"
                }`}
              >
                {[0, 1, 2, 3].map((n) => (
                  <span
                    key={n}
                    className={`block h-0.5 rounded-full ${
                      mood === "right"
                        ? "bg-solid-mark"
                        : mood === "wrong"
                          ? "bg-broken-mark"
                          : "bg-ink-faint"
                    }`}
                    style={{ width: stuck ? "100%" : "62%" }}
                  />
                ))}
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

export const magnets: Presentation = {
  id: "magnets",
  name: "Magnets",
  presents: ["recognition", "choice"],
  Component: Magnets,
};
