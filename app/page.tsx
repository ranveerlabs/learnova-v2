"use client";

import { useMemo, useState } from "react";
import type { Concept } from "./api/concepts/route";
import type { Annotation, Grade, Outcome } from "./api/grade/route";
import { MIN_SOURCE_CHARS, sourceProblem, sourceStatus } from "@/lib/source";
import { postJSON } from "./client";
import { MarginNotes, MarkedUpText, useDissection } from "./dissection";
import { Followups } from "./followups";
import { Looseleaf, PixelSprite, PixelTag, SourceGauge, Steps } from "./paper";
import {
  Arrow,
  Ask,
  GhostButton,
  type ItemStatus,
  Label,
  Leaf,
  Notice,
  PrimaryButton,
  Reading,
  SessionIndex,
  SessionProgress,
  StatusGlyph,
  Wordmark,
} from "./ui";

/* One shell measurement, used by the header and the body so the wordmark sits
   over the column it belongs to. Wide enough to use a laptop screen; the
   measure of anything being *read* is capped separately, per block. */
const SHELL = "mx-auto w-full max-w-[96rem] px-6 lg:px-10 xl:px-14";

type Phase = "source" | "explain" | "result" | "done";

type Attempt = { explanation: string; grade: Grade };

type SessionItem = {
  concept: Concept;
  attempts: Attempt[];
  status: ItemStatus;
  returns: number; // how many times this concept has been sent back around
};

/* After this many attempts without a solid, the student may set the
   concept aside, which ends the loop honestly instead of punishing them. */
const SET_ASIDE_AFTER = 3;

export default function Home() {
  const [phase, setPhase] = useState<Phase>("source");
  const [source, setSource] = useState("");
  const [items, setItems] = useState<SessionItem[]>([]);
  const [queue, setQueue] = useState<number[]>([]);
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentIdx = queue[0];
  const current = currentIdx !== undefined ? items[currentIdx] : undefined;
  const lastAttempt = current?.attempts[current.attempts.length - 1];

  async function startSession() {
    /* Nothing goes to the model until there is something to read. A word or
       two would still come back as confident concepts, about nothing the
       student pasted, so this is a floor, not a formality. */
    const problem = sourceProblem(source);
    if (problem) {
      setError(problem);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { concepts } = await postJSON<{ concepts: Concept[] }>("/api/concepts", { source });
      setItems(
        concepts.map((concept) => ({ concept, attempts: [], status: "pending", returns: 0 }))
      );
      setQueue(concepts.map((_, i) => i));
      setPhase("explain");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function submitExplanation() {
    if (!current) return;
    const submitted = explanation;
    setLoading(true);
    setError(null);
    try {
      const grade = await postJSON<Grade>("/api/grade", {
        source,
        concept: `${current.concept.name}: ${current.concept.prompt}`,
        explanation: submitted,
      });
      setItems((prev) =>
        prev.map((item, i) =>
          i === currentIdx
            ? { ...item, attempts: [...item.attempts, { explanation: submitted, grade }] }
            : item
        )
      );
      setPhase("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  /** Leave the current concept with a final status and move to what's next. */
  function finishCurrent(status: "demonstrated" | "set-aside") {
    setItems((prev) => prev.map((item, i) => (i === currentIdx ? { ...item, status } : item)));
    const rest = queue.slice(1);
    setQueue(rest);
    setExplanation("");
    setError(null);
    setPhase(rest.length > 0 ? "explain" : "done");
  }

  function retryNow() {
    setExplanation("");
    setError(null);
    setPhase("explain");
  }

  function comeBackLater() {
    setItems((prev) =>
      prev.map((item, i) =>
        i === currentIdx ? { ...item, status: "resurfacing", returns: item.returns + 1 } : item
      )
    );
    setQueue((prev) => [...prev.slice(1), prev[0]]);
    setExplanation("");
    setError(null);
    setPhase("explain");
  }

  function reset() {
    setPhase("source");
    setSource("");
    setItems([]);
    setQueue([]);
    setExplanation("");
    setError(null);
  }

  const inSession = phase === "explain" || phase === "result";
  const attemptNo = (current?.attempts.length ?? 0) + 1;
  const othersWaiting = queue.length > 1;
  const demonstrated = items.filter((i) => i.status === "demonstrated");
  const setAside = items.filter((i) => i.status === "set-aside");
  const settled = demonstrated.length + setAside.length;
  const progress = items.length > 0 ? settled / items.length : 0;
  /* Reads the whole source, and the source phase re-renders on every
     keystroke, so measure once per change rather than once per render. */
  const status = useMemo(() => sourceStatus(source), [source]);

  /* The source screen keeps its own error beside the button that caused it;
     everywhere else the notice sits at the head of the column. */
  function editSource(v: string) {
    setSource(v);
    if (error) setError(null);
  }

  return (
    <div
      className={`relative z-10 flex min-h-full flex-1 flex-col ${
        /* The desk is the front door's alone. Once there is work to mark, the
           background goes back to being plain ground. */
        phase === "source" ? "desk-grid" : ""
      }`}
    >
      <header className="sticky top-0 z-30 border-b border-line bg-ground/85 backdrop-blur-md">
        <div className={`${SHELL} flex items-center justify-between gap-6 py-4`}>
          <Wordmark />
          {items.length > 0 && (
            <SessionProgress done={demonstrated.length} total={items.length} />
          )}
        </div>
        {/* The session's progress, drawn as a rule along the foot of the
            header, the same gesture as a marked line, at page scale. */}
        <div
          aria-hidden
          className="absolute inset-x-0 -bottom-px h-[2px] origin-left bg-accent transition-transform duration-700 ease-out"
          style={{ transform: `scaleX(${progress})` }}
        />
      </header>

      <div
        className={`${SHELL} flex-1 py-10 lg:py-14 ${
          inSession
            ? "grid gap-y-10 lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-x-12 xl:grid-cols-[15rem_minmax(0,1fr)] xl:gap-x-16"
            : ""
        }`}
      >
        {inSession && items.length > 0 && (
          <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
            <SessionIndex
              items={items.map((i) => ({
                name: i.concept.name,
                status: i.status,
                returns: i.returns,
                attempts: i.attempts.length,
              }))}
              current={currentIdx}
            />
          </aside>
        )}

        <main className="min-w-0">
          {error && phase !== "source" && (
            <div className="mb-8">
              <Notice>{error}</Notice>
            </div>
          )}

          {/* ── Source ─────────────────────────────────────────────────
              The front door, and the only screen in the app allowed to have
              a personality. A desk: notes on the left, a sheet of looseleaf
              on the right, supplies lying around. The rail is sticky, so the
              primary action stays on screen however long the source runs. */}
          {phase === "source" && !loading && (
            <section className="grid gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] xl:gap-x-24">
              <div className="flex flex-col gap-7 lg:sticky lg:top-24 lg:self-start">
                <div className="rise flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <PixelTag className="press-on -rotate-2">start here</PixelTag>
                    <PixelSprite
                      name="star"
                      scale={2}
                      className="press-on"
                      style={{ ["--tilt" as string]: "12deg", ["--i" as string]: 1 }}
                    />
                  </div>
                  <h2 className="font-hand text-[clamp(2.5rem,1.6rem+3.2vw,3.75rem)] leading-[0.95] tracking-tight text-ink">
                    What are you
                    <br />
                    studying?
                  </h2>
                  <p className="max-w-[34ch] font-hand text-[1.375rem] leading-[1.35] text-ink-soft">
                    Paste your notes. Learnova finds the ideas worth testing, asks you to explain
                    each one in your own words, then marks what you wrote against your source.
                  </p>
                </div>

                <Steps />

                <div className="rise flex flex-col gap-4" style={{ ["--i" as string]: 5 }}>
                  <div className="flex flex-col gap-3.5">
                    <button
                      onClick={startSession}
                      disabled={!source.trim()}
                      style={{ ["--tilt" as string]: "-1.4deg" }}
                      className="stuck sticker inline-flex items-center gap-2 self-start rounded-[3px] border-[2.5px] border-sheet-ink bg-supply-gold px-5 py-3 font-pixel text-[0.75rem] leading-none text-[#22262e] disabled:cursor-not-allowed disabled:border-line-strong disabled:bg-sunk disabled:text-ink-faint"
                    >
                      find the concepts
                      <span aria-hidden className="arrow">
                        →
                      </span>
                    </button>
                    <SourceGauge status={status} minChars={MIN_SOURCE_CHARS} />
                  </div>
                  {error && <Notice>{error}</Notice>}
                </div>
              </div>

              <div className="rise min-w-0" style={{ ["--i" as string]: 1 }}>
                <Looseleaf
                  value={source}
                  onChange={editSource}
                  placeholder="Paste notes, a textbook passage, an article…"
                  minRows={18}
                />
              </div>
            </section>
          )}

          {phase === "source" && loading && (
            <Reading title="Reading your material" sub="Picking out the ideas worth testing." />
          )}

          {/* ── Explain ─────────────────────────────────────────────────
              Same shape as the source screen: what's being asked stays put on
              the left with the action under it, and the writing surface gets
              the width. */}
          {phase === "explain" && current && !loading && (
            <section className="grid gap-x-14 gap-y-8 xl:grid-cols-[minmax(0,23rem)_minmax(0,1fr)]">
              <div className="flex flex-col gap-6 xl:sticky xl:top-24 xl:self-start">
                <div className="rise flex flex-col gap-5">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <Label>{current.concept.name}</Label>
                    {attemptNo > 1 && (
                      <span className="font-mono text-[0.6875rem] tabular-nums text-ink-faint">
                        attempt {attemptNo}
                      </span>
                    )}
                  </div>
                  <Ask>{current.concept.prompt}</Ask>
                </div>

                {lastAttempt && (
                  <div className="rise" style={{ ["--i" as string]: 1 }}>
                    <PriorMarks grade={lastAttempt.grade} />
                  </div>
                )}

                <div className="rise" style={{ ["--i" as string]: 2 }}>
                  <PrimaryButton onClick={submitExplanation} disabled={!explanation.trim()}>
                    Mark my explanation <Arrow />
                  </PrimaryButton>
                </div>
              </div>

              <div className="rise min-w-0" style={{ ["--i" as string]: 1 }}>
                <Leaf
                  value={explanation}
                  onChange={setExplanation}
                  autoFocus
                  minRows={13}
                  placeholder={
                    attemptNo > 1
                      ? "Explain it again, fresh. Aim to cover what was marked last time…"
                      : "Explain it in your own words, as if teaching someone who hasn't read the material…"
                  }
                />
              </div>
            </section>
          )}

          {phase === "explain" && loading && (
            <Reading
              title="Reading your explanation"
              sub="Checking it against your source, phrase by phrase."
            />
          )}

          {/* ── Result ─────────────────────────────────────────────── */}
          {phase === "result" && current && lastAttempt && (
            <Result
              key={`${currentIdx}-${current.attempts.length}`}
              item={current}
              attempt={lastAttempt}
              source={source}
              othersWaiting={othersWaiting}
              onDemonstrated={() => finishCurrent("demonstrated")}
              onSetAside={() => finishCurrent("set-aside")}
              onRetry={retryNow}
              onComeBack={comeBackLater}
            />
          )}

          {/* ── Done ───────────────────────────────────────────────── */}
          {phase === "done" && (
            <section className="grid gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] xl:gap-x-20">
              <div className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
                <div className="rise flex flex-col gap-4">
                  <Label>Session complete</Label>
                  <Ask>
                    {setAside.length === 0
                      ? "Every concept, demonstrated."
                      : "Here's where you actually stand."}
                  </Ask>
                  <p className="font-sans text-[0.9375rem] leading-[1.65] text-ink-soft">
                    {setAside.length === 0
                      ? `You explained ${demonstrated.length} concept${
                          demonstrated.length === 1 ? "" : "s"
                        } well enough to count. Not recognised, explained.`
                      : "Demonstrated means you explained it and the explanation held up. Set aside means it's still open, and it's the place to start next time."}
                  </p>
                </div>
                <div className="rise" style={{ ["--i" as string]: 1 }}>
                  <GhostButton onClick={reset}>Start a new session</GhostButton>
                </div>
              </div>

              <div className="rise flex min-w-0 flex-col gap-2" style={{ ["--i" as string]: 1 }}>
                <div className="flex items-baseline justify-between gap-4">
                  <Label>The record</Label>
                  <span className="font-mono text-[0.6875rem] tabular-nums text-ink-faint">
                    {demonstrated.length} demonstrated
                    {setAside.length > 0 && ` · ${setAside.length} set aside`}
                  </span>
                </div>
                <ol className="divide-y divide-line overflow-hidden rounded-[3px] border border-line bg-page">
                  {items.map((item, i) => (
                    <li
                      key={i}
                      style={{ ["--i" as string]: i + 2 }}
                      className="rise flex items-center gap-3 px-4 py-3 transition-colors hover:bg-sunk/50"
                    >
                      <StatusGlyph status={item.status} />
                      <span className="min-w-0 flex-1 font-read text-[1rem] leading-snug text-ink">
                        {item.concept.name}
                      </span>
                      <span className="w-[5.5rem] shrink-0 text-right font-mono text-[0.6875rem] tabular-nums text-ink-faint">
                        {item.attempts.length}{" "}
                        {item.attempts.length === 1 ? "attempt" : "attempts"}
                      </span>
                      <span
                        className="w-[2.25rem] shrink-0 text-right font-mono text-[0.6875rem] tabular-nums text-ink-faint"
                        title={
                          item.returns > 0
                            ? `Came back around ${item.returns} time${
                                item.returns === 1 ? "" : "s"
                              }`
                            : undefined
                        }
                      >
                        {item.returns > 0 ? `↩${item.returns}` : ""}
                      </span>
                      <span
                        style={{ fontVariationSettings: '"wdth" 88' }}
                        className={`w-[6.5rem] shrink-0 text-right font-sans text-[0.625rem] font-semibold uppercase tracking-[0.12em] ${
                          item.status === "demonstrated" ? "text-solid-ink" : "text-gap-ink"
                        }`}
                      >
                        {item.status === "demonstrated" ? "Demonstrated" : "Set aside"}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

/* ── The result: an apparatus ─────────────────────────────────────────────
   On wide screens the notes run down a true margin beside the whole result,
   not just beside the text block, so the column never strands a void under
   itself. Below xl everything collapses into one flow, with the notes still
   directly after the text they annotate. */

function Result({
  item,
  attempt,
  source,
  othersWaiting,
  onDemonstrated,
  onSetAside,
  onRetry,
  onComeBack,
}: {
  item: SessionItem;
  attempt: Attempt;
  source: string;
  othersWaiting: boolean;
  onDemonstrated: () => void;
  onSetAside: () => void;
  onRetry: () => void;
  onComeBack: () => void;
}) {
  const [active, setActive] = useState<number | null>(null);
  const { segments, cards } = useDissection(attempt.explanation, attempt.grade.annotations);
  const solid = attempt.grade.outcome === "solid";

  /* Column 1 holds five stacked blocks; the margin pins to row 1 and spans
     them. Keep the span in step if a block is added or removed. */
  const col1 = "min-w-0 xl:col-start-1";

  /* Bounded, not stretched: the text column is capped at a readable measure
     and the margin sized to hold a note, so the apparatus grows to a real
     width on a laptop and then stops rather than sprawling. */
  return (
    <section
      className={`grid gap-x-10 gap-y-9 ${
        cards.length > 0
          ? "xl:max-w-[74rem] xl:grid-cols-[minmax(0,44rem)_minmax(0,22rem)] 2xl:max-w-[82rem] 2xl:grid-cols-[minmax(0,48rem)_minmax(0,24rem)]"
          : "max-w-[48rem]"
      }`}
    >
      <div className={`${col1} rise flex flex-col gap-3`}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Label>{item.concept.name}</Label>
          {item.attempts.length > 1 && (
            <span className="font-mono text-[0.6875rem] tabular-nums text-ink-faint">
              attempt {item.attempts.length}
            </span>
          )}
        </div>
        <OutcomeLine outcome={attempt.grade.outcome} verdict={attempt.grade.verdict} />
      </div>

      <div className={`${col1} rise`} style={{ ["--i" as string]: 1 }}>
        <MarkedUpText
          segments={segments}
          cards={cards}
          active={active}
          setActive={setActive}
        />
      </div>

      {cards.length > 0 && (
        <div className="min-w-0 xl:sticky xl:top-24 xl:col-start-2 xl:row-span-5 xl:row-start-1 xl:self-start">
          <MarginNotes cards={cards} active={active} setActive={setActive} />
        </div>
      )}

      <div className={`${col1} rise`} style={{ ["--i" as string]: 2 }}>
        <LeftOut items={attempt.grade.missed} />
      </div>

      <div className={`${col1} rise`} style={{ ["--i" as string]: 3 }}>
        <Followups
          source={source}
          concept={`${item.concept.name}: ${item.concept.prompt}`}
          explanation={attempt.explanation}
          feedback={feedbackSummary(attempt.grade)}
        />
      </div>

      <div className={`${col1} rise`} style={{ ["--i" as string]: 4 }}>
        {solid ? (
          <PrimaryButton onClick={onDemonstrated}>
            {othersWaiting ? (
              <>
                Next concept <Arrow />
              </>
            ) : (
              "Finish session"
            )}
          </PrimaryButton>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="font-sans text-[0.875rem] leading-[1.6] text-ink-soft">
              A concept counts when you can explain it, not when you&apos;ve seen it. Take another
              run now{othersWaiting ? ", or let it come back around later" : ""}.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <PrimaryButton onClick={onRetry}>Try again now</PrimaryButton>
              {othersWaiting && item.attempts.length < SET_ASIDE_AFTER && (
                <GhostButton onClick={onComeBack}>Come back to this later</GhostButton>
              )}
              {(item.attempts.length >= SET_ASIDE_AFTER || !othersWaiting) && (
                <GhostButton onClick={onSetAside}>Set it aside for today</GhostButton>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Result furniture ─────────────────────────────────────────────────── */

const OUTCOME: Record<Outcome, { word: string; mark: string; ink: string; tint: string }> = {
  solid: {
    word: "Demonstrated",
    mark: "var(--solid-mark)",
    ink: "var(--solid-ink)",
    tint: "var(--solid-tint)",
  },
  shaky: {
    word: "Nearly there",
    mark: "var(--shaky-mark)",
    ink: "var(--shaky-ink)",
    tint: "var(--shaky-tint)",
  },
  "not-yet": {
    word: "Not yet",
    mark: "var(--broken-mark)",
    ink: "var(--broken-ink)",
    tint: "var(--broken-tint)",
  },
};

/** The call and the reason for it, together, so the outcome word is never left
    to carry meaning by colour alone. */
function OutcomeLine({ outcome, verdict }: { outcome: Outcome; verdict: string }) {
  const o = OUTCOME[outcome];
  return (
    <div
      className="flex flex-col gap-2 rounded-[3px] border-l-[3px] py-1 pl-4"
      style={{ borderLeftColor: o.mark }}
    >
      <span
        style={{ color: o.ink, fontVariationSettings: '"wdth" 88' }}
        className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.15em]"
      >
        {o.word}
      </span>
      <p className="font-read text-[1.125rem] leading-[1.5] text-ink">{verdict}</p>
    </div>
  );
}

/** Points from the source that never appear in the student's text. They have
    no span to mark, so they get their own block rather than a siglum. */
function LeftOut({ items }: { items: string[] }) {
  if (items.length === 0) {
    return (
      <p className="max-w-[42rem] font-sans text-[0.875rem] leading-[1.6] text-ink-soft">
        Nothing important was left out. Your source&apos;s key points are all in there.
      </p>
    );
  }
  return (
    <section className="flex max-w-[42rem] flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <Label>Left out entirely</Label>
        <span className="font-mono text-[0.6875rem] tabular-nums text-ink-faint">
          {items.length}
        </span>
      </div>
      <ul className="flex flex-col gap-px">
        {items.map((item, i) => (
          <li
            key={i}
            className="border-l-[3px] border-gap-mark bg-gap-tint py-2.5 pl-3.5 pr-3 font-read text-[0.9375rem] leading-[1.55] text-ink"
          >
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** What the previous run left open, carried into the next attempt. */
function PriorMarks({ grade }: { grade: Grade }) {
  const flagged = grade.annotations.filter((a) => a.type !== "right");
  if (flagged.length === 0 && grade.missed.length === 0) return null;

  return (
    <details className="group rounded-[3px] border border-line bg-sunk px-4 py-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-sans text-[0.8125rem] font-medium text-ink-soft transition-colors hover:text-ink">
        <span className="inline-block transition-transform group-open:rotate-90" aria-hidden>
          ›
        </span>
        What last time left open
        <span className="font-mono text-[0.6875rem] tabular-nums text-ink-faint">
          {flagged.length + grade.missed.length}
        </span>
      </summary>
      <ul className="mt-3 flex flex-col gap-2.5">
        {flagged.map((a, i) => (
          <li key={`f${i}`} className="font-read text-[0.9375rem] leading-[1.55] text-ink-soft">
            <span
              className={a.type === "wrong" ? "mk mk-broken px-0.5" : "mk mk-shaky px-0.5"}
            >
              “{a.quote}”
            </span>
            {a.comment && <span>: {a.comment}</span>}
          </li>
        ))}
        {grade.missed.map((m, i) => (
          <li
            key={`m${i}`}
            className="border-l-[3px] border-gap-mark pl-3 font-read text-[0.9375rem] leading-[1.55] text-ink-soft"
          >
            {m}
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Compact summary of a grade, given to the follow-up route for context. */
function feedbackSummary(grade: Grade): string {
  const flagged = grade.annotations
    .filter((a: Annotation) => a.type !== "right")
    .map((a: Annotation) => {
      const src = a.sourceQuote ? ` (source: "${a.sourceQuote}")` : "";
      return `- ${a.type}: "${a.quote}". ${a.comment}${src}`;
    });
  const parts = [`Verdict: ${grade.verdict}`];
  if (flagged.length) parts.push(`Flagged:\n${flagged.join("\n")}`);
  if (grade.missed.length) parts.push(`Left out:\n${grade.missed.map((m) => `- ${m}`).join("\n")}`);
  return parts.join("\n\n");
}
