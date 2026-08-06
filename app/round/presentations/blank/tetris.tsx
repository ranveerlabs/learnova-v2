"use client";

import { Commit, Gap, Stage, useBlank } from "../kit";
import type { Presentation, PresentationProps } from "../types";

/* Tetris block drop.

   The sentence is the bottom row of a well with one cell missing. What the
   student types rides in the piece above it, and the piece lands in the gap
   when they commit.

   The piece is typed into, not chosen and not steered. There is no version of
   this where blocks of candidate words fall and one is caught: Round 2 exists
   because Round 1 already showed the student four options and this rung takes
   them away. Putting the answer on a falling block would hand it straight
   back, and would put a timing element in front of a question that is already
   on a clock. */

function Tetris(props: PresentationProps) {
  const { before, after, value, onChange, submit, revealed } = useBlank(props);
  const correct = props.correct;

  return (
    <Stage revealed={revealed} className="mx-auto w-full max-w-[42rem]">
      <div className="rounded-t-[3px] border-x-2 border-t-2 border-dashed border-line-strong bg-sunk/30 px-4 pb-2 pt-4">
        {/* The piece. Held at the top of the well until it is committed. */}
        <div className="flex min-h-[3.5rem] items-center justify-center">
          <div
            className={`flex items-center gap-2 rounded-[3px] border-2 px-3 py-2 ${
              revealed
                ? correct
                  ? "block-drop border-solid-mark bg-solid-tint"
                  : "block-drop border-broken-mark bg-broken-tint"
                : "border-accent bg-accent-wash/50"
            }`}
          >
            {/* The four studs that make it a piece rather than a box. */}
            <span aria-hidden className="grid grid-cols-2 gap-0.5">
              {[0, 1, 2, 3].map((n) => (
                <span
                  key={n}
                  className={`block h-1.5 w-1.5 rounded-[1px] ${
                    revealed
                      ? correct
                        ? "bg-solid-mark"
                        : "bg-broken-mark"
                      : "bg-accent/60"
                  }`}
                />
              ))}
            </span>
            <Gap
              value={value}
              revealed={revealed}
              correct={correct}
              onChange={onChange}
              onSubmit={submit}
              questionId={props.question.id}
              className="text-[1.125rem]"
            />
          </div>
        </div>
      </div>

      {/* The row it lands in. */}
      <div
        className={`flex flex-wrap items-center gap-x-1.5 gap-y-2 rounded-b-[3px] border-2 px-4 py-4 ${
          revealed
            ? correct
              ? "border-solid-mark bg-solid-tint/60"
              : "border-broken-mark bg-broken-tint/60"
            : "border-line-strong bg-page"
        }`}
      >
        <p className="font-read text-[1.125rem] leading-[1.7] text-ink">
          {before}
          <span
            className={`mx-1 inline-block min-w-[5rem] rounded-[2px] px-2 py-0.5 text-center align-baseline ${
              revealed
                ? correct
                  ? "bg-solid-mark/15 font-medium text-solid-ink"
                  : "bg-broken-mark/15 font-medium text-broken-ink"
                : "slot-empty"
            }`}
          >
            {revealed ? value || "—" : " "}
          </span>
          {after}
        </p>

        {!revealed && (
          <span className="ml-auto">
            <Commit onSubmit={submit} disabled={!value.trim()} />
          </span>
        )}
      </div>
    </Stage>
  );
}

export const tetris: Presentation = {
  id: "tetris",
  name: "Block drop",
  presents: ["blank"],
  Component: Tetris,
};
