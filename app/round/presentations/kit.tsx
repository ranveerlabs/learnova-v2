"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import "./presentations.css";
import type { PresentationProps } from "./types";

/* The parts every presentation is built from.

   There are a lot of presentations and only one set of rules, so the rules
   live here rather than in each of them. Keyboard selection, the shape channel
   that carries right and wrong without colour, the accessible naming and the
   commit-once discipline are all implemented once, and a presentation that
   uses this kit gets them whether its author remembered them or not.

   The visual half is deliberately left open. Everything below takes a
   className and gets out of the way, because the entire point of having twenty
   presentations is that they do not look like each other. */

/** Number keys, in the order options are laid out. Six is more than any format
    asks for and leaves room without needing a second row of keys. */
export const KEYS = ["1", "2", "3", "4", "5", "6"];

/** What has become of one option. Never rendered as colour alone: `Mark`
    carries the same state as a glyph, and the verdict line carries it as a
    word. */
export type Mood = "idle" | "right" | "wrong" | "dimmed";

/* ── Choosing between options ────────────────────────────────────────────── */

/** Everything a presentation of `recognition` or `choice` needs.

    The keyboard handler is bound here and nowhere else, so "1 to n always
    selects" is a property of the kit rather than a promise each presentation
    makes separately. */
/** Shared plumbing for a presentation whose answer is one of the options.

    `keys` is the one thing a presentation may switch off. The number-key
    shortcut is right for every board where the options are things you press,
    and wrong for the one where the answer is a gesture: a wire board that also
    answers to the 2 key is not a wire board, it is a list of buttons with a
    picture of a cable next to it. See wire.tsx for what that costs and what
    pays for it. */
export function useOptions(props: PresentationProps, { keys = true } = {}) {
  const { question, revealed, chosen, onAnswer } = props;
  const options = useMemo(() => question.options ?? [], [question.options]);
  const answer = question.answerIndex ?? -1;

  /* Commit-once, belt and braces. The session also guards this, and a
     presentation with a stray click handler should not be able to reach it. */
  const spent = useRef(false);
  useEffect(() => {
    spent.current = false;
  }, [question.id]);

  const pick = useCallback(
    (i: number) => {
      if (revealed || spent.current) return;
      if (i < 0 || i >= options.length) return;
      spent.current = true;
      onAnswer(i);
    },
    [onAnswer, options.length, revealed]
  );

  useEffect(() => {
    if (revealed || !keys) return;
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const i = KEYS.indexOf(e.key);
      if (i >= 0 && i < options.length) {
        e.preventDefault();
        pick(i);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keys, options.length, pick, revealed]);

  const moodOf = useCallback(
    (i: number): Mood => {
      if (!revealed) return "idle";
      if (i === answer) return "right";
      if (i === chosen) return "wrong";
      return "dimmed";
    },
    [answer, chosen, revealed]
  );

  return { options, answer, chosen, revealed, pick, moodOf };
}

/* ── The shared visual vocabulary ────────────────────────────────────────── */

/** Border and fill for a mood, as utility classes. Presentations that want a
    different shape still want the same colours: a student should not have to
    relearn what right looks like because the round is drawn as doors this
    time. */
export function tone(mood: Mood, { hover = true } = {}): string {
  switch (mood) {
    case "right":
      return "border-solid-mark bg-solid-tint";
    case "wrong":
      return "border-broken-mark bg-broken-tint";
    case "dimmed":
      return "border-line bg-page opacity-55";
    case "idle":
      /* The hover lift is an offer to press, so a board where pressing does
         nothing must not make it. Only the wire board switches it off. */
      return hover
        ? "border-line-strong bg-page hover:border-accent hover:bg-accent-wash/40"
        : "border-line-strong bg-page";
  }
}

/** Ink for a mood, for the option's own words. */
export function ink(mood: Mood): string {
  switch (mood) {
    case "right":
      return "font-medium text-solid-ink";
    case "wrong":
      return "text-broken-ink";
    default:
      return "text-ink";
  }
}

/** The number key before an answer lands, the outcome as a glyph afterwards.

    This is the shape channel. It is not decoration and it is not optional:
    without it, right and wrong are a green box and a magenta box, which is a
    coin flip for a student with deuteranopia. */
export function Mark({
  index,
  mood,
  round,
  className = "",
}: {
  index: number;
  mood: Mood;
  /** Circular rather than square, for presentations whose shapes are round. */
  round?: boolean;
  className?: string;
}) {
  const face =
    mood === "right" ? "✓" : mood === "wrong" ? "✕" : KEYS[index] ?? String(index + 1);

  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center border font-mono font-semibold ${
        round ? "rounded-full" : "rounded-[2px]"
      } ${
        mood === "right"
          ? "border-solid-mark bg-solid-mark text-page"
          : mood === "wrong"
            ? "border-broken-mark text-broken-ink"
            : "border-line-strong text-ink-faint"
      } ${className || "h-6 w-6 text-[0.6875rem]"}`}
    >
      {face}
    </span>
  );
}

/** An option's words. */
export function Say({
  children,
  mood,
  className = "",
}: {
  children: React.ReactNode;
  mood: Mood;
  className?: string;
}) {
  return (
    <span className={`font-read leading-[1.3] ${ink(mood)} ${className || "text-[1.0625rem]"}`}>
      {children}
    </span>
  );
}

/** What a screen reader hears when it lands on an option.

    The number is first because the number is how it is selected. The outcome
    is appended once there is one, so a student using assistive technology
    learns the result from the option itself rather than only from the verdict
    line above it. */
export function label(index: number, option: string, mood: Mood): string {
  const state =
    mood === "right" ? ", the correct answer" : mood === "wrong" ? ", your answer, wrong" : "";
  return `${index + 1}. ${option}${state}`;
}

/** The button under every selectable thing.

    A real button, always, whatever is drawn inside it: that is what makes tab
    order, Enter, Space, focus rings and assistive technology work without each
    presentation arranging it. */
export function Pick({
  index,
  option,
  mood,
  revealed,
  onPick,
  className = "",
  style,
  children,
}: {
  index: number;
  option: string;
  mood: Mood;
  revealed: boolean;
  /** Omitted where the option is not pressable.

      Only the wire board does this, where the answer is a gesture rather than
      a press. It renders the same rectangle with the same classes and the same
      label, as a plain element instead of a button: a button that ignores its
      own click is worse than no button, because it invites the one action that
      does nothing. */
  onPick?: (i: number) => void;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  if (!onPick) {
    return (
      <div
        aria-label={label(index, option, mood)}
        style={{ ["--i" as string]: index, ...style }}
        className={`pick text-left ${className}`}
      >
        {children}
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={revealed}
      onClick={() => onPick(index)}
      aria-label={label(index, option, mood)}
      style={{ ["--i" as string]: index, ...style }}
      /* No position utility here on purpose. It used to set `relative` so a
         presentation could absolutely position something inside, and that
         quietly broke any presentation that wanted to position the button
         ITSELF: Tailwind emits `.relative` after `.absolute`, so passing
         `absolute` in `className` lost to the base class and the option landed
         in normal flow instead of where it was placed. Constellation's stars
         stacked in a column for exactly that reason. Presentations that need a
         positioning context put `relative` on a wrapper inside. */
      className={`pick text-left disabled:cursor-default ${className}`}
    >
      {children}
    </button>
  );
}

/** The area a presentation draws in.

    Only two jobs: it is the animation entrance every round shares, and it is
    the hook `prefers-reduced-motion` and the revealed state hang off, so a
    presentation can stop everything moving with a CSS selector rather than
    with a state machine of its own. */
export function Stage({
  revealed,
  className = "",
  children,
}: {
  revealed: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`stage deal-in ${className}`} data-settled={revealed ? "true" : "false"}>
      {children}
    </div>
  );
}

/* ── Filling a gap ───────────────────────────────────────────────────────── */

/** Everything a presentation of `blank` needs.

    Round 2 is typed, and every presentation of it is typed. The tempting move
    is to give the student pieces to drop into the gap, which is prettier and
    would quietly turn the rung back into recognition: the whole reason Round 2
    sits above Round 1 is that nothing on screen contains the answer. So what
    varies between these presentations is what the gap looks like and what
    happens when it is filled, never where the answer comes from. */
export function useBlank(props: PresentationProps) {
  const { question, revealed, value, onChange, onAnswer } = props;

  const [before, after] = useMemo(() => {
    const parts = question.prompt.split(/_{2,}/);
    return [parts[0] ?? "", parts.slice(1).join(" ")];
  }, [question.prompt]);

  const spent = useRef(false);
  useEffect(() => {
    spent.current = false;
  }, [question.id]);

  const submit = useCallback(() => {
    if (revealed || spent.current || !value.trim()) return;
    spent.current = true;
    onAnswer(value);
  }, [onAnswer, revealed, value]);

  return { before, after, value, onChange, submit, revealed };
}

/** The input itself, shared so every gap accepts text identically.

    Autofocus, no autocorrect, no spellcheck: a browser that quietly fixes a
    misspelled term would be answering the question. */
export function Gap({
  value,
  revealed,
  correct,
  onChange,
  onSubmit,
  questionId,
  className = "",
  size,
}: {
  value: string;
  revealed: boolean;
  correct: boolean;
  onChange: (v: string) => void;
  onSubmit: () => void;
  questionId: string;
  className?: string;
  size?: number;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!revealed) ref.current?.focus();
  }, [revealed, questionId]);

  return (
    <input
      ref={ref}
      value={value}
      disabled={revealed}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onSubmit();
        }
      }}
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      aria-label="The missing term"
      aria-invalid={revealed && !correct}
      placeholder="?"
      size={size ?? Math.max(8, value.length + 2)}
      className={`bg-transparent text-center font-read font-medium caret-accent outline-none placeholder:text-ink-faint ${
        revealed
          ? correct
            ? "text-solid-ink"
            : "text-broken-ink"
          : "text-ink"
      } ${className}`}
    />
  );
}

/** The commit control for a typed gap.

    An arrow, not a sentence. "Lock it in" was four words on screen during a
    round that is meant to have none, and the arrow says the same thing to
    anyone who has used a form before. The accessible name still spells it out. */
export function Commit({
  onSubmit,
  disabled,
  className = "",
}: {
  onSubmit: () => void;
  disabled: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSubmit}
      disabled={disabled}
      aria-label="Submit your answer"
      className={`btn grid h-11 w-11 place-items-center rounded-[3px] bg-accent font-sans text-[1.125rem] text-on-accent disabled:cursor-not-allowed disabled:bg-sunk disabled:text-ink-faint ${className}`}
    >
      <span aria-hidden className="arrow">
        →
      </span>
    </button>
  );
}
