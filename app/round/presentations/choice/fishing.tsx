"use client";

import { Mark, Pick, Say, Stage, tone, useOptions } from "../kit";
import type { Presentation, PresentationProps } from "../types";

/* Fishing.

   The answers drift across the water and the student catches the right one.

   This is the presentation most able to break the rule that difficulty comes
   from the question rather than from dexterity, so it is built defensively:

   - The fish never leave. They swim to the edge and turn round. Nothing can
     drift out of reach, and there is no moment when an answer is unavailable.
   - They move slowly. A full crossing takes sixteen to twenty six seconds, an
     order of magnitude longer than the fifteen second question timer, so a
     fish is effectively stationary over the time it takes to decide.
   - Everything stops the instant anyone reaches for it. Hovering the pond or
     tabbing into it pauses every fish, so a pointer or a keyboard never has to
     chase a moving target.
   - Under prefers-reduced-motion the water is still and the fish are a plain
     stack, which is a complete, playable presentation rather than a
     degradation.
   - Number keys work throughout, so the whole thing can be played without ever
     touching a moving object at all. */

/* Each lane gets its own pace and phase, so the fish never form a marching
   row. The numbers are slow on purpose; see the note above. */
const LANES = [
  { seconds: 19, delay: 0 },
  { seconds: 24, delay: -6 },
  { seconds: 16, delay: -11 },
  { seconds: 26, delay: -3 },
];

function FishingSurface(props: PresentationProps) {
  const { options, pick, moodOf, revealed } = useOptions(props);

  return (
    <Stage revealed={revealed}>
      <div className="pond flex flex-col gap-2 rounded-[3px] border border-line bg-accent-wash/25 p-3">
        {options.map((option, i) => {
          const lane = LANES[i % LANES.length];
          const mood = moodOf(i);

          return (
            <div key={i} className="lane">
              <Pick
                index={i}
                option={option}
                mood={mood}
                revealed={revealed}
                onPick={pick}
                className={`fish flex items-center gap-2.5 rounded-full border-2 px-4 py-2 ${tone(
                  mood
                )}`}
                style={{
                  animationDuration: `${lane.seconds}s`,
                  animationDelay: `${lane.delay}s`,
                }}
              >
                <Mark index={i} mood={mood} round className="h-5 w-5 text-[0.625rem]" />
                <Say mood={mood} className="whitespace-nowrap text-[1rem]">
                  {option}
                </Say>
              </Pick>
            </div>
          );
        })}
      </div>
    </Stage>
  );
}

export const fishing: Presentation = {
  id: "fishing",
  name: "Fishing",
  presents: ["recognition", "choice"],
  /* Long options cannot swim: a pill wider than the lane has nowhere to go,
     and wrapping it would make the fish taller than the water. Those questions
     fall back to Plain, which is the right presentation for them anyway. */
  supports: (q) =>
    (q.options?.length ?? 0) >= 2 && (q.options ?? []).every((o) => o.length <= 28),
  Component: FishingSurface,
};
