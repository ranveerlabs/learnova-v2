"use client";

import { Commit, Gap, Stage, useBlank } from "../kit";
import type { Presentation, PresentationProps } from "../types";

/* Key and lock.

   The sentence has a lock in it. What the student types is cut into the key,
   and committing turns it.

   The lock does not open on a wrong answer and it does not half open on a near
   one. Grading is decided in engine.ts and this draws the result: a
   presentation that softened a miss into "nearly turned" would be the same
   flattery the rest of the app refuses, dressed as an animation. */

function KeyLock(props: PresentationProps) {
  const { before, after, value, onChange, submit, revealed } = useBlank(props);
  const correct = props.correct;
  const turned = revealed && correct;

  const stroke = revealed
    ? correct
      ? "var(--solid-mark)"
      : "var(--broken-mark)"
    : "var(--line-strong)";

  return (
    <Stage revealed={revealed} className="mx-auto flex w-full max-w-[42rem] flex-col gap-7">
      <p className="font-read text-[1.1875rem] leading-[1.8] text-ink">
        {before}
        <span
          aria-hidden
          className="mx-1.5 inline-flex translate-y-[0.2em] items-center"
        >
          {/* The lock: a shackle and a body with a keyhole. */}
          <svg width="30" height="34" viewBox="0 0 30 34">
            <path
              d={turned ? "M9 14 V9 a6 6 0 0 1 12 0" : "M9 14 V9 a6 6 0 0 1 12 0 V14"}
              fill="none"
              stroke={stroke}
              strokeWidth="2.4"
              strokeLinecap="round"
              style={{ transition: "d 300ms ease" }}
            />
            <rect
              x="3"
              y="14"
              width="24"
              height="18"
              rx="3"
              fill={
                revealed
                  ? correct
                    ? "var(--solid-tint)"
                    : "var(--broken-tint)"
                  : "var(--sunk)"
              }
              stroke={stroke}
              strokeWidth="2.2"
            />
            <circle cx="15" cy="21" r="2.6" fill={stroke} />
            <path d="M15 23 V27" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </span>
        {after}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        {/* The key. Its bit is the field. */}
        <div className={`flex items-center ${turned ? "key-turn" : ""}`}>
          <span
            aria-hidden
            className={`grid h-9 w-9 place-items-center rounded-full border-[3px] ${
              revealed
                ? correct
                  ? "border-solid-mark bg-solid-tint"
                  : "border-broken-mark bg-broken-tint"
                : "border-accent bg-page"
            }`}
          >
            <span
              className={`block h-2.5 w-2.5 rounded-full ${
                revealed
                  ? correct
                    ? "bg-solid-mark"
                    : "bg-broken-mark"
                  : "bg-accent"
              }`}
            />
          </span>

          <div
            className={`-ml-1 flex items-center gap-1 border-y-[3px] border-r-[3px] px-3 py-1.5 ${
              revealed
                ? correct
                  ? "border-solid-mark bg-solid-tint"
                  : "border-broken-mark bg-broken-tint"
                : "border-accent bg-page"
            }`}
            style={{ borderRadius: "0 4px 4px 0" }}
          >
            <Gap
              value={value}
              revealed={revealed}
              correct={correct}
              onChange={onChange}
              onSubmit={submit}
              questionId={props.question.id}
              className="text-[1.125rem]"
            />
            {/* The teeth. */}
            <span aria-hidden className="flex items-end gap-0.5 self-stretch pb-0.5">
              {[10, 6, 9].map((h, n) => (
                <span
                  key={n}
                  className={`block w-1 rounded-t-[1px] ${
                    revealed
                      ? correct
                        ? "bg-solid-mark"
                        : "bg-broken-mark"
                      : "bg-accent"
                  }`}
                  style={{ height: `${h}px` }}
                />
              ))}
            </span>
          </div>
        </div>

        {!revealed && <Commit onSubmit={submit} disabled={!value.trim()} />}
      </div>
    </Stage>
  );
}

export const keylock: Presentation = {
  id: "keylock",
  name: "Key and lock",
  presents: ["blank"],
  Component: KeyLock,
};
