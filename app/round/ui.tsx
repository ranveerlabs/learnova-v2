"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { type Provenance, type Question, type Round } from "./types";
import { formatClock } from "./engine";

/* Round Mode's own primitives.

   ── What is on screen during a round ─────────────────────────────────────
   The header, which is the same on every screen: the wordmark, the rung, where
   the questions came from, the run clock, the audio controls and the question
   timer. Then the question and the answers, and nothing else.

   Two things that used to be here are gone entirely rather than moved, and
   they are worth naming so nobody adds them back:

   points, the running total and the  → deleted. Both were numbers computed
   combo multiplier                      from how fast and how often you were
                                         right, shown next to how fast and how
                                         often you were right. The clock and
                                         the marks say it already.
   "Guess. Not scored."               → deleted with the scoring it referred
                                         to. There is no score to be outside
                                         of any more.

   What is left is a clock and whether you got it right. */

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

    On the results screen every mark is filled and the word is "Finished".
    Leaving the last rung drawn as the current one told a student who had just
    completed the whole session that they were still standing on it, with one
    square unfilled, which is the one moment the rail should be saying the
    opposite. A cleared ladder is the reward for clearing it. */
export function LadderRail({ stage, finished = false }: { stage: 0 | Round; finished?: boolean }) {
  const here = RUNGS.find((r) => r.key === stage);

  return (
    <nav aria-label="Session stages" className="flex items-center gap-2.5">
      <span className="flex items-center gap-1.5">
        {RUNGS.map((rung) => {
          const done = finished || rung.key < stage;
          const current = !finished && rung.key === stage;
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
      {(finished || here) && (
        <span
          style={NARROW}
          className={`font-sans text-[0.625rem] font-semibold uppercase tracking-[0.12em] ${
            finished ? "text-solid-ink" : "text-ink-soft"
          }`}
        >
          {finished ? "Finished" : here?.label}
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
    /* Not live: sample once and hold. Returning early instead would leave
       whatever frame the animation happened to stop on, and on a clock that
       mounts already frozen it would leave 0:00.0 next to a run in progress. */
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
export function TimerRing({
  remaining,
  total,
  cheering = false,
}: {
  remaining: number;
  total: number;
  /** Set briefly when an answer lands correctly, so the reward reaches the one
      piece of chrome the whole room is already watching. */
  cheering?: boolean;
}) {
  const t = Math.max(0, Math.min(1, remaining / total));
  const seconds = Math.ceil(remaining / 1000);
  const urgent = remaining <= 5000;

  /* Sized to be watched by a room rather than glanced at by one person. The
     count is the thing everybody shouts along with in the last five seconds,
     so it is set large, in the ink the interface reserves for text people are
     meant to read, and it goes amber and bold when the ring does. */
  return (
    <div
      role="timer"
      aria-label={`${seconds} seconds left`}
      className={`ring grid h-16 w-16 place-items-center ${urgent ? "urgent" : ""} ${
        cheering ? "clock-cheer" : ""
      }`}
      style={{
        ["--t" as string]: t,
        ...(cheering ? { ["--ring-ink" as string]: "var(--solid-mark)" } : {}),
      }}
    >
      <span className="grid h-[3.4rem] w-[3.4rem] place-items-center rounded-full bg-ground">
        <span
          className={`font-mono text-[1.375rem] font-semibold tabular-nums ${
            cheering ? "text-solid-ink" : urgent ? "text-shaky-ink" : "text-ink-soft"
          }`}
        >
          {seconds}
        </span>
      </span>
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
    <svg width="26" height="26" viewBox="0 0 15 15" aria-hidden className="shrink-0">
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
    <svg width="26" height="26" viewBox="0 0 15 15" aria-hidden className="shrink-0">
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
      className={`deal-in flex w-full shrink-0 flex-wrap items-center gap-x-4 gap-y-1 rounded-[6px] border-l-[6px] py-3 pl-5 pr-5 ${
        correct ? "border-solid-mark bg-solid-tint" : "border-broken-mark bg-broken-tint"
      }`}
    >
      {correct ? <Tick /> : <Cross />}
      {/* The one word the room reads at a glance, so it is set like a
          scoreboard rather than like a caption, and it arrives with a bounce
          rather than simply being there. */}
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

      {/* Always here, right and wrong alike, and it names the key.

          A shortcut nobody is told about is a shortcut nobody has: this
          control used to appear only on a miss, and only as a bare arrow with
          nothing to suggest it had a keyboard equivalent at all. */}
      <button
        onClick={onNext}
        aria-label="Next question"
        className="btn ml-auto flex shrink-0 items-center gap-2 rounded-[4px] border-2 border-line-strong px-3 py-1.5 font-sans text-[0.875rem] font-semibold text-ink-soft hover:border-accent hover:text-ink"
      >
        <kbd className="rounded-[3px] bg-sunk px-2 py-0.5 font-mono text-[0.75rem]">Enter</kbd>
        <span aria-hidden className="arrow">
          →
        </span>
      </button>
    </div>
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

  /* Fills the height it is given and stops growing before an option becomes an
     empty panel, the same bargain the wire board strikes. Two options get one
     column and go tall; four get two columns. Either way the words are set big
     enough to be read by somebody who is not the person holding the device. */
  return (
    <div
      className={`grid min-h-0 content-center gap-3 ${options.length > 2 ? "sm:grid-cols-2" : ""}`}
    >
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
            className={`deal-in-stagger group relative flex min-h-[clamp(3.25rem,11vh,7rem)] items-center gap-4 overflow-hidden rounded-[6px] border-[3px] px-5 py-4 text-left transition-colors ${
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
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-[4px] border-2 font-mono text-[0.9375rem] font-semibold ${
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
              className={`font-read text-[clamp(1.25rem,0.9rem+1.3vw,2.125rem)] leading-[1.2] ${
                showRight ? "font-medium text-solid-ink" : showWrong ? "text-broken-ink" : "text-ink"
              }`}
            >
              {option}
            </span>
            {showRight && (
              <span
                aria-hidden
                className="right-ring pointer-events-none absolute inset-0 rounded-[6px] border-[3px] border-solid-mark"
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
      className="deal-in flex min-h-0 flex-wrap content-center items-center gap-5"
    >
      <p className="font-read text-[clamp(1.375rem,1rem+1.4vw,2.25rem)] leading-[1.7] text-ink">
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
          className={`mx-1 inline-block min-w-[9rem] border-b-[3px] bg-transparent px-2 pb-1 text-center font-read text-[clamp(1.375rem,1rem+1.4vw,2.25rem)] font-medium text-ink caret-accent outline-none placeholder:text-ink-faint ${
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

/** Round 3, plainly. The sentence in pieces, out of order.

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
    () => question.tray ?? question.chips ?? [],
    [question.tray, question.chips]
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

  /* Enter commits the sentence. Round 3 used to be the one place with no
     keyboard path at all: the only way to submit was to find and click a small
     arrow, which broke a run that was otherwise entirely keyboard-driven.

     The same key advances past the verdict, and the two cannot collide: this
     listener bails while `revealed`, and the advance listener is only mounted
     once there is a result. Space is deliberately not bound here — a chip that
     has keyboard focus is a button, and the browser fires it on Space, so the
     student would place a chip and submit in one press. */
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
    <div className="deal-in flex min-h-0 flex-col justify-center gap-5">
      {/* The sentence being built. Holds its height whether or not anything is
          in it, so the tray below never jumps as chips are placed. */}
      <div
        aria-label="Your sentence"
        className={`flex min-h-[6rem] flex-wrap items-center gap-2.5 rounded-[6px] border-[3px] border-dashed p-4 transition-colors ${
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
            className="chip chip-snap rounded-[4px] border-2 border-accent bg-page px-4 py-2 font-read text-[clamp(1.0625rem,0.9rem+0.6vw,1.4375rem)] text-ink disabled:cursor-default"
          >
            {chip}
          </button>
        ))}
      </div>

      {!revealed && (
        <>
          <div className="flex flex-wrap gap-2.5">
            {tray.map((chip, i) => (
              <button
                key={`${chip}-${i}`}
                disabled={spent[i]}
                onClick={() => onBuild([...built, chip])}
                style={{ ["--i" as string]: i }}
                className={`chip deal-in-stagger rounded-[4px] border-2 border-line-strong bg-page px-4 py-2 font-read text-[clamp(1.0625rem,0.9rem+0.6vw,1.4375rem)] text-ink hover:border-accent hover:bg-accent-wash/40 ${
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
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-[3px] border-2 font-sans text-[1.125rem] leading-none transition-colors ${
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
