"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { type Provenance, type Question, type Round } from "./types";
import { formatClock } from "./engine";

const NARROW: React.CSSProperties = { fontVariationSettings: '"wdth" 88' };

const RUNGS: { key: 0 | Round; label: string }[] = [
  { key: 0, label: "Warm up" },
  { key: 1, label: "Pick it out" },
  { key: 2, label: "Fill the gap" },
  { key: 3, label: "Build it" },
  { key: 4, label: "Say it yourself" },
];

export function LadderRail({
  stage,
  finished = false,
}: {
  stage: 0 | Round;
  finished?: boolean;
}) {
  const here = RUNGS.find((r) => r.key === stage);

  return (
    <nav
      aria-label="Session stages"
      className="flex min-w-0 items-center gap-1.5 sm:gap-2.5"
    >
      <span className="flex shrink-0 items-center gap-1 sm:gap-1.5">
        {RUNGS.map((rung) => {
          const done = finished || rung.key < stage;
          const current = !finished && rung.key === stage;
          return (
            <span
              key={rung.key}
              title={rung.label}
              aria-label={`${rung.label}: ${done ? "cleared" : current ? "current" : "ahead"}`}
              aria-current={current ? "step" : undefined}
              className="grid h-2.5 w-2.5 place-items-center"
            >
              {done ? (
                <span className="block h-2.5 w-2.5 bg-supply-mint" />
              ) : current ? (
                <span className="block h-2.5 w-2.5 border-[2px] border-supply-gold" />
              ) : (
                <span className="block h-1.5 w-1.5 bg-line-strong" />
              )}
            </span>
          );
        })}
      </span>
      {(finished || here) && (
        <span
          style={NARROW}
          className={`truncate font-sans text-[0.625rem] font-semibold uppercase tracking-[0.12em] ${
            finished ? "text-supply-mint" : "text-ink-soft"
          }`}
        >
          {finished ? "Finished" : here?.label}
        </span>
      )}
    </nav>
  );
}

export function RunClock({
  elapsed,
  live,
}: {
  elapsed: () => number;
  live: boolean;
}) {
  const [ms, setMs] = useState(0);

  useEffect(() => {
    if (!live) {
      setMs(elapsed());
      return;
    }
    let raf = 0;
    const tick = () => {
      setMs(elapsed());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [elapsed, live]);

  return (
    <span className="run-clock shrink-0 font-mono text-[0.8125rem] font-medium text-ink-soft sm:text-[0.9375rem]">
      {formatClock(ms)}
    </span>
  );
}

export function TimerRing({
  remaining,
  total,
  cheering = false,
}: {
  remaining: number;
  total: number;
  cheering?: boolean;
}) {
  const t = Math.max(0, Math.min(1, remaining / total));
  const seconds = Math.ceil(remaining / 1000);
  const urgent = remaining <= 5000;

  const size = "clamp(2.75rem,9vh,4rem)";

  return (
    <div
      role="timer"
      aria-label={`${seconds} seconds left`}
      className={`ring grid shrink-0 place-items-center ${urgent ? "urgent" : ""} ${
        cheering ? "clock-cheer" : ""
      }`}
      style={{
        height: size,
        width: size,
        ["--t" as string]: t,
        ...(cheering ? { ["--ring-ink" as string]: "var(--solid-mark)" } : {}),
      }}
    >
      <span
        className={`relative grid h-full w-full place-items-center font-pixel text-[clamp(0.9rem,2.8vh,1.25rem)] ${
          cheering ? "text-solid-ink" : urgent ? "text-broken-ink" : "text-ink"
        }`}
      >
        {seconds}
      </span>
    </div>
  );
}

export function ProvenanceBadge({ provenance }: { provenance: Provenance }) {
  const grounded = provenance === "grounded";
  return (
    <span
      title={
        grounded
          ? "Every question here was traced back to a verbatim line in the material you pasted."
          : "You gave a topic, not material. Every question and answer here was written by an AI model and checked against nothing. It can be confidently wrong."
      }
      style={NARROW}
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap border px-1.5 py-1 font-sans text-[0.5625rem] font-semibold uppercase tracking-[0.08em] sm:gap-1.5 sm:px-2 sm:tracking-[0.12em] ${
        grounded
          ? "border-solid-mark/40 bg-solid-tint text-solid-ink"
          : "border-line-strong bg-sunk text-ink-soft"
      }`}
    >
      <span aria-hidden>{grounded ? "❝" : "◇"}</span>
      {grounded ? "From your notes" : "AI · unchecked"}
    </span>
  );
}

function Tick() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 15 15"
      aria-hidden
      className="shrink-0"
    >
      <rect width="15" height="15" rx="3" fill="var(--solid-mark)" />
      <path
        d="M3.8 7.7 6.2 10.1 11.1 4.9"
        fill="none"
        stroke="var(--page)"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="draw-check"
      />
    </svg>
  );
}

function Cross() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 15 15"
      aria-hidden
      className="shrink-0"
    >
      <rect
        x="0.75"
        y="0.75"
        width="13.5"
        height="13.5"
        rx="3"
        fill="none"
        stroke="var(--broken-mark)"
        strokeWidth="1.5"
      />
      <path
        d="M5 5l5 5M10 5l-5 5"
        fill="none"
        stroke="var(--broken-mark)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Verdict({
  correct,
  timedOut,
  answer,
  onNext,
}: {
  correct: boolean;
  timedOut?: boolean;
  answer: string;
  onNext: () => void;
}) {
  const word = timedOut ? "Time" : correct ? "Correct" : "Not quite";

  return (
    <div
      role="status"
      aria-live="assertive"
      className={`deal-in flex w-full shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-l-[5px] py-2 pl-3 pr-3 sm:gap-x-4 sm:border-l-[6px] sm:py-3 sm:pl-5 sm:pr-5 ${
        correct
          ? "border-solid-mark bg-solid-tint"
          : "border-broken-mark bg-broken-tint"
      }`}
    >
      {correct ? <Tick /> : <Cross />}
      <span
        style={NARROW}
        className={`verdict-in font-sans text-[clamp(1rem,0.8rem+0.8vw,1.5rem)] font-bold uppercase tracking-[0.1em] ${
          correct ? "text-solid-ink" : "text-broken-ink"
        }`}
      >
        {word}
      </span>

      {!correct && (
        <span className="min-w-0 font-read text-[clamp(1.125rem,0.9rem+0.9vw,1.625rem)] leading-tight text-ink">
          {answer}
        </span>
      )}

      <button
        onClick={onNext}
        aria-label="Next question"
        className="btn ml-auto flex min-h-[2.5rem] min-w-[3rem] shrink-0 items-center justify-center gap-2 border-2 border-line-strong px-3 py-1.5 font-sans text-[0.875rem] font-semibold text-ink-soft hover:border-accent hover:text-ink"
      >
        <kbd className="bg-sunk px-2 py-0.5 font-mono text-[0.75rem] pointer-coarse:hidden">
          Enter
        </kbd>
        <span
          style={NARROW}
          className="hidden font-sans text-[0.8125rem] font-semibold uppercase tracking-[0.08em] pointer-coarse:inline"
        >
          Tap
        </span>
        <span aria-hidden className="arrow">
          →
        </span>
      </button>
    </div>
  );
}

const KEYS = ["1", "2", "3", "4"];

export function ChoiceGrid({
  question,
  chosen,
  revealed,
  onPick,
}: {
  question: Question;
  chosen: number | null;
  revealed: boolean;
  onPick: (index: number) => void;
}) {
  const opts = question.options ?? [];

  useEffect(() => {
    if (revealed) return;
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const i = KEYS.indexOf(e.key);
      if (i >= 0 && i < opts.length) {
        e.preventDefault();
        onPick(i);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [opts.length, onPick, revealed]);

  const many = opts.length > 2;

  return (
    <div
      className={`grid min-h-0 flex-1 content-center gap-2.5 sm:gap-3 [grid-auto-rows:minmax(0,1fr)] ${
        many
          ? "max-h-[30rem] sm:max-h-[15.5rem] sm:grid-cols-2"
          : "max-h-[16rem]"
      }`}
    >
      {opts.map((o, i) => {
        const right = i === question.answerIndex;
        const mine = i === chosen;
        const showRight = revealed && right;
        const showWrong = revealed && mine && !right;

        return (
          <button
            key={i}
            disabled={revealed}
            onClick={() => onPick(i)}
            style={{ ["--i" as string]: i }}
            className={`deal-in-stagger group relative flex min-h-0 items-center gap-3 overflow-hidden border-[3px] px-3.5 py-2 text-left transition-colors sm:gap-4 sm:px-5 sm:py-4 ${
              showRight
                ? "right-flash right-pop right-sheen border-solid-mark bg-solid-tint"
                : showWrong
                  ? "miss-mark miss-shake border-broken-mark bg-broken-tint"
                  : revealed
                    ? "border-line bg-page opacity-55"
                    : "border-line-strong bg-page hover:border-accent hover:bg-accent-wash/40"
            }`}
          >
            <span
              aria-hidden
              className={`grid h-[clamp(1.75rem,4.2vh,2.25rem)] w-[clamp(1.75rem,4.2vh,2.25rem)] shrink-0 place-items-center border-2 font-mono text-[0.8125rem] font-semibold sm:text-[0.9375rem] ${
                showRight
                  ? "border-solid-mark bg-solid-mark text-page"
                  : showWrong
                    ? "border-broken-mark text-broken-ink"
                    : "border-line-strong text-ink-faint group-hover:border-accent group-hover:text-accent"
              }`}
            >
              {showRight ? "✓" : showWrong ? "✕" : KEYS[i]}
            </span>
            <span
              className={`min-w-0 font-read text-[clamp(1rem,0.7rem+1.1vw+0.7vh,2.125rem)] leading-[1.2] ${
                showRight
                  ? "font-medium text-solid-ink"
                  : showWrong
                    ? "text-broken-ink"
                    : "text-ink"
              }`}
            >
              {o}
            </span>
            {showRight && (
              <span
                aria-hidden
                className="right-ring pointer-events-none absolute inset-0 border-[3px] border-solid-mark"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

export function BlankField({
  question,
  value,
  revealed,
  correct,
  onChange,
  onSubmit,
}: {
  question: Question;
  value: string;
  revealed: boolean;
  correct: boolean;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [before, after] = useMemo(() => {
    const p = question.prompt.split(/_{2,}/);
    return [p[0] ?? "", p.slice(1).join("")];
  }, [question.prompt]);

  useEffect(() => {
    if (!revealed) ref.current?.focus();
  }, [revealed, question.id]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!revealed && value.trim()) onSubmit();
      }}
      className="deal-in flex min-h-0 flex-wrap content-center items-center gap-3 sm:gap-5"
    >
      <p className="font-read text-[clamp(1.125rem,0.8rem+1.1vw+0.8vh,2.25rem)] leading-[1.6] text-ink sm:leading-[1.7]">
        {before}
        <input
          ref={ref}
          value={value}
          disabled={revealed}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="The missing term"
          aria-invalid={revealed && !correct}
          placeholder="?"
          size={Math.max(8, value.length + 2)}
          className={`mx-1 inline-block min-w-[6rem] max-w-full border-b-[3px] bg-transparent px-2 pb-1 text-center font-read text-[clamp(1.125rem,0.8rem+1.1vw+0.8vh,2.25rem)] font-medium text-ink caret-accent outline-none placeholder:text-ink-faint sm:min-w-[9rem] ${
            revealed
              ? correct
                ? "border-solid-mark text-solid-ink"
                : "border-broken-mark text-broken-ink line-through decoration-broken-mark/60"
              : "border-accent"
          }`}
        />
        {after}
      </p>

      {!revealed && (
        <button
          type="submit"
          disabled={!value.trim()}
          aria-label="Submit your answer"
          className="btn grid h-11 w-11 place-items-center bg-accent font-sans text-[1.125rem] text-on-accent disabled:cursor-not-allowed disabled:bg-sunk disabled:text-ink-faint"
        >
          <span aria-hidden className="arrow">
            →
          </span>
        </button>
      )}
    </form>
  );
}

export function ChipBoard({
  question,
  built,
  revealed,
  correct,
  onBuild,
  onSubmit,
}: {
  question: Question;
  built: string[];
  revealed: boolean;
  correct: boolean;
  onBuild: (chips: string[]) => void;
  onSubmit: () => void;
}) {
  const tray = useMemo(
    () => question.tray ?? question.chips ?? [],
    [question.tray, question.chips],
  );

  const spent = useMemo(() => {
    const n = new Map<string, number>();
    for (const c of built) n.set(c, (n.get(c) ?? 0) + 1);
    return tray.map((c) => {
      const left = n.get(c) ?? 0;
      if (left <= 0) return false;
      n.set(c, left - 1);
      return true;
    });
  }, [built, tray]);

  useEffect(() => {
    if (revealed) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Enter" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (built.length === 0) return;
      e.preventDefault();
      onSubmit();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [built.length, onSubmit, revealed]);

  return (
    <div className="deal-in flex min-h-0 flex-col justify-center gap-3 sm:gap-5">
      <div
        aria-label="Your sentence"
        className={`flex min-h-[clamp(3.25rem,12vh,6rem)] shrink-0 flex-wrap items-center gap-2 border-[3px] border-dashed p-2.5 transition-colors sm:gap-2.5 sm:p-4 ${
          revealed
            ? correct
              ? "border-solid-mark bg-solid-tint"
              : "border-broken-mark bg-broken-tint"
            : built.length > 0
              ? "border-accent/50 bg-accent-wash/25"
              : "border-line-strong bg-sunk/40"
        }`}
      >
        {built.map((chip, i) => (
          <button
            key={`${chip}-${i}`}
            disabled={revealed}
            onClick={() => onBuild(built.filter((_, j) => j !== i))}
            aria-label={`Remove"${chip}"`}
            className="chip chip-snap border-2 border-accent bg-page px-3 py-1.5 font-read sm:px-4 sm:py-2 text-[clamp(0.9375rem,0.75rem+0.5vw+0.4vh,1.4375rem)] text-ink disabled:cursor-default"
          >
            {chip}
          </button>
        ))}
      </div>

      {!revealed && (
        <>
          <div className="flex min-h-0 shrink flex-wrap gap-2 overflow-y-auto sm:gap-2.5">
            {tray.map((chip, i) => (
              <button
                key={`${chip}-${i}`}
                disabled={spent[i]}
                onClick={() => onBuild([...built, chip])}
                style={{ ["--i" as string]: i }}
                className={`chip deal-in-stagger border-2 border-line-strong bg-page px-3 py-1.5 font-read text-[clamp(0.9375rem,0.75rem+0.5vw+0.4vh,1.4375rem)] text-ink hover:border-accent hover:bg-accent-wash/40 sm:px-4 sm:py-2 ${
                  spent[i] ? "chip-spent" : ""
                }`}
              >
                {chip}
              </button>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <button
              onClick={onSubmit}
              disabled={built.length === 0}
              aria-label="Submit your sentence"
              className="btn grid h-11 w-11 place-items-center bg-accent font-sans text-[1.125rem] text-on-accent disabled:cursor-not-allowed disabled:bg-sunk disabled:text-ink-faint"
            >
              <span aria-hidden className="arrow">
                →
              </span>
            </button>
            {built.length > 0 && (
              <button
                onClick={() => onBuild([])}
                aria-label="Clear your sentence"
                className="grid h-11 w-11 place-items-center border border-line-strong font-sans text-[1.125rem] text-ink-faint hover:border-ink-faint hover:text-ink"
              >
                <span aria-hidden>×</span>
              </button>
            )}
          </div>
        </>
      )}

      {revealed && !correct && (
        <p className="font-read text-[1rem] leading-[1.5] text-ink">
          {(question.chips ?? []).join("")}
        </p>
      )}
    </div>
  );
}

export function PlainEscape({ onChoose }: { onChoose: () => void }) {
  return (
    <button
      onClick={onChoose}
      className="sr-only bg-accent px-4 py-2 font-sans text-[0.875rem] font-semibold text-on-accent focus:not-sr-only focus:absolute focus:left-0 focus:top-0 focus:z-40"
    >
      Switch to the plain view for the rest of this session
    </button>
  );
}
