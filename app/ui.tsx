"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

export function Win({
  title,
  icon,
  closeHref,
  children,
  className = "",
  bodyClassName = "",
}: {
  title: React.ReactNode;
  icon?: React.ReactNode;
  closeHref?: string;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`win flex min-h-0 flex-col ${className}`}>
      <header className="title-bar shrink-0">
        {icon}
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
      className="group flex shrink-0 items-baseline gap-2 whitespace-nowrap font-pixel"
    >
      <span className="text-[0.6875rem] text-ink group-hover:text-accent">
        LEARNOVA.EXE
      </span>
      <span className="hidden text-[0.5625rem] text-ink-faint sm:inline">
        / {mode.toUpperCase()}
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
      -&gt;
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
      className={`btn term-btn term-btn-go self-start ${className}`}
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
    <button {...props} className={`btn term-btn self-start ${className}`}>
      {children}
    </button>
  );
}

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
        className="leaf term-field prose-read w-full resize-none overflow-hidden bg-page text-ink caret-accent placeholder:text-ink-faint"
      />
    </div>
  );
}

export function AudioToggle({
  on,
  onToggle,
}: {
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={on}
      aria-label={`Audio: ${on ? "on" : "off"}. Click to turn ${on ? "off" : "on"}.`}
      title={`Audio ${on ? "on" : "off"}`}
      className="term-btn shrink-0 px-2.5 py-1.5 text-[0.6875rem]"
    >
      <span aria-hidden>[snd:{on ? "on" : "off"}]</span>
    </button>
  );
}

function Meter({ small = false }: { small?: boolean }) {
  const cells = small ? 5 : 8;
  const height = small ? "0.7rem" : "1.4rem";

  return (
    <span aria-hidden className="term-meter" style={{ height }}>
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
