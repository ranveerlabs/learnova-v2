"use client";

import { useEffect, useRef, useState } from "react";
import type { Grade, Outcome } from "../api/grade/route";
import { isBusy, postJSON } from "../client";
import { MarginNotes, MarkedUpText, useDissection } from "../dissection";
import {
  Arrow,
  Aside,
  Ask,
  GhostButton,
  Label,
  Leaf,
  Notice,
  PrimaryButton,
  Working,
} from "../ui";
import type { Production, Provenance, Question } from "./types";
import { play } from "../tone";
import { useSpeech } from "./voice";

// topic-only session has no source, so the questions it already asked stand in.
// the prompt is very loud about this being context and not a passage
function materialFrom(concept: string, questions: Question[]) {
  const lines = questions
    .filter((q) => q.concept === concept)
    .map((q) => {
      const p = [q.prompt, `Correct answer: ${q.answer}`];
      if (q.because) p.push(q.because);
      return p.join("\n");
    });

  return [
    `Material on"${concept}", as presented to the student during this session.`,
    "",
    lines.join("\n\n"),
  ].join("\n");
}

// the page itself does not scroll, some div up the tree does. find which one
function closestScroller(from: HTMLElement | null) {
  for (let el = from?.parentElement ?? null; el; el = el.parentElement) {
    const o = getComputedStyle(el).overflowY;
    if ((o === "auto" || o === "scroll") && el.scrollHeight > el.clientHeight)
      return el;
  }
  return null;
}

const OUTCOME: Record<Outcome, { word: string; mark: string; ink: string }> = {
  solid: {
    word: "Demonstrated",
    mark: "var(--solid-mark)",
    ink: "var(--solid-ink)",
  },
  shaky: {
    word: "Nearly there",
    mark: "var(--shaky-mark)",
    ink: "var(--shaky-ink)",
  },
  "not-yet": {
    word: "Not yet",
    mark: "var(--broken-mark)",
    ink: "var(--broken-ink)",
  },
};

function OutcomeLine({
  outcome,
  verdict,
}: {
  outcome: Outcome;
  verdict: string;
}) {
  const o = OUTCOME[outcome];
  return (
    <div
      className="flex flex-col gap-2 border-l-[3px] py-1 pl-4"
      style={{ borderLeftColor: o.mark }}
    >
      <span
        style={{ color: o.ink, fontVariationSettings: '"wdth" 88' }}
        className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.15em]"
      >
        {o.word}
      </span>
      <p className="font-read text-[1.125rem] leading-[1.5] text-ink">
        {verdict}
      </p>
    </div>
  );
}

function LeftOut({ items }: { items: string[] }) {
  if (!items.length) return null;
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

export function TeachBack({
  concept,
  notes,
  questions,
  provenance,
  index,
  total,
  onDone,
  onNext,
  onStop,
}: {
  concept: string;
  notes: string;
  questions: Question[];
  provenance: Provenance;
  index: number;
  total: number;
  onDone: (production: Production) => void;
  onNext: () => void;
  onStop: () => void;
}) {
  const [explanation, setExplanation] = useState("");
  const [usedVoice, setUsedVoice] = useState(false);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wasBusy, setWasBusy] = useState(false);
  const [active, setActive] = useState<number | null>(null);

  const marked = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!grade) return;

    const sc = closestScroller(marked.current);
    const top = () => sc?.scrollTo({ top: 0 });
    top();
    const raf = requestAnimationFrame(top);
    return () => cancelAnimationFrame(raf);
  }, [grade]);

  const speech = useSpeech();
  const usesNotes = provenance === "grounded" && Boolean(notes);
  const source = usesNotes ? notes : materialFrom(concept, questions);
  const dissection = useDissection(explanation, grade?.annotations ?? []);

  const heard = [speech.transcript, speech.interim]
    .filter(Boolean)
    .join("")
    .trim();

  function keepHeard() {
    if (!heard) return;
    setExplanation((prev) => (prev ? `${prev.trim()} ${heard}` : heard));
    setUsedVoice(true);
    speech.reset();
  }

  async function submit() {
    const said = explanation.trim();
    if (!said) return;
    setLoading(true);
    setError(null);
    setWasBusy(false);
    try {
      const via = usedVoice ? "voice" : "typed";
      const g = await postJSON<Grade>("/api/grade", {
        source,
        concept,
        explanation: said,
        brief: true,
        via,
        grounded: usesNotes,
      });
      setGrade(g);
      play(
        g.outcome === "not-yet" ? "wrong" : "right",
        g.outcome === "solid" ? 1 : 0.4,
      );
      onDone({ concept, explanation: said, via, outcome: g.outcome });
    } catch (e) {
      setWasBusy(isBusy(e));
      setError(
        e instanceof Error ? e.message : "That did not get marked. Try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (grade) {
    const more = index + 1 < total;
    return (
      <section
        ref={marked}
        className="mx-auto flex w-full max-w-[74rem] flex-col gap-6 py-4 sm:gap-8 sm:py-6"
      >
        <div className="rise flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Label>{concept}</Label>
            <span className="font-mono text-[0.6875rem] tabular-nums text-ink-faint">
              said {usedVoice ? "aloud" : "in writing"}
            </span>
          </div>
          <OutcomeLine outcome={grade.outcome} verdict={grade.verdict} />

          {!usesNotes && (
            <p className="max-w-[62ch] font-sans text-[0.8125rem] leading-[1.6] text-ink-faint">
              Nothing here was checked against a source. You pasted no material,
              so these marks are one AI model&rsquo;s opinion, and it can be
              wrong while sounding certain. If you have reason to think a mark
              has the facts wrong, back yourself and go and check.
            </p>
          )}
        </div>

        <details className="group flex flex-col border-t border-line pt-4">
          <summary
            style={{ fontVariationSettings: '"wdth" 88' }}
            className="inline-flex cursor-pointer list-none items-center gap-1.5 self-start font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-ink-faint transition-colors hover:text-ink-soft"
          >
            <span
              aria-hidden
              className="inline-block transition-transform group-open:rotate-90"
            >
              ›
            </span>
            See why
          </summary>

          <div
            className={`mt-5 grid gap-x-10 gap-y-8 ${
              dissection.cards.length > 0
                ? "xl:grid-cols-[minmax(0,44rem)_minmax(0,22rem)]"
                : "max-w-[48rem]"
            }`}
          >
            <div className="min-w-0 xl:col-start-1">
              <MarkedUpText
                segments={dissection.segments}
                cards={dissection.cards}
                active={active}
                setActive={setActive}
                grounded={usesNotes}
              />
            </div>

            {dissection.cards.length > 0 && (
              <div className="min-w-0 xl:col-start-2 xl:row-span-3 xl:row-start-1">
                <MarginNotes
                  cards={dissection.cards}
                  active={active}
                  setActive={setActive}
                  grounded={usesNotes}
                />
              </div>
            )}

            <div className="min-w-0 xl:col-start-1">
              <LeftOut items={grade.missed} />
            </div>
          </div>
        </details>

        <div
          className="rise flex flex-wrap items-center gap-3"
          style={{ ["--i" as string]: 4 }}
        >
          {more ? (
            <PrimaryButton onClick={onNext}>
              Next concept <Arrow />
            </PrimaryButton>
          ) : (
            <PrimaryButton onClick={onStop}>
              See where you landed <Arrow />
            </PrimaryButton>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-[52rem] flex-col gap-5 py-4 sm:gap-7 sm:py-6">
      <div className="rise flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Label>Round 4 {total > 1 ? `· ${index + 1} of ${total}` : ""}</Label>
        </div>

        <Ask>Explain {concept} in your own words.</Ask>

        <p className="max-w-[54ch] font-sans text-[0.9375rem] leading-[1.6] text-ink-soft">
          One or two sentences is plenty. Nothing on screen will help you this
          time, and that is the only reason this round tells you anything the
          others could not.
        </p>
      </div>

      {error && (
        <div className="flex flex-col gap-3.5">
          {wasBusy ? <Aside>{error}</Aside> : <Notice>{error}</Notice>}
          <div className="flex flex-wrap items-center gap-3">
            {index + 1 < total && (
              <GhostButton onClick={onNext}>
                Try a different concept
              </GhostButton>
            )}
            <GhostButton onClick={onStop}>
              Skip this and see your results
            </GhostButton>
          </div>
        </div>
      )}

      {speech.supported && (
        <div
          className="rise flex flex-col gap-3"
          style={{ ["--i" as string]: 1 }}
        >
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() =>
                speech.listening ? speech.stop() : speech.start()
              }
              className={`btn inline-flex items-center gap-2.5 border-2 px-4 py-2.5 font-sans text-[0.875rem] font-semibold transition-colors ${
                speech.listening
                  ? "border-broken-mark bg-broken-tint text-broken-ink"
                  : "border-line-strong text-ink-soft hover:border-accent hover:text-accent"
              }`}
            >
              <span
                aria-hidden
                className={`block h-2.5 w-2.5 ${
                  speech.listening ? "listening bg-broken-mark" : "bg-ink-faint"
                }`}
              />
              {speech.listening ? "Listening, tap to stop" : "Say it out loud"}
            </button>

            {heard && !speech.listening && (
              <button
                onClick={keepHeard}
                className="btn bg-accent px-4 py-2.5 font-sans text-[0.875rem] font-semibold text-on-accent"
              >
                Use this text
              </button>
            )}
            {heard && (
              <button
                onClick={() => speech.reset()}
                className="font-sans text-[0.8125rem] font-medium text-ink-faint underline underline-offset-4 hover:text-ink"
              >
                Discard
              </button>
            )}
          </div>

          {(heard || speech.listening) && (
            <div
              className={`border border-l-[3px] border-line bg-sunk/60 p-3.5 ${
                speech.listening ? "transcript-live" : ""
              }`}
            >
              <p
                style={{ fontVariationSettings: '"wdth" 88' }}
                className="mb-1.5 font-sans text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-ink-faint"
              >
                Heard so far, yours to correct
              </p>
              <p className="font-read text-[1rem] leading-[1.6] text-ink">
                {speech.transcript}
                {speech.interim && (
                  <span className="text-ink-faint"> {speech.interim}</span>
                )}
                {!heard && <span className="text-ink-faint">Listening…</span>}
              </p>
            </div>
          )}

          {speech.error && (
            <p
              role="alert"
              className="font-sans text-[0.8125rem] text-broken-ink"
            >
              {speech.error}
            </p>
          )}
        </div>
      )}

      <div
        className="rise flex flex-col gap-4"
        style={{ ["--i" as string]: 2 }}
      >
        <Leaf
          value={explanation}
          onChange={setExplanation}
          autoFocus={!speech.supported}
          minRows={5}
          placeholder="In your own words…"
          onSubmit={() => {
            if (!loading && explanation.trim()) submit();
          }}
        />

        <div className="flex flex-wrap items-center gap-3">
          <PrimaryButton
            onClick={submit}
            disabled={loading || !explanation.trim()}
          >
            {loading ? "Marking…" : "Submit"} {!loading && <Arrow />}
          </PrimaryButton>

          {loading && <Working />}
          {!loading && (
            <span
              style={{ fontVariationSettings: '"wdth" 88' }}
              className="font-sans text-[0.75rem] text-ink-faint pointer-coarse:hidden"
            >
              <kbd className="border border-line-strong bg-sunk px-1.5 py-0.5 font-mono text-[0.6875rem]">
                Enter
              </kbd>
              {""}
              to send, <kbd className="font-mono">Shift</kbd>+
              <kbd className="font-mono">Enter</kbd> for a new line
            </span>
          )}
          {!speech.supported && (
            <p className="font-sans text-[0.75rem] text-ink-faint">
              Speech input needs Chrome or Edge. Typing works everywhere.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
