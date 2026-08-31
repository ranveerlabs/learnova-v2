"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

// drag by the title bar. transform only, so the window never reflows its own
// contents while it moves
function useDragBar() {
  const [at, setAt] = useState({ x: 0, y: 0 });
  const from = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // the close button is in the bar and is not a handle
      if ((e.target as HTMLElement).closest("a,button")) return;
      if (e.button !== 0) return;
      from.current = { x: e.clientX - at.x, y: e.clientY - at.y };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [at],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const start = from.current;
    if (!start) return;
    // keep a grabbable strip of bar on screen whatever they do with it
    const room = 48;
    setAt({
      x: clamp(e.clientX - start.x, -innerWidth + room, innerWidth - room),
      y: clamp(e.clientY - start.y, 0, innerHeight - room),
    });
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    from.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  // double click the bar to put it back
  const onDoubleClick = useCallback(() => setAt({ x: 0, y: 0 }), []);

  const moved = at.x !== 0 || at.y !== 0;
  return {
    moved,
    style: moved ? { transform: `translate(${at.x}px, ${at.y}px)` } : undefined,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onDoubleClick },
  };
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(Math.max(n, lo), hi);
}

// the window. a title bar and a body, and every screen sits in one. the dark
// ground behind it is desktop and never carries text
export function Win({
  title,
  closeHref,
  children,
  className = "",
  bodyClassName = "",
}: {
  title: React.ReactNode;
  closeHref?: string;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const drag = useDragBar();

  return (
    <section
      className={`win flex min-h-0 flex-col ${className}`}
      style={drag.style}
    >
      <header
        {...drag.handlers}
        title={drag.moved ? "Double click to put it back" : undefined}
        className="title-bar shrink-0 cursor-grab active:cursor-grabbing"
      >
        <span className="grip">{title}</span>
        {closeHref && (
          <Link href={closeHref} className="title-btn" aria-label="Close">
            <span aria-hidden>X</span>
          </Link>
        )}
      </header>
      <div className={`min-h-0 flex-1 overflow-auto ${bodyClassName}`}>
        {children}
      </div>
    </section>
  );
}

export function Wordmark({ mode = "Round Mode" }: { mode?: string }) {
  return (
    <Link
      href="/"
      title="Both modes"
      className="shrink-0 whitespace-nowrap font-pixel text-[1rem] text-ink hover:text-accent sm:text-[1.15rem]"
    >
      Learnova
      <span className="ml-2 hidden align-[0.1em] font-pixel text-[0.6rem] text-ink-faint sm:inline">
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
      className={`font-pixel text-[0.6875rem] uppercase text-ink-faint ${className}`}
    >
      {children}
    </p>
  );
}

export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="settle max-w-[44rem] border-2 border-line bg-supply-pink/25 px-4 py-3 font-sans text-[0.875rem] leading-[1.6] text-ink"
    >
      {children}
    </p>
  );
}

export function Aside({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="status"
      className="settle max-w-[44rem] border-2 border-line bg-sunk px-4 py-3 font-sans text-[0.875rem] leading-[1.6] text-ink-soft"
    >
      {children}
    </p>
  );
}

export function Ask({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="max-w-[30ch] text-balance font-read text-[clamp(1.625rem,1.15rem+1.9vw,2.25rem)] font-normal leading-[1.15] tracking-[-0.015em] text-ink">
      {children}
    </h2>
  );
}

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
      className={`btn xp-btn xp-btn-go self-start ${className}`}
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
    <button {...props} className={`btn xp-btn self-start ${className}`}>
      {children}
    </button>
  );
}

// auto -> scrollHeight, in that order. skipping the auto step means it only ever grows
export function useAutoGrow(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  value: string,
  minRows: number,
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
  onSubmit?: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useAutoGrow(ref, value, minRows);

  return (
    <div className="relative flex flex-col">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // enter sends, shift+enter newlines
          if (!onSubmit) return;
          if (
            e.key !== "Enter" ||
            e.shiftKey ||
            e.metaKey ||
            e.ctrlKey ||
            e.altKey
          )
            return;
          e.preventDefault();
          onSubmit();
        }}
        placeholder={placeholder}
        rows={minRows}
        autoFocus={autoFocus}
        className="leaf xp-field prose-read w-full resize-none overflow-hidden bg-page text-ink caret-accent placeholder:text-ink-faint"
      />
    </div>
  );
}

// mint on, pink off. the glyph carries it too, colour is never doing this alone
function AudioToggle({
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
      aria-label={`${label}: ${on ? "on" : "off"}. Click to turn ${on ? "off" : "on"}.`}
      title={`${label} ${on ? "on" : "off"}`}
      className={`xp-btn h-9 w-9 shrink-0 !px-0 text-[1.125rem] sm:h-10 sm:w-10 ${
        on ? "bg-supply-mint text-[#101010]" : "bg-supply-pink text-[#101010]"
      }`}
    >
      <span aria-hidden>{on ? glyph[0] : glyph[1]}</span>
    </button>
  );
}

export function MusicToggle({
  on,
  onToggle,
}: {
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <AudioToggle on={on} onToggle={onToggle} label="Music" glyph={["♫", "♫̸"]} />
  );
}

export function SoundToggle({
  on,
  onToggle,
}: {
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <AudioToggle on={on} onToggle={onToggle} label="Sound" glyph={["♪", "♪̸"]} />
  );
}

export function Credits({ className = "" }: { className?: string }) {
  return (
    <details className={`group self-start ${className}`}>
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 font-pixel text-[0.6875rem] uppercase text-ink-faint hover:text-ink-soft">
        <span
          aria-hidden
          className="inline-block transition-transform group-open:rotate-90"
        >
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

// only looping animation in the app. eight cells, stepped, no easing
function Meter({ small = false }: { small?: boolean }) {
  const cells = small ? 5 : 8;
  const height = small ? "0.7rem" : "1.4rem";

  return (
    <span aria-hidden className="xp-meter" style={{ height }}>
      {Array.from({ length: cells }, (_, i) => (
        <span key={i} style={{ animationDelay: `${i * 110}ms` }} />
      ))}
    </span>
  );
}

export function Working({ label }: { label?: string }) {
  return (
    <span
      role="status"
      className="inline-flex items-center gap-2.5 align-baseline"
    >
      <Meter small />
      {label && (
        <span className="font-sans text-[0.8125rem] text-ink-soft">
          {label}
        </span>
      )}
    </span>
  );
}

export function Waiting({ title, sub }: { title: string; sub: string }) {
  return (
    <div
      role="status"
      className="settle flex flex-col items-center gap-6 py-16"
    >
      <Meter />
      <div className="text-center">
        <p className="font-pixel text-[0.9rem] text-ink">{title}</p>
        <p className="mt-1 font-sans text-[0.875rem] text-ink-soft">{sub}</p>
      </div>
    </div>
  );
}
