"use client";

import { Commit, Stage, useBlank } from "../kit";
import type { Presentation, PresentationProps } from "../types";

/* Slot machine reel.

   The gap is a bank of reels. Typing sets them; committing spins them into
   place.

   The reels are not a wheel of candidate letters to be nudged into position:
   that would be a dexterity game with a word in it. They are a readout of what
   has been typed, and the typing is a text field like every other rung of this
   round. As in the crossword, the number of reels follows what has been typed
   rather than the length of the answer, which would otherwise be a free hint
   nobody asked for.

   There is no jackpot and no near miss. A wrong answer settles as a wrong
   answer. */

function reelCount(typed: string): number {
  return Math.max(6, typed.length + 1);
}

function Reels(props: PresentationProps) {
  const { before, after, value, onChange, submit, revealed } = useBlank(props);
  const correct = props.correct;
  const faces = Array.from({ length: reelCount(value) }, (_, i) => value[i] ?? "");

  return (
    <Stage revealed={revealed} className="mx-auto flex w-full max-w-[42rem] flex-col gap-6">
      <p className="font-read text-[1.1875rem] leading-[1.8] text-ink">
        {before}
        <span className="mx-1 font-mono text-ink-faint">[ ]</span>
        {after}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        {/* The cabinet. */}
        <div
          className={`relative rounded-[5px] border-[3px] p-2 ${
            revealed
              ? correct
                ? "border-solid-mark bg-solid-tint/50"
                : "border-broken-mark bg-broken-tint/50"
              : "border-line-strong bg-sunk/50"
          }`}
        >
          <div className="flex gap-1">
            {faces.map((char, i) => (
              <span
                key={i}
                aria-hidden
                style={{ ["--i" as string]: i }}
                className={`relative grid h-12 w-9 place-items-center overflow-hidden rounded-[2px] border bg-page font-read text-[1.25rem] font-medium ${
                  revealed ? "reel-settle" : ""
                } ${
                  revealed
                    ? correct
                      ? "border-solid-mark text-solid-ink"
                      : "border-broken-mark text-broken-ink"
                    : "border-line-strong text-ink"
                }`}
              >
                {/* The ghost of the face above and below, so a reel reads as a
                    reel when it is standing still. */}
                <span className="pointer-events-none absolute inset-x-0 top-0 h-2 bg-gradient-to-b from-ink/10 to-transparent" />
                <span className="pointer-events-none absolute inset-x-0 bottom-0 h-2 bg-gradient-to-t from-ink/10 to-transparent" />
                {char}
              </span>
            ))}
          </div>

          <input
            value={value}
            disabled={revealed}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            autoFocus={!revealed}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="The missing term"
            aria-invalid={revealed && !correct}
            className="absolute inset-2 cursor-text bg-transparent text-transparent caret-accent outline-none"
          />
        </div>

        {!revealed && <Commit onSubmit={submit} disabled={!value.trim()} />}
      </div>
    </Stage>
  );
}

export const reels: Presentation = {
  id: "reels",
  name: "Slot reels",
  presents: ["blank"],
  Component: Reels,
};
