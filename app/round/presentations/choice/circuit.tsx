"use client";

import { Mark, Pick, Say, Stage, tone, useOptions } from "../kit";
import type { Presentation, PresentationProps } from "../types";

/* Circuit repair.

   A board with a gap in the track and a component for each option. Fitting one
   closes the circuit: the correct component lights the track, the wrong one
   leaves it dark.

   Current is shown flowing only on the component that was actually right, so
   the lamp is a report of the grade rather than a second opinion on it. */

function Circuit(props: PresentationProps) {
  const { options, pick, moodOf, revealed, chosen, answer } = useOptions(props);
  const fitted = revealed ? chosen : null;
  const live = revealed && chosen === answer;

  return (
    <Stage revealed={revealed} className="mx-auto w-full max-w-[38rem]">
      {/* The board. The track runs round the outside with a gap at the top,
          and the lamp sits in the corner. */}
      <div
        aria-hidden
        className="relative mb-3 h-16 rounded-[3px] border-2 border-line-strong bg-sunk/40 px-3"
      >
        <svg
          viewBox="0 0 300 60"
          preserveAspectRatio="none"
          className="h-full w-full overflow-visible"
        >
          <path
            d="M14 46 H120"
            stroke={live ? "var(--solid-mark)" : "var(--line-strong)"}
            strokeWidth="3"
            strokeLinecap="round"
            className={live ? "flow" : ""}
          />
          <path
            d="M180 46 H286"
            stroke={live ? "var(--solid-mark)" : "var(--line-strong)"}
            strokeWidth="3"
            strokeLinecap="round"
            className={live ? "flow" : ""}
          />
          {/* The gap the component goes into. */}
          <rect
            x="122"
            y="34"
            width="56"
            height="24"
            rx="2"
            fill="none"
            stroke={
              fitted === null
                ? "var(--line-strong)"
                : live
                  ? "var(--solid-mark)"
                  : "var(--broken-mark)"
            }
            strokeWidth="2"
            strokeDasharray={fitted === null ? "4 4" : undefined}
          />
          {fitted !== null && (
            <text
              x="150"
              y="51"
              textAnchor="middle"
              fontSize="15"
              fontFamily="var(--font-mono, monospace)"
              fill={live ? "var(--solid-mark)" : "var(--broken-mark)"}
            >
              {live ? "✓" : "✕"}
            </text>
          )}
          {/* The lamp. */}
          <circle
            cx="286"
            cy="18"
            r="9"
            fill={live ? "var(--solid-tint)" : "none"}
            stroke={live ? "var(--solid-mark)" : "var(--line-strong)"}
            strokeWidth="2.5"
          />
          <path
            d="M286 27 V46"
            stroke={live ? "var(--solid-mark)" : "var(--line-strong)"}
            strokeWidth="3"
          />
          {live && (
            <g stroke="var(--solid-mark)" strokeWidth="1.8" strokeLinecap="round">
              <path d="M286 3 V-2" />
              <path d="M272 18 H267" />
              <path d="M300 18 H305" />
            </g>
          )}
        </svg>
      </div>

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
              className={`fall-in flex items-center gap-3 rounded-[3px] border-2 px-3 py-2.5 ${tone(
                mood
              )}`}
            >
              {/* A resistor body with its legs, so each option reads as a part
                  rather than as a row. */}
              <span aria-hidden className="flex shrink-0 items-center">
                <span
                  className={`block h-px w-2.5 ${
                    mood === "right" ? "bg-solid-mark" : "bg-line-strong"
                  }`}
                />
                <span
                  className={`block h-4 w-6 rounded-[2px] border-2 ${
                    mood === "right"
                      ? "border-solid-mark bg-solid-tint"
                      : mood === "wrong"
                        ? "border-broken-mark bg-broken-tint"
                        : "border-line-strong bg-page"
                  }`}
                />
                <span
                  className={`block h-px w-2.5 ${
                    mood === "right" ? "bg-solid-mark" : "bg-line-strong"
                  }`}
                />
              </span>
              <Mark index={i} mood={mood} className="h-5 w-5 text-[0.625rem]" />
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

export const circuit: Presentation = {
  id: "circuit",
  name: "Circuit repair",
  presents: ["choice"],
  supports: (q) => (q.options?.length ?? 0) >= 3,
  Component: Circuit,
};
