"use client";

import { Commit, Stage, useBlank } from "../kit";
import type { Presentation, PresentationProps } from "../types";

/* Crossword slot.

   The gap is a run of cells and the answer is typed into them, letter by
   letter, the way a crossword is filled in.

   One thing this must not do, and the reason the note is here rather than in
   the commit message: the number of cells is NOT the length of the answer. A
   slot of exactly seven boxes tells a student the answer has seven letters,
   which is a hint the plain rendering does not give, and a presentation that
   makes a question easier has changed the difficulty of the rung. Difficulty
   is the question's job. So the run grows with what is typed and always keeps
   two spare cells ahead of the cursor, exactly as the plain field's width
   does, and it says nothing about the answer at any point.

   The real input sits transparently over the cells. It is a genuine text
   field, so selection, deletion, the caret, mobile keyboards, autofill being
   off and assistive technology all behave the way they do everywhere else;
   the cells underneath are a drawing of its contents. */

/** How many cells to draw. Two ahead of the typing, eight at rest. */
function cellCount(typed: string): number {
  return Math.max(8, typed.length + 2);
}

function Crossword(props: PresentationProps) {
  const { before, after, value, onChange, submit, revealed } = useBlank(props);
  const correct = props.correct;
  const cells = Array.from({ length: cellCount(value) }, (_, i) => value[i] ?? "");

  return (
    <Stage revealed={revealed} className="mx-auto flex w-full max-w-[42rem] flex-col gap-6">
      <p className="font-read text-[1.1875rem] leading-[1.8] text-ink">
        {before}
        <span className="mx-1 font-mono text-ink-faint">[ ]</span>
        {after}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <div className="flex gap-1">
            {cells.map((char, i) => (
              <span
                key={i}
                aria-hidden
                style={{ ["--i" as string]: i }}
                className={`grid h-11 w-9 place-items-center border-2 font-read text-[1.25rem] font-medium ${
                  char ? "cell-set" : ""
                } ${
                  revealed
                    ? correct
                      ? "border-solid-mark bg-solid-tint text-solid-ink"
                      : "border-broken-mark bg-broken-tint text-broken-ink"
                    : char
                      ? "border-accent bg-page text-ink"
                      : "border-line-strong bg-sunk/40 text-ink"
                }`}
              >
                {char}
              </span>
            ))}
          </div>

          {/* The field itself. Invisible, exactly the size of the run of
              cells, and the thing that actually has focus. */}
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
            className="absolute inset-0 h-full w-full cursor-text bg-transparent text-transparent caret-accent outline-none"
          />
        </div>

        {!revealed && <Commit onSubmit={submit} disabled={!value.trim()} />}
      </div>
    </Stage>
  );
}

export const crossword: Presentation = {
  id: "crossword",
  name: "Crossword slot",
  presents: ["blank"],
  Component: Crossword,
};
