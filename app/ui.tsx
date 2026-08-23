"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

/* Interface primitives shared across the app.

   The session index that used to live here went with the Teach-Back session
   screen it belonged to: a standing list of concepts with per-concept states
   made sense when a session was a queue of concepts to work through, and
   means nothing now that a session is a ladder of rounds. Round Mode's own
   progress furniture is in app/round/ui.tsx. */

/* Archivo carries a width axis; labels run slightly narrow so a long status
   word still fits a compact row without shrinking below a readable size. */
const NARROW: React.CSSProperties = { fontVariationSettings: '"wdth" 88' };

/** The app's name, and the mode you are in, and the way back to the door.

    A link because there are two modes now and the name in the corner is where
    everybody already reaches to leave one. It goes to the landing rather than
    to the other mode: choosing between them is that screen's whole job, and
    guessing which one somebody wanted next would be wrong half the time. */
export function Wordmark({ mode = "Round Mode" }: { mode?: string }) {
  return (
    <Link
      href="/"
      title="Both modes"
      className="shrink-0 whitespace-nowrap font-read text-[1.15rem] font-medium tracking-[-0.01em] text-ink transition-colors hover:text-accent sm:text-[1.3rem]"
    >
      Learnova
      {/* Teach-Back is a round now, not the product, so the wordmark names
          the mode the student is actually in. There are two of them now, and
          which one you are in is a thing you can leave and come back to, so
          the tag has stopped being decoration and started carrying an answer.

          Not on a phone. This tag and the ladder's rung label are the same
          kind of thing, a second line of small caps beside the name, and the
          two of them together are what pushed the header onto a third row on a
          narrow screen. The rung label wins that fight: it says which round
          you are in, which changes minute to minute, where this changes once
          per visit. */}
      <span className="ml-2 hidden align-[0.15em] font-sans text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-ink-faint sm:inline">
        {mode}
      </span>
    </Link>
  );
}

export function Label({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      style={NARROW}
      className={`font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.15em] text-ink-faint ${className}`}
    >
      {children}
    </p>
  );
}

/** Something went wrong, or something isn't ready.

    In the stationery pink the debate screen puts on "against it", not in the
    broken-mark register it used to borrow. That register belongs to marks on
    a student's own sentences, and an app telling you its own key expired has
    no business wearing the colour that means "this part of what you wrote is
    wrong". Same reason the sound toggle moved. */
export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="settle max-w-[44rem] rounded-[3px] border-l-[3px] border-supply-pink bg-supply-pink/12 px-4 py-3 font-sans text-[0.875rem] leading-[1.6] text-ink"
    >
      {children}
    </p>
  );
}

/** Something the student should know about, that is nobody's fault and stops
    nothing.

    Deliberately not a Notice. The broken-mark register means "look here,
    something is wrong", and a shared key being busy is neither wrong nor the
    student's problem to solve. Dressing a queue up as a failure teaches them
    to distrust a screen that was working fine. This says its piece in the
    quiet register and gets out of the way. */
export function Aside({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="status"
      className="settle max-w-[44rem] rounded-[3px] border border-line bg-sunk/60 px-4 py-3 font-sans text-[0.875rem] leading-[1.6] text-ink-soft"
    >
      {children}
    </p>
  );
}

/** The concept being asked, set in the reading face, the one voice on the
    page that speaks for the material rather than the interface. */
export function Ask({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="max-w-[30ch] text-balance font-read text-[clamp(1.625rem,1.15rem+1.9vw,2.25rem)] font-normal leading-[1.15] tracking-[-0.015em] text-ink">
      {children}
    </h2>
  );
}

/** The arrow on a forward action. Leans in its own direction on hover. The
    `.btn` rule drives it, so it only ever moves with its button. */
export function Arrow() {
  return (
    <span aria-hidden className="arrow">
      →
    </span>
  );
}

export function PrimaryButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`btn inline-flex items-center gap-2 self-start rounded-[3px] bg-accent px-5 py-2.5 font-sans text-[0.875rem] font-semibold text-on-accent shadow-[0_1px_2px_rgb(20_26_38/0.12)] hover:bg-accent-hover hover:shadow-[0_8px_20px_-10px_var(--accent)] disabled:cursor-not-allowed disabled:bg-sunk disabled:text-ink-faint disabled:shadow-none ${className}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`btn inline-flex items-center gap-2 self-start rounded-[3px] border border-line-strong px-5 py-2.5 font-sans text-[0.875rem] font-medium text-ink-soft hover:border-ink-faint hover:text-ink disabled:cursor-not-allowed disabled:border-line disabled:text-ink-faint ${className}`}
    >
      {children}
    </button>
  );
}

/** Where the pasted source stands against what actually gates submission.

    Both size floors are shown because both are real, and the bar tracks
    whichever is further from being met. Nothing here holds a threshold of its
    own: the status comes from the same function the button and the route
    consult, so this cannot advertise a target that is not the target. */

/** The leaf you write on: ruled paper set in the reading face, so what a
    student types already looks like text worth examining. It grows with the
    writing instead of scrolling, which also keeps the ruling under the
    baselines where it belongs. */
/** Grow a textarea with its writing instead of scrolling, which also keeps the
    ruling under the baselines where it belongs. Shared with the looseleaf on
    the source screen, so both surfaces resize identically. */
export function useAutoGrow(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  value: string,
  minRows: number
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [ref, value, minRows]);
}

export function Leaf({
  value,
  onChange,
  placeholder,
  minRows = 8,
  autoFocus,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  minRows?: number;
  autoFocus?: boolean;
  /** Given, Enter commits and Shift+Enter starts a new line.

      Opt-in rather than automatic, because Enter meaning "send" is only right
      where the writing is one or two sentences answering a prompt. On a leaf
      being used for pasted notes it would be a trap. */
  onSubmit?: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useAutoGrow(ref, value, minRows);

  /* No padding utility here on purpose: the leaf's padding-top is what lands
     the writing on the ruling, so `.leaf` owns all four sides of it. */
  return (
    <div className="relative flex flex-col">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (!onSubmit) return;
          if (e.key !== "Enter" || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
          e.preventDefault();
          onSubmit();
        }}
        placeholder={placeholder}
        rows={minRows}
        autoFocus={autoFocus}
        className="leaf prose-read w-full resize-none overflow-hidden rounded-[3px] border border-line bg-page text-ink caret-accent placeholder:text-ink-faint"
      />
      <span
        aria-hidden
        className="sweep pointer-events-none absolute inset-x-0 bottom-0 h-[2px] rounded-b-[3px] bg-accent"
      />
    </div>
  );
}

/* ── Audio ──────────────────────────────────────────────────────────────────
   These sit in the status strip and stay visible during a round and during a
   debate speech, which is the one exception to Round Mode's rule about what
   may be on screen mid-question. They earn it: audio nobody can stop is not a
   feature, it is a reason to close the tab, and a mute control that can only
   be reached between rounds is no use to somebody whose lecture just started.
   They pay for the exception by being glyphs, so there is no text to read.

   There are two rather than one because the two halves start differently.
   Music is off until asked for; the event tones are on, because they are
   feedback rather than atmosphere. One control cannot express that.

   Shared by both modes, which is why they are here rather than in
   app/round/ui.tsx where they began.
------------------------------------------------------------------------- */

/** On is mint, off is pink: the stationery pair, drawn as the same sticker
    the debate screen offers "for it" and "against it" on.

    It used to be --solid-mark against --broken-mark, which are marking
    colours, and marking colours are supposed to mean something about a
    student's work rather than about whether the music is playing. The
    stationery pair says the same on/off without borrowing that meaning.

    The colours are still not doing it alone. Each state carries a different
    glyph, a slashed note against a plain one, so the state survives any
    colour vision at all. */
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
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-[3px] border-2 font-sans text-[1.125rem] leading-none transition-colors sm:h-10 sm:w-10 ${
        on
          ? "border-sheet-ink bg-supply-mint text-[#262626]"
          : "border-sheet-ink bg-supply-pink text-[#262626]"
      }`}
    >
      <span aria-hidden>{on ? glyph[0] : glyph[1]}</span>
    </button>
  );
}

/** The background track. */
export function MusicToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return <AudioToggle on={on} onToggle={onToggle} label="Music" glyph={["♫", "♫̸"]} />;
}

/** The event tones: right and wrong in Round Mode, the gavel in a debate. */
export function SoundToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return <AudioToggle on={on} onToggle={onToggle} label="Sound" glyph={["♪", "♪̸"]} />;
}

/* ── Credit where it is required ──────────────────────────────────────────
   The background track is used under Creative Commons BY 4.0, and attribution
   is a condition of that licence rather than a courtesy. It is also in
   CREDITS.md and in README.md, but neither of those is reachable by a student
   who is only ever going to see the app.

   On the front door of both modes, because both play the track. Closed by
   default and one click from open, at the foot of the screen a session begins
   on. That is as far from buried as a credit can be without taking space from
   the thing the screen exists for. The text is reproduced exactly as the
   licence requires: it is not reworded, wrapped in friendlier language, or
   abbreviated. */
export function Credits({ className = "" }: { className?: string }) {
  return (
    <details className={`group self-start ${className}`}>
      <summary
        style={NARROW}
        className="inline-flex cursor-pointer list-none items-center gap-1.5 font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-ink-faint transition-colors hover:text-ink-soft"
      >
        <span aria-hidden className="inline-block transition-transform group-open:rotate-90">
          ›
        </span>
        Credits
      </summary>

      <div className="mt-3 border-l-2 border-line-strong pl-3.5">
        <p className="font-sans text-[0.8125rem] leading-[1.7] text-ink-soft">
          &ldquo;8bit Dungeon Level&rdquo; Kevin MacLeod (incompetech.com)
          <br />
          Licensed under Creative Commons: By Attribution 4.0
          <br />
          <a
            href="http://creativecommons.org/licenses/by/4.0/"
            target="_blank"
            rel="noreferrer"
            className="text-accent underline decoration-accent/30 underline-offset-4 hover:decoration-accent"
          >
            http://creativecommons.org/licenses/by/4.0/
          </a>
        </p>
      </div>
    </details>
  );
}

/* ── Waiting on the model ─────────────────────────────────────────────────
   One mark, everywhere, and that is the whole of the design.

   There used to be three. Round Mode drew a bar meter while it built a round,
   debate parked a pulsing dot after a half-written speech, and judging drew a
   ruled page with a rule travelling down it, on the reasoning that a judge is
   reading rather than generating. Each was defensible on its own screen and
   the set was indefensible. An indicator earns its keep by being recognised,
   and a mark that appears on one screen is a mark nobody has time to learn:
   somebody who knows the bars mean "wait" learns nothing from the dot. The
   ruled page was worse than unfamiliar. With no writing on it, it read as an
   empty form that had failed to load rather than as anything happening.

   So there is one mark: bars rising and falling, in the accent, at two sizes.
   The same object whether it sits in a row of buttons, after a sentence still
   arriving, or in the middle of an empty screen. Only the size changes, and
   the words beside it.

   The travelling rule is gone rather than kept for a rainy day, and its
   keyframes went with it. */

/** The bars. Not exported: the two sizes below are the sizes this app has,
    and a third defined at a call site is how the drift starts again. */
function Meter({ small = false }: { small?: boolean }) {
  const height = small ? "0.85rem" : "2rem";

  return (
    <span
      aria-hidden
      className={`inline-flex items-end ${small ? "gap-[3px]" : "gap-1.5"}`}
      style={{ height }}
    >
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={`working-bar block rounded-[1px] bg-accent ${small ? "w-[3px]" : "w-2"}`}
          /* A fifth of the cycle apart, so the four bars are never level. */
          style={{ height, animationDelay: `${i * 125}ms` }}
        />
      ))}
    </span>
  );
}

/** Waiting, with the page still under it.

    For a wait that happens underneath something the student is still looking
    at: their own explanation while it is being marked, the speech box while
    the opponent writes. Small enough to sit in a row of controls, and it says
    what is being waited on rather than that something is.

    `label` may be left off where what is happening is already obvious from
    what it is attached to, which is the case at the end of a speech that is
    visibly still arriving. */
export function Working({ label }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2.5 align-baseline">
      <Meter small />
      {label && <span className="font-sans text-[0.8125rem] text-ink-soft">{label}</span>}
    </span>
  );
}

/** Waiting, with nothing under it.

    For the waits where the screen has nothing else on it and nothing for the
    student to do: the first questions of a run, a round being written, a
    round being judged. Same mark, larger and centred, with a line saying what
    is happening and a line saying what to expect. */
export function Waiting({ title, sub }: { title: string; sub: string }) {
  return (
    <div role="status" className="settle flex flex-col items-center gap-6 py-16">
      <Meter />
      <div className="text-center">
        <p className="font-sans text-[1rem] font-semibold text-ink">{title}</p>
        <p className="mt-1 font-sans text-[0.875rem] text-ink-soft">{sub}</p>
      </div>
    </div>
  );
}
