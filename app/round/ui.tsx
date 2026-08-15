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
    <nav aria-label="Session stages" className="flex min-w-0 items-center gap-1.5 sm:gap-2.5">
      <span className="flex shrink-0 items-center gap-1 sm:gap-1.5">
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
        /* One line, always. Left to wrap, "Say it yourself" and "Fill the gap"
           broke in half on a narrow screen and made the whole strip taller for
           two rounds out of five. */
        <span
          style={NARROW}
          className={`truncate font-sans text-[0.625rem] font-semibold uppercase tracking-[0.12em] ${
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
    <span className="run-clock shrink-0 font-mono text-[0.8125rem] font-medium text-ink-soft sm:text-[0.9375rem]">
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
     meant to read, and it goes amber and bold when the ring does.

     Its size is read off the height of the frame, and `shrink-0` makes it the
     last thing in the strip to give way rather than the first. It used to be a
     fixed four rem at the end of a row that could not fit four rem, and what a
     browser does with that is push it past the right edge and clip it: on a
     360pt screen the countdown everybody is meant to be shouting along with
     was a crescent of ring with no number in it.

     Height rather than width, because this is the single tallest thing in the
     header and the header is charged against the same budget as the answers. A
     phone held sideways has 390pt of height to spend on a header, a question,
     four answers and a verdict, and four rem of ring is a fourteenth of it. */
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
      {/* The face, as a share of the ring rather than a second measurement, so
          the band of colour stays the same weight at every size. */}
      <span className="grid h-[86%] w-[86%] place-items-center rounded-full bg-ground">
        <span
          className={`font-mono text-[clamp(1rem,3.1vh,1.375rem)] font-semibold tabular-nums ${
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

/** Whether anything on screen was checked against a source.

    Shown on every screen of a run, the live questions included, so the answer
    is never more than a glance away from the claim it qualifies.

    The ungrounded side used to read "AI-generated", and that was the wrong
    fact to put in the one slot there is. A student who typed a topic into a
    box already knows a model wrote the questions; they asked it to. What they
    have no way to know is that nothing checked whether the answers are TRUE,
    and that is the failure that actually costs them: a topic-only session on a
    spray-applied roofing compound insisted for a whole run that it was
    torch-applied, and the only reason it was caught is that the person already
    knew. Naming the authorship and not the risk is how a badge becomes
    furniture. This one names the risk. */
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
      /* One line. Two words of small caps wrapping inside a bordered chip is
         how "AI-generated" became a two storey badge on a phone, taking the
         height of the whole strip with it. */
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-[3px] border px-1.5 py-1 font-sans text-[0.5625rem] font-semibold uppercase tracking-[0.08em] sm:gap-1.5 sm:px-2 sm:tracking-[0.12em] ${
        grounded
          ? "border-solid-mark/40 bg-solid-tint text-solid-ink"
          : "border-line-strong bg-sunk text-ink-soft"
      }`}
    >
      <span aria-hidden>{grounded ? "❝" : "◇"}</span>
      {grounded ? "From your notes" : "Unchecked"}
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
      className={`deal-in flex w-full shrink-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-[6px] border-l-[5px] py-2 pl-3 pr-3 sm:gap-x-4 sm:border-l-[6px] sm:py-3 sm:pl-5 sm:pr-5 ${
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
          nothing to suggest it had a keyboard equivalent at all.

          It names the gesture, and which gesture that is depends on what the
          student is holding. On a phone this said "Enter" to somebody with no
          Enter to press, which is not a shortcut being advertised, it is a
          label being wrong. So a touch screen is told to tap and a keyboard is
          told to press Enter, and both are true where they appear.

          The switch is `pointer`, not a width. A narrow window on a laptop is
          still a laptop and its owner still has the key; a phone is a phone at
          any width it is held. Width would have got both of those wrong, and
          this is the one line on the screen whose whole job is to be right
          about what the person in front of it can actually do.

          "Enter" is the side that shows when neither query matches, so a
          browser that cannot answer the question falls back to what this said
          before rather than to a bare arrow. */}
      <button
        onClick={onNext}
        aria-label="Next question"
        className="btn ml-auto flex min-h-[2.5rem] min-w-[3rem] shrink-0 items-center justify-center gap-2 rounded-[4px] border-2 border-line-strong px-3 py-1.5 font-sans text-[0.875rem] font-semibold text-ink-soft hover:border-accent hover:text-ink"
      >
        <kbd className="rounded-[3px] bg-sunk px-2 py-0.5 font-mono text-[0.75rem] pointer-coarse:hidden">
          Enter
        </kbd>
        {/* Not a `kbd`. Tapping is a gesture rather than a key, so it is set as
            a word on the button instead of as a keycap on it. */}
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
     enough to be read by somebody who is not the person holding the device.

     ── Why the rows are shares rather than sizes ────────────────────────────
     Each option used to carry `min-h-[clamp(...)]`, and a minimum is a floor a
     flex or grid track cannot be squeezed below. On a laptop there was always
     enough height for four of them and it never came up. On a phone held
     sideways there is not: the four floors added up to more than the frame had
     left, the grid was told to centre what it could not fit, and content that
     overflows a centred track overflows it at BOTH ends. The answers came out
     over the top of the question, which was still there underneath them, and
     under the verdict at the bottom.

     So the rows are `1fr` now: a share of whatever is actually there. They
     grow into a tall frame up to the cap below, and on a short one they give
     way in step until they are as small as they need to be, which is a board
     that gets tight rather than a board that comes apart. The cap is what
     keeps four answers on a monitor from becoming four empty panels. */
  const many = options.length > 2;

  return (
    <div
      className={`grid min-h-0 flex-1 content-center gap-2.5 sm:gap-3 [grid-auto-rows:minmax(0,1fr)] ${
        many ? "max-h-[30rem] sm:max-h-[15.5rem] sm:grid-cols-2" : "max-h-[16rem]"
      }`}
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
            className={`deal-in-stagger group relative flex min-h-0 items-center gap-3 overflow-hidden rounded-[6px] border-[3px] px-3.5 py-2 text-left transition-colors sm:gap-4 sm:px-5 sm:py-4 ${
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
              className={`grid h-[clamp(1.75rem,4.2vh,2.25rem)] w-[clamp(1.75rem,4.2vh,2.25rem)] shrink-0 place-items-center rounded-[4px] border-2 font-mono text-[0.8125rem] font-semibold sm:text-[0.9375rem] ${
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
          /* The gap is set in the sentence's own type and grows with what is
             typed into it, so its floor has to be a width the sentence can
             still wrap around. Nine rem is a third of a phone's line. */
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
    /* Content sized, and free to be squeezed. Told to fill the frame instead,
       it took every pixel the question above it was not using and centred the
       tray in the middle of them, which put the sentence being built a long
       way from the instruction to build it. The two belong together, and the
       column above centres them as one thing. */
    <div className="deal-in flex min-h-0 flex-col justify-center gap-3 sm:gap-5">
      {/* The sentence being built. Holds its height whether or not anything is
          in it, so the tray below never jumps as chips are placed. The height
          it holds is a share of the frame: six rem of reserved empty space is
          a fair trade on a laptop and a sixth of a phone held sideways. */}
      <div
        aria-label="Your sentence"
        className={`flex min-h-[clamp(3.25rem,12vh,6rem)] shrink-0 flex-wrap items-center gap-2 rounded-[6px] border-[3px] border-dashed p-2.5 transition-colors sm:gap-2.5 sm:p-4 ${
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
            className="chip chip-snap rounded-[4px] border-2 border-accent bg-page px-3 py-1.5 font-read sm:px-4 sm:py-2 text-[clamp(0.9375rem,0.75rem+0.5vw+0.4vh,1.4375rem)] text-ink disabled:cursor-default"
          >
            {chip}
          </button>
        ))}
      </div>

      {!revealed && (
        <>
          {/* The tray. It is the one thing on this board whose height is not
              ours to decide: a nine chip sentence on a narrow screen is four
              rows of chips whatever anybody intended. So it is the piece that
              gives, and if it genuinely cannot fit it scrolls inside its own
              bounds rather than pushing the button that submits the sentence
              off the bottom of a screen that does not scroll. */}
          <div className="flex min-h-0 shrink flex-wrap gap-2 overflow-y-auto sm:gap-2.5">
            {tray.map((chip, i) => (
              <button
                key={`${chip}-${i}`}
                disabled={spent[i]}
                onClick={() => onBuild([...built, chip])}
                style={{ ["--i" as string]: i }}
                className={`chip deal-in-stagger rounded-[4px] border-2 border-line-strong bg-page px-3 py-1.5 font-read text-[clamp(0.9375rem,0.75rem+0.5vw+0.4vh,1.4375rem)] text-ink hover:border-accent hover:bg-accent-wash/40 sm:px-4 sm:py-2 ${
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

/* The waiting screen used to live here, as `Generating`: five accent bars on
   a scaling pulse, defined in this file and used only by the round shell.
   Debate mode then grew indicators of its own and the app had three different
   marks for one idea, so the mark moved to app/ui.tsx as `Waiting` and both
   modes draw it. This file kept an `export { Waiting as Generating }` line
   through that move, which was one alias standing between a reader and the
   thing itself; the two call sites import `Waiting` directly now.

   The audio toggles used to live here too. They are in app/ui.tsx now, because
   debate mode plays the same track and needs the same controls, and a mute
   button that only exists inside Round Mode is a mute button that does not
   work on half the app. */

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
