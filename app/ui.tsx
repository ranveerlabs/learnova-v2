"use client";

import { useEffect, useRef } from "react";

/* Interface primitives shared across the app.

   The session index that used to live here went with the Teach-Back session
   screen it belonged to: a standing list of concepts with per-concept states
   made sense when a session was a queue of concepts to work through, and
   means nothing now that a session is a ladder of rounds. Round Mode's own
   progress furniture is in app/round/ui.tsx. */

/* Archivo carries a width axis; labels run slightly narrow so a long status
   word still fits a compact row without shrinking below a readable size. */
const NARROW: React.CSSProperties = { fontVariationSettings: '"wdth" 88' };

export function Wordmark() {
  return (
    <span className="font-read text-[1.3rem] font-medium tracking-[-0.01em] text-ink">
      Learnova
      {/* Teach-Back is a round now, not the product, so the wordmark names
          the mode the student is actually in. */}
      <span className="ml-2 align-[0.15em] font-sans text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-ink-faint">
        Round Mode
      </span>
    </span>
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

/** Something went wrong, or something isn't ready. Said in the broken-mark
    register, which is the one the student already reads as "look here". */
export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="settle max-w-[44rem] rounded-[3px] border-l-[3px] border-broken-mark bg-broken-tint px-4 py-3 font-sans text-[0.875rem] leading-[1.6] text-broken-ink"
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
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  minRows?: number;
  autoFocus?: boolean;
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

/** Reading in progress: a rule travelling down the ruling, the way a finger
    moves down a page. Deliberately not a spinner: the app is reading. */
export function Reading({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="settle flex flex-col gap-6" role="status">
      <div
        className="leaf relative h-32 max-w-[30rem] overflow-hidden rounded-[3px] border border-line bg-page"
        /* No writing in this one, so it wants ruling edge to edge rather than
           the leaf's usual margin. */
        style={{ padding: 0 }}
        aria-hidden
      >
        <div className="reading-rule absolute inset-x-0 top-0 h-8">
          <div className="h-full w-full bg-gradient-to-b from-transparent to-accent-wash" />
          <div className="h-px w-full bg-accent/40" />
        </div>
      </div>
      <div>
        <p className="font-sans text-[0.9375rem] font-semibold text-ink">{title}</p>
        <p className="mt-1 font-sans text-[0.875rem] text-ink-soft">{sub}</p>
      </div>
    </div>
  );
}
