/* Shared interface primitives for the Learnova session shell.
   Everything visual that later stages reuse lives here. */

export function Wordmark() {
  return (
    <span className="font-display text-[1.35rem] font-semibold tracking-tight text-ink">
      Learnova
    </span>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[0.7rem] font-medium uppercase tracking-[0.18em] text-ink-faint">
      {children}
    </p>
  );
}

/** Large italic serif "question" — the app's signature: a concept being asked. */
export function Ask({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-[1.75rem] italic leading-tight text-ink sm:text-[2rem]">
      {children}
    </h2>
  );
}

export function PrimaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="inline-flex items-center gap-1.5 self-start rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-on-brand transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="inline-flex items-center gap-1.5 self-start rounded-full border border-line px-5 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:border-ink-faint hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export type ProgressStatus = "pending" | "resurfacing" | "demonstrated" | "set-aside";

export type ProgressSegment = { status: ProgressStatus; returns: number };

/* Colour AND texture carry the meaning, so the bar reads without colour vision:
   demonstrated = solid fill, resurfacing = diagonal stripes (deepening toward
   rose with each return), set aside = hollow outline, pending = faint solid. */
function segmentStyle(seg: ProgressSegment, isCurrent: boolean): React.CSSProperties {
  switch (seg.status) {
    case "demonstrated":
      return { backgroundColor: "var(--right-fg)" };
    case "resurfacing": {
      const rosePct = Math.min((seg.returns - 1) * 40, 80); // 1st→amber, 2nd→40%, 3rd+→80% rose
      const c = `color-mix(in oklab, var(--wrong-fg) ${rosePct}%, var(--almost-fg))`;
      return {
        backgroundImage: `repeating-linear-gradient(45deg, ${c} 0 2px, transparent 2px 4px)`,
      };
    }
    case "set-aside":
      return { backgroundColor: "transparent", boxShadow: "inset 0 0 0 1.5px var(--wrong-fg)" };
    default:
      return { backgroundColor: isCurrent ? "var(--ink)" : "var(--line)" };
  }
}

const STATUS_LABEL: Record<ProgressStatus, string> = {
  demonstrated: "demonstrated",
  resurfacing: "coming back around",
  "set-aside": "set aside",
  pending: "not yet attempted",
};

/** Segmented status indicator: a concept counts when demonstrated, not when visited. */
export function Progress({
  segments,
  current,
}: {
  segments: ProgressSegment[];
  current: number;
}) {
  const solid = segments.filter((s) => s.status === "demonstrated").length;
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[0.7rem] font-medium tracking-wide text-ink">
        Concept {current + 1}
        <span className="text-ink-faint">/{segments.length}</span>
      </span>
      <div className="flex gap-1.5">
        {segments.map((seg, i) => (
          <span
            key={i}
            style={segmentStyle(seg, i === current)}
            className={`h-2 w-6 rounded-full transition-all ${
              i === current ? "ring-2 ring-ink/30 ring-offset-1 ring-offset-paper" : ""
            }`}
            title={`Concept ${i + 1}: ${STATUS_LABEL[seg.status]}${
              seg.status === "resurfacing" && seg.returns > 1 ? ` (return ${seg.returns})` : ""
            }${i === current ? " — you are here" : ""}`}
          />
        ))}
      </div>
      <span className="font-mono text-[0.7rem] tracking-wide text-ink-faint">
        {solid} solid
      </span>
    </div>
  );
}

/** Calm "the app is thinking" state — reads as thought, not a spinner. */
export function Thinking({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="rise flex flex-col items-start gap-4 py-10">
      <div className="flex gap-1.5" aria-hidden>
        <span className="dot h-2 w-2 rounded-full bg-brand" style={{ animationDelay: "0ms" }} />
        <span className="dot h-2 w-2 rounded-full bg-brand" style={{ animationDelay: "160ms" }} />
        <span className="dot h-2 w-2 rounded-full bg-brand" style={{ animationDelay: "320ms" }} />
      </div>
      <div>
        <p className="text-base font-medium text-ink">{title}</p>
        <p className="mt-0.5 text-sm text-ink-soft">{sub}</p>
      </div>
    </div>
  );
}
