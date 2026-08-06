"use client";

import { useEffect } from "react";
import type { Question } from "../types";
import type { Skin, SkinProps } from "./types";

/* Fishing.

   The answers drift across the water and the student catches the right one.

   This is the skin most able to break the rule that difficulty comes from the
   question rather than from dexterity, so it is built defensively:

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
   - Number keys work throughout, so the whole skin can be played without ever
     touching a moving thing at all.

   The styles are inline rather than in round.css so the skin stays one
   self-contained file, which is the point of the library. */

const KEYS = ["1", "2", "3", "4"];

/* Each lane gets its own pace and phase, so the fish never form a marching
   row. The numbers are slow on purpose; see the note above. */
const LANES = [
  { seconds: 19, delay: 0 },
  { seconds: 24, delay: -6 },
  { seconds: 16, delay: -11 },
  { seconds: 26, delay: -3 },
];

const CSS = `
.pond { position: relative; display: flex; flex-direction: column; gap: 0.5rem; }
.lane { position: relative; height: 3.25rem; overflow: hidden; }
.fish {
  position: absolute; top: 50%; left: 0;
  animation-name: swim;
  animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1);
  animation-iteration-count: infinite;
  animation-direction: alternate;
}
@keyframes swim {
  from { left: 0%;   transform: translate(0, -50%); }
  to   { left: 100%; transform: translate(-100%, -50%); }
}
/* Reaching for a fish stops the whole pond, so nothing is ever chased. */
.pond:hover .fish,
.pond:focus-within .fish,
.pond[data-still="true"] .fish { animation-play-state: paused; }

@media (prefers-reduced-motion: reduce) {
  .lane { height: auto; overflow: visible; }
  .fish { position: static; animation: none; transform: none; }
}
`;

function FishingSurface({ question, revealed, chosen, onAnswer }: SkinProps) {
  const options = question.options ?? [];
  const answer = question.answerIndex ?? -1;

  useEffect(() => {
    if (revealed) return;
    function onKey(e: KeyboardEvent) {
      const i = KEYS.indexOf(e.key);
      if (i >= 0 && i < options.length) {
        e.preventDefault();
        onAnswer(i);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [options.length, onAnswer, revealed]);

  return (
    <div className="deal-in">
      <style>{CSS}</style>

      {/* The water. Decorative, and the only thing this skin adds that is not
          a question or an option. */}
      <div
        className="pond rounded-[3px] border border-line bg-accent-wash/25 p-3"
        data-still={revealed ? "true" : "false"}
      >
        {options.map((option, i) => {
          const lane = LANES[i % LANES.length];
          const isAnswer = i === answer;
          const isChosen = i === chosen;
          const showRight = revealed && isAnswer;
          const showWrong = revealed && isChosen && !isAnswer;

          return (
            <div key={i} className="lane">
              <button
                disabled={revealed}
                onClick={() => onAnswer(i)}
                className={`fish flex items-center gap-2.5 rounded-full border-2 px-4 py-2 text-left transition-colors ${
                  showRight
                    ? "right-flash border-solid-mark bg-solid-tint"
                    : showWrong
                      ? "miss-mark border-broken-mark bg-broken-tint"
                      : revealed
                        ? "border-line bg-page opacity-55"
                        : "border-line-strong bg-page hover:border-accent hover:bg-accent-wash"
                }`}
                style={{
                  animationDuration: `${lane.seconds}s`,
                  animationDelay: `${lane.delay}s`,
                }}
              >
                <span
                  aria-hidden
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border font-mono text-[0.625rem] font-semibold ${
                    showRight
                      ? "border-solid-mark bg-solid-mark text-page"
                      : showWrong
                        ? "border-broken-mark text-broken-ink"
                        : "border-line-strong text-ink-faint"
                  }`}
                >
                  {showRight ? "✓" : showWrong ? "✕" : KEYS[i]}
                </span>
                <span
                  className={`whitespace-nowrap font-read text-[1rem] leading-tight ${
                    showRight
                      ? "font-medium text-solid-ink"
                      : showWrong
                        ? "text-broken-ink"
                        : "text-ink"
                  }`}
                >
                  {option}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const fishing: Skin = {
  id: "fishing",
  name: "Fishing",
  presents: ["recognition", "choice"],
  /* Long options cannot swim: a pill wider than the lane has nowhere to go,
     and wrapping it would make the fish taller than the water. Those
     questions fall back to Plain, which is the right presentation for them
     anyway. */
  supports: (q: Question) =>
    (q.options?.length ?? 0) >= 2 && (q.options ?? []).every((o) => o.length <= 28),
  Component: FishingSurface,
};
