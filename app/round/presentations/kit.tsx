"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import "./presentations.css";
import type { PresentationProps } from "./types";

export type Mood = "idle" | "right" | "wrong" | "dimmed";

export function useOptions(props: PresentationProps) {
  const { question, revealed, chosen, onAnswer } = props;
  const options = useMemo(() => question.options ?? [], [question.options]);
  const answer = question.answerIndex ?? -1;

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
    [onAnswer, options.length, revealed],
  );

  const moodOf = useCallback(
    (i: number): Mood => {
      if (!revealed) return "idle";
      if (i === answer) return "right";
      if (i === chosen) return "wrong";
      return "dimmed";
    },
    [answer, chosen, revealed],
  );

  return { options, answer, chosen, revealed, pick, moodOf };
}

export function tone(mood: Mood, { hover = true } = {}) {
  switch (mood) {
    case "right":
      return "border-solid-mark bg-solid-tint";
    case "wrong":
      return "border-broken-mark bg-broken-tint";
    case "dimmed":
      return "border-line bg-page opacity-55";
    case "idle":
      return hover
        ? "border-line-strong bg-page hover:border-accent hover:bg-accent-wash/40"
        : "border-line-strong bg-page";
  }
}

export function ink(mood: Mood) {
  switch (mood) {
    case "right":
      return "font-medium text-solid-ink";
    case "wrong":
      return "text-broken-ink";
    default:
      return "text-ink";
  }
}

export function Mark({
  mood,
  className = "",
}: {
  mood: Mood;
  className?: string;
}) {
  const face = mood === "right" ? "✓" : mood === "wrong" ? "✕" : "";

  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center border font-mono font-semibold ${
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
    <span
      className={`font-read leading-[1.3] ${ink(mood)} ${className || "text-[1.0625rem]"}`}
    >
      {children}
    </span>
  );
}

export function label(option: string, mood: Mood) {
  const state =
    mood === "right"
      ? ", the correct answer"
      : mood === "wrong"
        ? ", your answer, wrong"
        : "";
  return `${option}${state}`;
}

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
  onPick?: (i: number) => void;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  if (!onPick) {
    return (
      <div
        aria-label={label(option, mood)}
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
      aria-label={label(option, mood)}
      style={{ ["--i" as string]: index, ...style }}
      className={`pick text-left disabled:cursor-default ${className}`}
    >
      {children}
    </button>
  );
}

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
    <div
      className={`stage deal-in ${className}`}
      data-settled={revealed ? "true" : "false"}
    >
      {children}
    </div>
  );
}
