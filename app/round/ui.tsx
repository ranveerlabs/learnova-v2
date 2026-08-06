"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { comboMultiplier, MAX_COMBO, type Provenance, type Question, type Round } from "./types";
import { formatClock } from "./engine";

/* Round Mode's own primitives.

   ── What is allowed on screen during a round ─────────────────────────────
   The question, the options, the timer, and the combo multiplier when it is
   above one. That is the complete list, and everything that used to sit
   alongside them has been moved or deleted:

   points and the running total   → between rounds, and the results screen
   the round name and the pip row → gone; the question is on screen, which is
                                    the only fact a student mid-retrieval needs
   the run clock and the ghost    → between rounds, and the results screen
   "Fastest yet", points flying   → gone
   the "Why" disclosure on a miss → gone, on the grounds that a round moving at
                                    this pace never gave anyone time to open it
   instructions of any kind       → gone

   This is not tidiness. Retrieval is the one moment where peripheral chrome is
   not merely untidy but actively costly: everything in the corner of the eye
   is competing for the working memory that the retrieval itself needs. The
   totals still exist, they are still real, and they are shown at the moments
   when looking at them is not taking anything away. */

const NARROW: React.CSSProperties = { fontVariationSettings: '"wdth" 88' };

/* ── Where the student is on the ladder ─────────────────────────────────── */

const RUNGS: { key: 0 | Round; label: string }[] = [
  { key: 0, label: "Warm up" },
  { key: 1, label: "Pick it out" },
  { key: 2, label: "Fill the gap" },
  { key: 3, label: "Build it" },
  { key: 4, label: "Say it yourself" },
];

/** The ladder, as five marks and one word.

    Shown between rounds and on the way in and out of them. Not during one:
    the rung a student is on is not something they need reminding of while
    they are standing on it. */
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

/** Elapsed time across the warm up and Rounds 1 to 3.

    Driven off `performance.now()` rather than counted in state, so it stays
    correct when a tab is backgrounded and the interval stops firing. Never
    rendered during a question. */
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
    <span className="run-clock font-mono text-[0.9375rem] font-medium text-ink-soft">
      {formatClock(ms)}
    </span>
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

/* ── The only two things beside the question ────────────────────────────── */

/** The timer, the combo multiplier once it is worth something, and the two
    audio controls.

    The multiplier appears at two times and not before. A dead "x1" sitting
    there through every ordinary answer would be four more characters of chrome
    reporting that nothing is happening.

    The audio toggles are here rather than in the header because the header is
    empty during a round, and a mute control that disappears the moment the
    round starts is a mute control for nobody. */
export function RoundHud({
  streak,
  remaining,
  total,
  scoring,
  music,
  sound,
  onMusic,
  onSound,
}: {
  streak: number;
  remaining: number;
  total: number;
  /** False during the warm up, which is unscored. */
  scoring: boolean;
  music: boolean;
  sound: boolean;
  onMusic: () => void;
  onSound: () => void;
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

  return (
    <div className="flex items-center justify-end gap-3">
      {scoring && multiplier > 1 && (
        <span
          className={`combo mr-1 font-mono text-[1.0625rem] font-semibold leading-none text-accent ${
            bumped ? "combo-bump" : ""
          }`}
          style={{ ["--heat" as string]: heat }}
          aria-label={`${streak} correct in a row, scoring ${multiplier} times`}
        >
          &times;{multiplier}
        </span>
      )}
      <MusicToggle on={music} onToggle={onMusic} />
      <SoundToggle on={sound} onToggle={onSound} />
      <TimerRing remaining={remaining} total={total} />
    </div>
  );
}

/* ── Provenance ─────────────────────────────────────────────────────────── */

/** Where these questions came from.

    Shown on every screen that is not a live question: the entry, the beat
    between rounds, Round 4 and the results. A student is never left guessing
    whether they are being tested on their own material, and it is never
    implied that invented questions came from their notes. */
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

/** What just happened, in a word, a shape and a colour.

    Three channels, deliberately redundant, the same discipline the marking
    screens use. The correct answer is always shown, including when the student
    got it right, because seeing the answer confirmed is part of what makes the
    next retrieval stick.

    There used to be a "Why" disclosure here holding the one line explanation
    and the citation. It is gone. Correct answers hold for six hundred
    milliseconds and misses for two seconds, and nothing anyone has to decide
    to open, then open, then read, fits in that. It was a control that looked
    like a feature and functioned as decoration. */
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
      className={`deal-in flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-[3px] border-l-[3px] py-2.5 pl-4 pr-4 ${
        correct ? "border-solid-mark bg-solid-tint" : "border-broken-mark bg-broken-tint"
      }`}
    >
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
          aria-label="Next question"
          className="btn ml-auto shrink-0 rounded-[3px] border border-line-strong px-2.5 py-1 font-sans text-[0.875rem] text-ink-soft hover:border-ink-faint hover:text-ink"
        >
          <span aria-hidden className="arrow">
            →
          </span>
        </button>
      )}
    </div>
  );
}

/* ── The warm up, framed ────────────────────────────────────────────────── */

/** Two lines, and they are the whole framing.

    "Guess." tells the student what to do with a question they have not studied
    for. "Not scored." is what makes that instruction safe to follow. There is
    nothing else to say, and the longer version that used to say it was on
    screen during the one stage where being told to stop thinking and answer is
    the entire instruction. */
export function WarmUpLines() {
  return (
    <p className="deal-in flex flex-col gap-0.5 font-sans text-[0.8125rem] font-semibold leading-tight text-ink-faint">
      <span>Guess.</span>
      <span>Not scored.</span>
    </p>
  );
}

/* ── Answer surfaces ────────────────────────────────────────────────────── */

const KEYS = ["1", "2", "3", "4"];

/** Two or four options, plainly. Number keys pick, which is what makes a fast
    run possible on a keyboard at all. */
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
      if (e.metaKey || e.ctrlKey || e.altKey) return;
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

/** Round 2, plainly. The sentence is on screen with a gap in it, and the gap
    is a real input sitting inline where the missing words go, so the student
    is filling a sentence rather than answering a question about one. */
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
      className="deal-in flex flex-wrap items-center gap-4"
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
          aria-invalid={revealed && !correct}
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
          aria-label="Submit your answer"
          className="btn grid h-11 w-11 place-items-center rounded-[3px] bg-accent font-sans text-[1.125rem] text-on-accent disabled:cursor-not-allowed disabled:bg-sunk disabled:text-ink-faint"
        >
          <span aria-hidden className="arrow">
            →
          </span>
        </button>
      )}
    </form>
  );
}

/** Round 3, plainly. The sentence in pieces, out of order, with distractors
    mixed in.

    The order they are laid out in comes from the server, on `question.tray`,
    for the same reason option order does: an order chosen in the browser is an
    order nobody can measure. The local shuffle that used to be here has gone
    with it, along with the risk of a tray that reshuffled on a re-render and
    moved a chip out from under a finger already on its way down. */
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
    () => question.tray ?? [...(question.chips ?? []), ...(question.distractors ?? [])],
    [question.tray, question.chips, question.distractors]
  );

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
              aria-label="Submit your sentence"
              className="btn grid h-11 w-11 place-items-center rounded-[3px] bg-accent font-sans text-[1.125rem] text-on-accent disabled:cursor-not-allowed disabled:bg-sunk disabled:text-ink-faint"
            >
              <span aria-hidden className="arrow">
                →
              </span>
            </button>
            {built.length > 0 && (
              <button
                onClick={() => onBuild([])}
                aria-label="Clear your sentence"
                className="grid h-11 w-11 place-items-center rounded-[3px] border border-line-strong font-sans text-[1.125rem] text-ink-faint hover:border-ink-faint hover:text-ink"
              >
                <span aria-hidden>×</span>
              </button>
            )}
          </div>
        </>
      )}

      {revealed && !correct && (
        <p className="font-read text-[1rem] leading-[1.5] text-ink">
          {(question.chips ?? []).join(" ")}
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

/* ── Audio ──────────────────────────────────────────────────────────────────
   These sit in the status strip and stay visible during a round, which is the
   one exception to the rule at the top of this file about what may be on
   screen. They earn it: audio nobody can stop is not a feature, it is a
   reason to close the tab, and a mute control that can only be reached
   between rounds is no use to somebody whose lecture just started. They pay
   for the exception by being glyphs, so there is no text to read.

   There are two rather than one because the two halves start differently.
   Music is off until asked for; the answer tones are on, because they are
   feedback rather than atmosphere. One control cannot express that.
------------------------------------------------------------------------- */

/** On is green, off is the same red the app marks a wrong answer in.

    The colours are doing real work here and are also not doing it alone. Red
    against green is the one pairing that collapses for the eight or so percent
    of men with deuteranopia, so each state carries a different glyph as well:
    a slashed note is off whether or not the colour arrives. That is the same
    discipline the marking screens use, and the palette is the same validated
    pair, --solid-mark against --broken-mark. */
function AudioToggle({
  on,
  onToggle,
  label,
  glyph,
}: {
  on: boolean;
  onToggle: () => void;
  label: string;
  /** [on, off]. The two must differ in shape, not only in colour. */
  glyph: [string, string];
}) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={on}
      aria-label={`${label}: ${on ? "on" : "off"}. Click to turn ${on ? "off" : "on"}.`}
      title={`${label} ${on ? "on" : "off"}`}
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-[3px] border-2 font-sans text-[0.9375rem] leading-none transition-colors ${
        on
          ? "border-solid-mark bg-solid-tint text-solid-ink hover:bg-solid-mark hover:text-page"
          : "border-broken-mark bg-broken-tint text-broken-ink hover:bg-broken-mark hover:text-page"
      }`}
    >
      <span aria-hidden>{on ? glyph[0] : glyph[1]}</span>
    </button>
  );
}

/** The background track. Off until a student asks for it. */
export function MusicToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return <AudioToggle on={on} onToggle={onToggle} label="Music" glyph={["♫", "♫̸"]} />;
}

/** The correct and incorrect tones. On by default. */
export function SoundToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return <AudioToggle on={on} onToggle={onToggle} label="Answer sounds" glyph={["♪", "♪̸"]} />;
}

/* ── The way out to the plain rendering ─────────────────────────────────── */

/** Not a preference. A skip link.

    Presentations are how rounds look, so there is no setting that turns them
    off and no entry in any menu that offers to. There is still a real problem
    underneath the one this replaced: a patch board, a pond and a dartboard are
    drawings, and a student reading the round through a screen reader is served
    by none of them. Every presentation is built to be operable that way, but
    operable is a lower bar than good.

    So the way out is exactly where a skip link goes. It is the first thing in
    the tab order of the question area, invisible until it has focus, and it
    can be reached in one keystroke from the top of the round by someone who
    needs it and effectively never by someone who does not. It lasts the
    session. */
export function PlainEscape({ onChoose }: { onChoose: () => void }) {
  return (
    <button
      onClick={onChoose}
      className="sr-only rounded-[3px] bg-accent px-4 py-2 font-sans text-[0.875rem] font-semibold text-on-accent focus:not-sr-only focus:absolute focus:left-0 focus:top-0 focus:z-40"
    >
      Switch to the plain view for the rest of this session
    </button>
  );
}
