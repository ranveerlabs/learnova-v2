"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { comboMultiplier, MAX_COMBO, type Provenance, type Question, type Round } from "./types";
import { formatClock } from "./engine";

/* Round Mode's own primitives.

   The session vocabulary is shared with the rest of the app wherever it
   already exists: the same mark tokens, the same faces, the same focus ring.
   What is new here is everything to do with tempo, which the marking screens
   never needed. */

const NARROW: React.CSSProperties = { fontVariationSettings: '"wdth" 88' };

/* ── Where the student is on the ladder ─────────────────────────────────── */

const RUNGS: { key: 0 | Round; label: string; short: string }[] = [
  { key: 0, label: "Cold open", short: "Open" },
  { key: 1, label: "Pick it out", short: "R1" },
  { key: 2, label: "Fill the gap", short: "R2" },
  { key: 3, label: "Build it", short: "R3" },
  { key: 4, label: "Say it yourself", short: "R4" },
];

/** The ladder, as five marks and one word.

    It used to print all five stage names across the header, which put around
    fourteen words of chrome above every question. The progression still has
    to be legible, because the help being taken away one rung at a time IS the
    product, but it does not need to be spelled out five times: only the rung
    the student is actually on is named, and the rest are marks. Every stage
    still carries its name in a tooltip and in the accessible label, so
    nothing is lost to anyone reading it with assistive technology. */
export function LadderRail({ stage }: { stage: 0 | Round }) {
  const here = RUNGS.find((r) => r.key === stage);

  return (
    <nav aria-label="Session stages" className="flex items-center gap-2.5">
      <span className="flex items-center gap-1.5">
        {RUNGS.map((rung) => {
          const done = rung.key < stage;
          const current = rung.key === stage;
          return (
            /* Shape, not just colour: a filled square is cleared, a ring is
               where you are, a faint dot is still ahead. */
            <span
              key={rung.key}
              title={rung.label}
              aria-label={`${rung.label}: ${done ? "cleared" : current ? "current" : "ahead"}`}
              aria-current={current ? "step" : undefined}
              className="grid h-2.5 w-2.5 place-items-center"
            >
              {done ? (
                <span className="block h-2.5 w-2.5 rounded-[2px] bg-solid-mark" />
              ) : current ? (
                <span className="block h-2.5 w-2.5 rounded-full border-[2px] border-accent" />
              ) : (
                <span className="block h-1.5 w-1.5 rounded-full bg-line-strong" />
              )}
            </span>
          );
        })}
      </span>
      {here && (
        <span
          style={NARROW}
          className="font-sans text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-ink-soft"
        >
          {here.label}
        </span>
      )}
    </nav>
  );
}

/* ── The speedrun clock ─────────────────────────────────────────────────── */

/** Elapsed time across the cold open and Rounds 1 to 3.

    Driven off `performance.now()` rather than counted in state, so it stays
    correct when a tab is backgrounded and the interval stops firing. */
export function RunClock({ elapsed, live }: { elapsed: () => number; live: boolean }) {
  const [ms, setMs] = useState(0);

  useEffect(() => {
    if (!live) return;
    let raf = 0;
    const tick = () => {
      setMs(elapsed());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [elapsed, live]);

  return (
    <div className="flex items-center gap-2">
      <span
        style={NARROW}
        className="hidden font-sans text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-ink-faint sm:inline"
      >
        Run
      </span>
      <span className="run-clock font-mono text-[0.9375rem] font-medium text-ink-soft">
        {formatClock(ms)}
      </span>
    </div>
  );
}

/* ── The per-question timer ─────────────────────────────────────────────── */

/** A ring that empties as the question's time runs out.

    The seconds remaining are printed inside it once things get tight, so the
    warning never depends on the colour change or on the pulse: someone who
    cannot see the hue and someone running with reduced motion both still get
    a number counting down. */
export function TimerRing({ remaining, total }: { remaining: number; total: number }) {
  const t = Math.max(0, Math.min(1, remaining / total));
  const seconds = Math.ceil(remaining / 1000);
  const urgent = remaining <= 5000;

  return (
    <div
      role="timer"
      aria-label={`${seconds} seconds left`}
      className={`ring grid h-9 w-9 place-items-center ${urgent ? "urgent" : ""}`}
      style={{ ["--t" as string]: t }}
    >
      <span className="grid h-[1.9rem] w-[1.9rem] place-items-center rounded-full bg-ground">
        <span
          className={`font-mono text-[0.6875rem] tabular-nums ${
            urgent ? "font-semibold text-shaky-ink" : "text-ink-faint"
          }`}
        >
          {seconds}
        </span>
      </span>
    </div>
  );
}

/* ── Score, streak, combo ───────────────────────────────────────────────── */

/** How far through the round, without words.

    Nine pips instead of "1/9". It reads at a glance, it costs no reading, and
    the exact count is still available to anyone who needs it through the
    accessible label. */
function Pips({ served, limit }: { served: number; limit: number }) {
  return (
    <span
      aria-label={`Question ${served} of ${limit}`}
      className="flex items-center gap-1"
    >
      {Array.from({ length: limit }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className={`block h-1 rounded-full transition-all duration-300 ${
            i < served - 1
              ? "w-1.5 bg-ink-faint"
              : i === served - 1
                ? "w-4 bg-accent"
                : "w-1.5 bg-line-strong"
          }`}
        />
      ))}
    </span>
  );
}

/** The status strip: everything that is not the question.

    One thin band, visually separate from the question area, holding progress,
    the timer, the streak and the score. These used to be spread across the
    header, the top of the question block and a line underneath it, which
    meant a student mid-retrieval had four things competing with the thing
    they were trying to retrieve. Retrieval practice is the one moment where
    peripheral chrome is not merely untidy but actively costly, so it is all
    collected here and the question area below is left with nothing else in
    it. */
export function StatusStrip({
  stage,
  served,
  limit,
  streak,
  points,
  remaining,
  total,
  scoring,
}: {
  stage: 0 | Round;
  served: number;
  limit: number;
  streak: number;
  points: number;
  remaining: number;
  total: number;
  /** False during the cold open, which is unscored. */
  scoring: boolean;
}) {
  const multiplier = comboMultiplier(streak);
  const heat = (multiplier - 1) / (MAX_COMBO - 1);

  const [bumped, setBumped] = useState(false);
  const previous = useRef(multiplier);
  useEffect(() => {
    if (multiplier > previous.current) {
      setBumped(true);
      const t = setTimeout(() => setBumped(false), 460);
      previous.current = multiplier;
      return () => clearTimeout(t);
    }
    previous.current = multiplier;
  }, [multiplier]);

  const [ticked, setTicked] = useState(false);
  const lastPoints = useRef(points);
  useEffect(() => {
    if (points !== lastPoints.current) {
      lastPoints.current = points;
      setTicked(true);
      const t = setTimeout(() => setTicked(false), 320);
      return () => clearTimeout(t);
    }
  }, [points]);

  return (
    <div className="flex items-center justify-between gap-4 border-b border-line bg-sunk/50 px-4 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <span
          style={NARROW}
          className="shrink-0 font-sans text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-ink-faint"
        >
          {stage === 0 ? "Cold open" : `Round ${stage}`}
        </span>
        <Pips served={served} limit={limit} />
      </div>

      <div className="flex shrink-0 items-center gap-4">
        {scoring && multiplier > 1 && (
          <span
            className={`combo font-mono text-[0.9375rem] font-semibold leading-none text-accent ${
              bumped ? "combo-bump" : ""
            }`}
            style={{ ["--heat" as string]: heat }}
            aria-label={`${streak} correct in a row, scoring ${multiplier} times`}
          >
            &times;{multiplier}
          </span>
        )}
        {scoring && (
          <span
            aria-label={`${points} points`}
            className={`font-mono text-[0.9375rem] font-semibold tabular-nums text-ink ${
              ticked ? "score-tick" : ""
            }`}
          >
            {points.toLocaleString()}
          </span>
        )}
        <TimerRing remaining={remaining} total={total} />
      </div>
    </div>
  );
}

/** Kept for the results screen, which shows a run's final numbers rather than
    a live one. */
export function ComboMeter({ streak, points }: { streak: number; points: number }) {
  const multiplier = comboMultiplier(streak);
  const heat = (multiplier - 1) / (MAX_COMBO - 1);

  const [bumped, setBumped] = useState(false);
  const previous = useRef(multiplier);
  useEffect(() => {
    if (multiplier > previous.current) {
      setBumped(true);
      const t = setTimeout(() => setBumped(false), 460);
      return () => clearTimeout(t);
    }
    previous.current = multiplier;
  }, [multiplier]);
  useEffect(() => {
    previous.current = multiplier;
  }, [multiplier]);

  const [ticked, setTicked] = useState(false);
  const lastPoints = useRef(points);
  useEffect(() => {
    if (points !== lastPoints.current) {
      lastPoints.current = points;
      setTicked(true);
      const t = setTimeout(() => setTicked(false), 320);
      return () => clearTimeout(t);
    }
  }, [points]);

  return (
    <div className="flex items-center gap-4">
      <div className="flex flex-col items-end">
        <span
          className={`font-mono text-[1.0625rem] font-semibold tabular-nums text-ink ${
            ticked ? "score-tick" : ""
          }`}
        >
          {points.toLocaleString()}
        </span>
        <span
          style={NARROW}
          className="font-sans text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-ink-faint"
        >
          Points
        </span>
      </div>

      {/* The multiplier only exists while a run does. Showing a dead "x1"
          between streaks would make the mechanic invisible at exactly the
          moment it starts paying out. */}
      {multiplier > 1 && (
        <div
          className={`combo flex flex-col items-center ${bumped ? "combo-bump" : ""}`}
          style={{ ["--heat" as string]: heat }}
        >
          <span className="font-mono text-[1.25rem] font-semibold leading-none text-accent">
            &times;{multiplier}
          </span>
          <span
            style={NARROW}
            className="mt-0.5 font-sans text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-accent"
          >
            {streak} in a row
          </span>
        </div>
      )}
    </div>
  );
}

/** Points flying off a correct answer. Purely decorative, so it is hidden
    from assistive technology: the score itself is already announced. */
export function PointsFly({ amount, best }: { amount: number; best: boolean }) {
  /* Sits clear above the options rather than over them. Stacked below the
     score it used to land on top of the second answer, which is both ugly and
     the one place on screen that must never be obscured. */
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute -top-8 right-0 flex items-center gap-2"
    >
      {best && (
        <span
          style={NARROW}
          className="best-pop rounded-[2px] bg-accent px-1.5 py-0.5 font-sans text-[0.5625rem] font-bold uppercase tracking-[0.1em] text-on-accent"
        >
          Fastest yet
        </span>
      )}
      <span className="points-fly font-mono text-[0.9375rem] font-semibold text-solid-ink">
        +{amount}
      </span>
    </span>
  );
}

/* ── Provenance ─────────────────────────────────────────────────────────── */

/** Where these questions came from, on screen the whole time.

    Not a one-off notice at the start. A student who joined a session halfway
    down the ladder should never have to remember whether they pasted notes to
    know whether they are being tested on their own material. */
export function ProvenanceBadge({ provenance }: { provenance: Provenance }) {
  const grounded = provenance === "grounded";
  return (
    <span
      title={
        grounded
          ? "Every question here was traced back to a verbatim line in the material you pasted."
          : "You gave a topic, not material, so these questions were written by an AI model. They are not from your own notes."
      }
      style={NARROW}
      className={`inline-flex items-center gap-1.5 rounded-[3px] border px-2 py-1 font-sans text-[0.5625rem] font-semibold uppercase tracking-[0.12em] ${
        grounded
          ? "border-solid-mark/40 bg-solid-tint text-solid-ink"
          : "border-line-strong bg-sunk text-ink-soft"
      }`}
    >
      <span aria-hidden>{grounded ? "❝" : "◇"}</span>
      {grounded ? "From your notes" : "AI-generated"}
    </span>
  );
}

/* ── Feedback ───────────────────────────────────────────────────────────── */

function Tick() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden className="shrink-0">
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
    <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden className="shrink-0">
      <rect x="0.75" y="0.75" width="13.5" height="13.5" rx="3" fill="none" stroke="var(--broken-mark)" strokeWidth="1.5" />
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

/** What just happened, in a word, a shape and a colour.

    Three channels, deliberately redundant, the same discipline the marking
    screens use. The correct answer is always shown, including when the
    student got it right, because seeing the answer confirmed is part of what
    makes the next retrieval stick. */
export function Verdict({
  correct,
  timedOut,
  answer,
  because,
  citation,
  onNext,
}: {
  correct: boolean;
  timedOut?: boolean;
  answer: string;
  because?: string;
  citation?: string;
  onNext: () => void;
}) {
  const word = timedOut ? "Time" : correct ? "Correct" : "Not quite";
  const detail = because || citation;

  /* One line, and it is the whole verdict: the word, and the answer when they
     did not get it. The reason and the citation used to sit underneath every
     miss, which meant the moment a student most needed to read six words they
     were handed forty. Detail is one tap away for anyone who wants it, and
     out of the way of everyone racing the clock. */
  return (
    <div
      role="status"
      aria-live="assertive"
      className={`deal-in flex flex-col gap-1.5 rounded-[3px] border-l-[3px] py-2.5 pl-4 pr-4 ${
        correct ? "border-solid-mark bg-solid-tint" : "border-broken-mark bg-broken-tint"
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        {correct ? <Tick /> : <Cross />}
        <span
          style={NARROW}
          className={`font-sans text-[0.75rem] font-bold uppercase tracking-[0.14em] ${
            correct ? "text-solid-ink" : "text-broken-ink"
          }`}
        >
          {word}
        </span>

        {!correct && (
          <span className="min-w-0 font-read text-[1rem] leading-tight text-ink">{answer}</span>
        )}

        {!correct && (
          <button
            onClick={onNext}
            className="btn ml-auto shrink-0 rounded-[3px] border border-line-strong px-2.5 py-1 font-sans text-[0.75rem] font-medium text-ink-soft hover:border-ink-faint hover:text-ink"
          >
            Next <span aria-hidden className="arrow">→</span>
          </button>
        )}
      </div>

      {detail && (
        <details className="group">
          <summary
            style={NARROW}
            className="inline-flex cursor-pointer list-none items-center gap-1 font-sans text-[0.5625rem] font-semibold uppercase tracking-[0.12em] text-ink-faint transition-colors hover:text-ink-soft"
          >
            <span aria-hidden className="inline-block transition-transform group-open:rotate-90">
              ›
            </span>
            Why
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            {because && (
              <p className="font-sans text-[0.8125rem] leading-[1.55] text-ink-soft">{because}</p>
            )}
            {citation && (
              <p className="border-l-2 border-line-strong pl-2.5 font-read text-[0.8125rem] italic leading-[1.5] text-ink-faint">
                &ldquo;{citation}&rdquo;
              </p>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

/* ── Answer surfaces ────────────────────────────────────────────────────── */

const KEYS = ["1", "2", "3", "4"];

/** Two or four options. Number keys pick, which is what makes a fast run
    possible on a keyboard at all. */
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
  const options = question.options ?? [];

  useEffect(() => {
    if (revealed) return;
    function onKey(e: KeyboardEvent) {
      const i = KEYS.indexOf(e.key);
      if (i >= 0 && i < options.length) {
        e.preventDefault();
        onPick(i);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [options.length, onPick, revealed]);

  return (
    <div className={`grid gap-2.5 ${options.length > 2 ? "sm:grid-cols-2" : ""}`}>
      {options.map((option, i) => {
        const isAnswer = i === question.answerIndex;
        const isChosen = i === chosen;
        const showRight = revealed && isAnswer;
        const showWrong = revealed && isChosen && !isAnswer;

        return (
          <button
            key={i}
            disabled={revealed}
            onClick={() => onPick(i)}
            style={{ ["--i" as string]: i }}
            className={`deal-in-stagger group relative flex items-center gap-3 overflow-hidden rounded-[3px] border-2 px-4 py-3.5 text-left transition-colors ${
              showRight
                ? "right-flash border-solid-mark bg-solid-tint"
                : showWrong
                  ? "miss-mark miss-shake border-broken-mark bg-broken-tint"
                  : revealed
                    ? "border-line bg-page opacity-55"
                    : "border-line bg-page hover:border-accent hover:bg-accent-wash/40"
            }`}
          >
            <span
              aria-hidden
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-[3px] border font-mono text-[0.6875rem] font-semibold ${
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
              className={`font-read text-[1.0625rem] leading-[1.35] ${
                showRight ? "font-medium text-solid-ink" : showWrong ? "text-broken-ink" : "text-ink"
              }`}
            >
              {option}
            </span>
            {showRight && (
              <span
                aria-hidden
                className="right-ring pointer-events-none absolute inset-0 rounded-[3px] border-2 border-solid-mark"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Round 2. The sentence is on screen with a gap in it, and the gap is a real
    input sitting inline where the missing words go, so the student is filling
    a sentence rather than answering a question about one. */
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
    const parts = question.prompt.split(/_{2,}/);
    return [parts[0] ?? "", parts.slice(1).join(" ")];
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
      className="deal-in flex flex-col gap-4"
    >
      <p className="font-read text-[1.1875rem] leading-[1.9] text-ink">
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
          placeholder="?"
          size={Math.max(8, value.length + 2)}
          className={`mx-1 inline-block min-w-[7rem] border-b-2 bg-transparent px-2 pb-0.5 text-center font-read text-[1.1875rem] font-medium text-ink caret-accent outline-none placeholder:text-ink-faint ${
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
          className="btn inline-flex items-center gap-2 self-start rounded-[3px] bg-accent px-5 py-2.5 font-sans text-[0.875rem] font-semibold text-on-accent disabled:cursor-not-allowed disabled:bg-sunk disabled:text-ink-faint"
        >
          Lock it in <span aria-hidden className="arrow">→</span>
        </button>
      )}
    </form>
  );
}

/** Round 3. The sentence in pieces, out of order, with distractors mixed in.

    Shuffled once per question and remembered, because a tray that reshuffles
    on every render would move a chip out from under a finger already on its
    way down. */
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
  const tray = useMemo(() => {
    const all = [...(question.chips ?? []), ...(question.distractors ?? [])];
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    return all;
  }, [question.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Chips can repeat as text, so a spent chip is tracked by its position in
     the tray rather than by its words. */
  const spent = useMemo(() => {
    const counts = new Map<string, number>();
    for (const chip of built) counts.set(chip, (counts.get(chip) ?? 0) + 1);
    return tray.map((chip) => {
      const left = counts.get(chip) ?? 0;
      if (left > 0) {
        counts.set(chip, left - 1);
        return true;
      }
      return false;
    });
  }, [built, tray]);

  return (
    <div className="deal-in flex flex-col gap-5">
      {/* The sentence being built. Holds its height whether or not anything is
          in it, so the tray below never jumps as chips are placed. */}
      <div
        aria-label="Your sentence"
        className={`flex min-h-[4.5rem] flex-wrap items-center gap-2 rounded-[3px] border-2 border-dashed p-3.5 transition-colors ${
          revealed
            ? correct
              ? "border-solid-mark bg-solid-tint"
              : "border-broken-mark bg-broken-tint"
            : built.length > 0
              ? "border-accent/50 bg-accent-wash/25"
              : "border-line-strong bg-sunk/40"
        }`}
      >
        {built.length === 0 && (
          <span className="font-sans text-[0.8125rem] text-ink-faint">
            Tap the pieces below, in order.
          </span>
        )}
        {built.map((chip, i) => (
          <button
            key={`${chip}-${i}`}
            disabled={revealed}
            onClick={() => onBuild(built.filter((_, j) => j !== i))}
            aria-label={`Remove "${chip}"`}
            className="chip chip-snap rounded-[3px] border border-accent bg-page px-3 py-1.5 font-read text-[1rem] text-ink disabled:cursor-default"
          >
            {chip}
          </button>
        ))}
      </div>

      {!revealed && (
        <>
          <div className="flex flex-wrap gap-2">
            {tray.map((chip, i) => (
              <button
                key={`${chip}-${i}`}
                disabled={spent[i]}
                onClick={() => onBuild([...built, chip])}
                style={{ ["--i" as string]: i }}
                className={`chip deal-in-stagger rounded-[3px] border border-line-strong bg-page px-3 py-1.5 font-read text-[1rem] text-ink hover:border-accent hover:bg-accent-wash/40 ${
                  spent[i] ? "chip-spent" : ""
                }`}
              >
                {chip}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onSubmit}
              disabled={built.length === 0}
              className="btn inline-flex items-center gap-2 rounded-[3px] bg-accent px-5 py-2.5 font-sans text-[0.875rem] font-semibold text-on-accent disabled:cursor-not-allowed disabled:bg-sunk disabled:text-ink-faint"
            >
              That&apos;s it <span aria-hidden className="arrow">→</span>
            </button>
            {built.length > 0 && (
              <button
                onClick={() => onBuild([])}
                className="font-sans text-[0.8125rem] font-medium text-ink-faint underline decoration-line-strong underline-offset-4 hover:text-ink"
              >
                Clear
              </button>
            )}
          </div>
        </>
      )}

      {revealed && !correct && (
        <p className="font-read text-[1rem] leading-[1.5] text-ink">
          <span className="text-ink-soft">The sentence was: </span>
          <span className="font-medium">{(question.chips ?? []).join(" ")}</span>
        </p>
      )}
    </div>
  );
}

/* ── Waiting ────────────────────────────────────────────────────────────── */

/** Every AI call gets one of these. Silence reads as broken, and this mode
    is fast enough everywhere else that two seconds of nothing would feel
    like a crash. */
export function Generating({ title, sub }: { title: string; sub: string }) {
  return (
    <div role="status" className="settle flex flex-col items-center gap-6 py-16">
      <div className="flex items-end gap-1.5" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="block w-2 rounded-[1px] bg-accent"
            style={{
              height: "2rem",
              animation: "listening 1.1s ease-in-out infinite",
              animationDelay: `${i * 110}ms`,
              opacity: 0.35 + i * 0.14,
            }}
          />
        ))}
      </div>
      <div className="text-center">
        <p className="font-sans text-[1rem] font-semibold text-ink">{title}</p>
        <p className="mt-1 font-sans text-[0.875rem] text-ink-soft">{sub}</p>
      </div>
    </div>
  );
}

/** A setting, said in words rather than left to an icon that could be read
    either way. */
function Toggle({
  on,
  onToggle,
  label,
  glyph,
}: {
  on: boolean;
  onToggle: () => void;
  label: string;
  glyph: [string, string];
}) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={on}
      title={`${label} ${on ? "on" : "off"}`}
      style={NARROW}
      className="flex items-center gap-1.5 rounded-[3px] border border-line px-2 py-1 font-sans text-[0.5625rem] font-semibold uppercase tracking-[0.12em] text-ink-faint transition-colors hover:border-line-strong hover:text-ink-soft"
    >
      <span aria-hidden>{on ? glyph[0] : glyph[1]}</span>
      <span className="hidden sm:inline">
        {label} {on ? "on" : "off"}
      </span>
    </button>
  );
}

/** Sound is off until asked for. */
export function SoundToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return <Toggle on={on} onToggle={onToggle} label="Sound" glyph={["♪", "♪̸"]} />;
}

/** Skins are on by default, and turning them off plays Plain throughout. */
export function SkinToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return <Toggle on={on} onToggle={onToggle} label="Skins" glyph={["◆", "◇"]} />;
}
