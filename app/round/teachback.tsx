"use client";

import { useState } from "react";
import type { Annotation, Grade, Outcome } from "../api/grade/route";
import { postJSON } from "../client";
import { MarginNotes, MarkedUpText, useDissection } from "../dissection";
import { Followups } from "../followups";
import { Arrow, Ask, GhostButton, Label, Leaf, Notice, PrimaryButton } from "../ui";
import type { Production, Provenance, Question } from "./types";
import { play, useSpeech } from "./voice";

/* Round 4. The whole point of the other four stages.

   Everything has been taken away by now: no options, no sentence, no chips.
   The student says the thing in their own words or they do not, and what
   comes back is the honest answer either way. This is the only stage that is
   graded by a model rather than checked locally, and the only one with no
   timer on it, because rushing the one moment that produces real evidence
   would be the single most self-defeating thing this mode could do. */

/* ── What the grade is measured against ───────────────────────────────────
   The grader marks an explanation against source material and nothing else,
   which is what stops it inventing a rubric out of its own knowledge.

   A grounded session has real material to give it. A topic-only session does
   not, and there is no honest way to conjure one, so it is given exactly what
   the student was actually taught during the session: the questions they saw,
   their answers, and the one-line reasons. That is a true record of the
   material this session presented, and the screen says plainly that it was
   written by a model rather than drawn from the student's own notes. */
function materialFrom(concept: string, questions: Question[]): string {
  const mine = questions.filter((q) => q.concept === concept);
  const lines = mine.map((q) => {
    const parts = [`${q.prompt}`, `Correct answer: ${q.answer}`];
    if (q.because) parts.push(q.because);
    return parts.join("\n");
  });

  return [
    `Material on "${concept}", as presented to the student during this session.`,
    "",
    lines.join("\n\n"),
  ].join("\n");
}

/* ── The marking apparatus, kept from the Teach-Back session ───────────── */

const OUTCOME: Record<Outcome, { word: string; mark: string; ink: string }> = {
  solid: { word: "Demonstrated", mark: "var(--solid-mark)", ink: "var(--solid-ink)" },
  shaky: { word: "Nearly there", mark: "var(--shaky-mark)", ink: "var(--shaky-ink)" },
  "not-yet": { word: "Not yet", mark: "var(--broken-mark)", ink: "var(--broken-ink)" },
};

/** The call and the reason for it, together, so the outcome word is never
    left to carry meaning by colour alone. */
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

/** Points the concept required that never appear in the student's text. They
    have no span to mark, so they get their own block rather than a siglum. */
function LeftOut({ items }: { items: string[] }) {
  if (items.length === 0) return null;
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

/* ── The round ──────────────────────────────────────────────────────────── */

export function TeachBack({
  concept,
  notes,
  questions,
  provenance,
  index,
  total,
  sound,
  onDone,
  onNext,
  onStop,
}: {
  concept: string;
  /** The student's own material, when they pasted any. */
  notes: string;
  /** Everything the session asked about this concept, for a topic-only run. */
  questions: Question[];
  provenance: Provenance;
  index: number;
  total: number;
  sound: boolean;
  /** Records the graded production the moment it comes back, so a student who
      walks away after reading their result still has it counted. */
  onDone: (production: Production) => void;
  /** Move on to the next concept in the round. */
  onNext: () => void;
  /** End Round 4 here and go to the results. */
  onStop: () => void;
}) {
  const [explanation, setExplanation] = useState("");
  const [usedVoice, setUsedVoice] = useState(false);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<number | null>(null);

  const speech = useSpeech();
  const source = provenance === "grounded" && notes ? notes : materialFrom(concept, questions);
  const dissection = useDissection(explanation, grade?.annotations ?? []);

  /* Whatever the recogniser has settled on, plus whatever it is still
     revising, so the student watches their sentence arrive rather than
     wondering whether the microphone is doing anything. */
  const heard = [speech.transcript, speech.interim].filter(Boolean).join(" ").trim();

  function takeTranscript() {
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
    try {
      const result = await postJSON<Grade>("/api/grade", {
        source,
        concept,
        explanation: said,
        /* Round 4 asks for a sentence or two, possibly spoken. The rubric
           needs to know that, or it marks brevity as a gap. */
        brief: true,
        via: usedVoice ? "voice" : "typed",
      });
      setGrade(result);
      if (sound) play(result.outcome === "not-yet" ? "wrong" : "right", result.outcome === "solid" ? 1 : 0.4);
      onDone({
        concept,
        explanation: said,
        via: usedVoice ? "voice" : "typed",
        outcome: result.outcome,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  /* ── Marked ──────────────────────────────────────────────────────────── */
  if (grade) {
    const more = index + 1 < total;
    return (
      <section className="mx-auto flex w-full max-w-[74rem] flex-col gap-8 py-6">
        <div className="rise flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Label>{concept}</Label>
            <span className="font-mono text-[0.6875rem] tabular-nums text-ink-faint">
              said {usedVoice ? "aloud" : "in writing"}
            </span>
          </div>
          <OutcomeLine outcome={grade.outcome} verdict={grade.verdict} />
        </div>

        <div
          className={`grid gap-x-10 gap-y-8 ${
            dissection.cards.length > 0
              ? "xl:grid-cols-[minmax(0,44rem)_minmax(0,22rem)]"
              : "max-w-[48rem]"
          }`}
        >
          <div className="rise min-w-0 xl:col-start-1" style={{ ["--i" as string]: 1 }}>
            <MarkedUpText
              segments={dissection.segments}
              cards={dissection.cards}
              active={active}
              setActive={setActive}
            />
          </div>

          {dissection.cards.length > 0 && (
            <div className="min-w-0 xl:col-start-2 xl:row-span-3 xl:row-start-1">
              <MarginNotes cards={dissection.cards} active={active} setActive={setActive} />
            </div>
          )}

          <div className="rise min-w-0 xl:col-start-1" style={{ ["--i" as string]: 2 }}>
            <LeftOut items={grade.missed} />
          </div>

          <div className="rise min-w-0 xl:col-start-1" style={{ ["--i" as string]: 3 }}>
            <Followups
              source={source}
              concept={concept}
              explanation={explanation}
              feedback={feedbackSummary(grade)}
            />
          </div>
        </div>

        {/* The first production was required. Any after it are offered, and
            stopping is a real choice rather than a way of giving up: one
            unscaffolded answer is all this round ever promised to demand. */}
        <div className="rise flex flex-wrap items-center gap-3" style={{ ["--i" as string]: 4 }}>
          {more ? (
            <>
              <PrimaryButton onClick={onNext}>
                Try another concept <Arrow />
              </PrimaryButton>
              <GhostButton onClick={onStop}>Stop here and see the results</GhostButton>
            </>
          ) : (
            <PrimaryButton onClick={onStop}>
              See where you landed <Arrow />
            </PrimaryButton>
          )}
        </div>
      </section>
    );
  }

  /* ── Producing ───────────────────────────────────────────────────────── */
  return (
    <section className="mx-auto flex w-full max-w-[52rem] flex-col gap-7 py-6">
      <div className="rise flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Label>
            Round 4 {total > 1 ? `· ${index + 1} of ${total}` : ""}
          </Label>
          <span
            style={{ fontVariationSettings: '"wdth" 88' }}
            className="rounded-[3px] bg-accent-wash px-2 py-0.5 font-sans text-[0.5625rem] font-bold uppercase tracking-[0.12em] text-accent"
          >
            No timer
          </span>
        </div>

        <Ask>Explain {concept} in your own words.</Ask>

        <p className="max-w-[54ch] font-sans text-[0.9375rem] leading-[1.6] text-ink-soft">
          One or two sentences is plenty. Nothing on screen will help you this time, and that is the
          only reason this round tells you anything the others could not.
        </p>
      </div>

      {error && <Notice>{error}</Notice>}

      {/* Voice, when the browser has it. The typed field below is always
          present regardless: speech is an alternative way in, never the only
          one, and it is never the thing standing between a student and the
          round. */}
      {speech.supported && (
        <div className="rise flex flex-col gap-3" style={{ ["--i" as string]: 1 }}>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => (speech.listening ? speech.stop() : speech.start())}
              className={`btn inline-flex items-center gap-2.5 rounded-[3px] border-2 px-4 py-2.5 font-sans text-[0.875rem] font-semibold transition-colors ${
                speech.listening
                  ? "border-broken-mark bg-broken-tint text-broken-ink"
                  : "border-line-strong text-ink-soft hover:border-accent hover:text-accent"
              }`}
            >
              <span
                aria-hidden
                className={`block h-2.5 w-2.5 rounded-full ${
                  speech.listening ? "listening bg-broken-mark" : "bg-ink-faint"
                }`}
              />
              {speech.listening ? "Listening, tap to stop" : "Say it out loud"}
            </button>

            {heard && !speech.listening && (
              <button
                onClick={takeTranscript}
                className="btn rounded-[3px] bg-accent px-4 py-2.5 font-sans text-[0.875rem] font-semibold text-on-accent"
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

          {/* Nothing is ever submitted from audio. What was heard is shown
              here, and it only becomes an answer when the student puts it in
              the box below and sends it themselves. */}
          {(heard || speech.listening) && (
            <div
              className={`rounded-[3px] border border-l-[3px] border-line bg-sunk/60 p-3.5 ${
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
                {speech.interim && <span className="text-ink-faint"> {speech.interim}</span>}
                {!heard && <span className="text-ink-faint">Listening…</span>}
              </p>
            </div>
          )}

          {speech.error && (
            <p role="alert" className="font-sans text-[0.8125rem] text-broken-ink">
              {speech.error}
            </p>
          )}
        </div>
      )}

      <div className="rise flex flex-col gap-4" style={{ ["--i" as string]: 2 }}>
        <Leaf
          value={explanation}
          onChange={setExplanation}
          autoFocus={!speech.supported}
          minRows={5}
          placeholder="In your own words…"
        />

        <div className="flex flex-wrap items-center gap-3">
          <PrimaryButton onClick={submit} disabled={loading || !explanation.trim()}>
            {loading ? "Marking…" : "Submit"} {!loading && <Arrow />}
          </PrimaryButton>
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
