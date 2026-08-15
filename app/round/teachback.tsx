"use client";

import { useEffect, useRef, useState } from "react";
import type { Annotation, Grade, Outcome } from "../api/grade/route";
import { isBusy, postJSON } from "../client";
import { MarginNotes, MarkedUpText, useDissection } from "../dissection";
import { Arrow, Aside, Ask, GhostButton, Label, Leaf, Notice, PrimaryButton, Working } from "../ui";
import type { Production, Provenance, Question } from "./types";
import { play } from "../tone";
import { useSpeech } from "./voice";

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

/** The scrolling box this element actually sits in.

    Which one that is belongs to the shell rather than to this file: `page.tsx`
    owns the viewport lock and hands every screen that is not a live question a
    panel to scroll inside. Walking up to find it keeps that arrangement in one
    place, instead of reaching for a panel by name from down here and breaking
    quietly the day the shell moves it. */
function closestScroller(from: HTMLElement | null): HTMLElement | null {
  for (let el = from?.parentElement ?? null; el; el = el.parentElement) {
    const overflow = getComputedStyle(el).overflowY;
    if ((overflow === "auto" || overflow === "scroll") && el.scrollHeight > el.clientHeight) {
      return el;
    }
  }
  return null;
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

/* ── The round ──────────────────────────────────────────────────────────── */

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
  /** The student's own material, when they pasted any. */
  notes: string;
  /** Everything the session asked about this concept, for a topic-only run. */
  questions: Question[];
  provenance: Provenance;
  index: number;
  total: number;
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
  /** Whether that error was the shared key being busy rather than a fault.
      Changes the register it is said in, not what the student can do next. */
  const [wasBusy, setWasBusy] = useState(false);
  const [active, setActive] = useState<number | null>(null);

  /* The marked-up explanation, and the reason it has a handle.

     Producing and being marked are two screens inside one phase, so the shell
     never resets the scrolling panel between them: it only does that when the
     phase itself changes. On a laptop the produce screen fits and there is no
     scroll position to inherit, so nothing was ever wrong. On a phone that
     screen is taller than the frame, a student who scrolled down to reach the
     Submit button is a student who scrolled, and their grade then arrived
     already scrolled past its own heading, its verdict and the outcome word.
     The one screen in the run that says how they actually did opened halfway
     down itself. */
  const marked = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!grade) return;

    /* The panel is put back to its top, rather than the section being asked to
       scroll itself into view. `scrollIntoView` aligns against whatever the
       browser decides the scrollport is and lands a little differently
       depending on what else moved that frame; this names the thing to scroll
       and the place to put it, and there is nothing left to be approximate
       about.

       Twice, for the same reason the shell does it twice: this screen arrives
       with entrance animations on it and a block of marked-up prose that
       settles a frame late, and either can move the scroll after an effect has
       already run. */
    const scroller = closestScroller(marked.current);
    const top = () => scroller?.scrollTo({ top: 0 });
    top();
    const frame = requestAnimationFrame(top);
    return () => cancelAnimationFrame(frame);
  }, [grade]);

  const speech = useSpeech();
  /* Whether there is any real material behind this session. It decides both
     what is sent as the source and how the grader is told to treat it, so it
     is one value rather than the same condition written twice. */
  const usesNotes = provenance === "grounded" && Boolean(notes);
  const source = usesNotes ? notes : materialFrom(concept, questions);
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
    setWasBusy(false);
    try {
      const result = await postJSON<Grade>("/api/grade", {
        source,
        concept,
        explanation: said,
        /* Round 4 asks for a sentence or two, possibly spoken. The rubric
           needs to know that, or it marks brevity as a gap. */
        brief: true,
        via: usedVoice ? "voice" : "typed",
        /* And whether `source` is anything a student actually wrote. In a
           topic-only session it is a list of the questions they were asked,
           which is a record of what was covered and not a passage. Grading
           against it produced the case this was fixed for: a sound plain
           definition marked imprecise, with a multiple choice question quoted
           back underneath it as the "Source". */
        grounded: usesNotes,
      });
      setGrade(result);
      play(result.outcome === "not-yet" ? "wrong" : "right", result.outcome === "solid" ? 1 : 0.4);
      onDone({
        concept,
        explanation: said,
        via: usedVoice ? "voice" : "typed",
        outcome: result.outcome,
      });
    } catch (err) {
      setWasBusy(isBusy(err));
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  /* ── Marked ──────────────────────────────────────────────────────────── */
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

          {/* What this mark actually is, when it is not a mark against
              anything.

              This is the screen the whole run builds to and the one a student
              is most likely to take on trust: it is long, it is written in the
              register of a marked essay, and it tells them in their own words
              where they were wrong. In a grounded session it has earned that,
              because every claim behind it was traced to a line they pasted.
              In a topic-only session it has earned none of it, and the student
              has no way to tell the two apart.

              So the difference is stated, once, at the top, in the place they
              are already reading. It ends by telling them what to do about it,
              which is the part a person who already knows the answer needs and
              never got: trust yourself.

              It does not name the concept. Interpolating it put a sentence
              fragment in the middle of a sentence, "one AI model's account of
              What Tritoflex is made of", and the concept is already set as the
              heading two lines above this. Saying it twice cost the sentence
              its grammar and bought nothing. */}
          {!usesNotes && (
            <p className="max-w-[62ch] font-sans text-[0.8125rem] leading-[1.6] text-ink-faint">
              Nothing here was checked against a source. You pasted no material, so these marks are
              one AI model&rsquo;s opinion, and it can be wrong while sounding certain. If you have
              reason to think a mark has the facts wrong, back yourself and go and check.
            </p>
          )}
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

          {/* "Ask about a mark" sat here: a box that took a question about
              the grade and sent it back to the model for a written answer. It
              is gone, and so are the component and the route behind it. This
              is the screen at the end of a run that a room is watching, and a
              free-text conversation with the marker is the opposite of what
              that moment wants. */}
          <div className="rise min-w-0 xl:col-start-1" style={{ ["--i" as string]: 2 }}>
            <LeftOut items={grade.missed} />
          </div>
        </div>

        {/* One way forward, and it is forward.

            There used to be a "Stop here and see the results" beside this,
            offered after every graded concept. It was the last thing standing
            between a student and their results, which is exactly where the
            temptation to bail is highest, and a rating that claims to measure
            the whole session cannot mean much if the last third of it is
            optional. The concepts are already capped at three. */}
        <div className="rise flex flex-wrap items-center gap-3" style={{ ["--i" as string]: 4 }}>
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

  /* ── Producing ───────────────────────────────────────────────────────── */
  return (
    <section className="mx-auto flex w-full max-w-[52rem] flex-col gap-5 py-4 sm:gap-7 sm:py-6">
      <div className="rise flex flex-col gap-4">
        {/* There was a "No timer" badge here. It stopped being true when the
            run clock moved into the header and stayed on every screen: this
            round has no per-question countdown, but there is very much a
            clock, and it is running while you read this. A badge that says the
            opposite of the thing next to it is worse than no badge. */}
        <div className="flex flex-wrap items-center gap-3">
          <Label>Round 4 {total > 1 ? `· ${index + 1} of ${total}` : ""}</Label>
        </div>

        <Ask>Explain {concept} in your own words.</Ask>

        <p className="max-w-[54ch] font-sans text-[0.9375rem] leading-[1.6] text-ink-soft">
          One or two sentences is plenty. Nothing on screen will help you this time, and that is the
          only reason this round tells you anything the others could not.
        </p>
      </div>

      {/* An answer that could not be MARKED must not be a dead end.

          This is the one escape hatch left in Round 4, and it is deliberately
          not the same thing as the voluntary skip that was just removed: it
          only exists when the grader has actually failed, which is a fault at
          our end rather than a choice at theirs. Without it a student whose
          last explanation cannot be marked is stuck on the final screen of the
          run with nothing to do but press a button that is going to fail
          again. Everything they typed is still in the box, so Submit is a real
          retry and this is the second way out rather than the first. */}
      {error && (
        <div className="flex flex-col gap-3.5">
          {wasBusy ? <Aside>{error}</Aside> : <Notice>{error}</Notice>}
          <div className="flex flex-wrap items-center gap-3">
            {index + 1 < total && (
              <GhostButton onClick={onNext}>Try a different concept</GhostButton>
            )}
            <GhostButton onClick={onStop}>Skip this and see your results</GhostButton>
          </div>
        </div>
      )}

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
          /* Enter sends, the same as it does everywhere else in a round.
             Guarded here rather than in the leaf so the key can never do
             something the button next to it would refuse to do. */
          onSubmit={() => {
            if (!loading && explanation.trim()) submit();
          }}
        />

        <div className="flex flex-wrap items-center gap-3">
          <PrimaryButton onClick={submit} disabled={loading || !explanation.trim()}>
            {loading ? "Marking…" : "Submit"} {!loading && <Arrow />}
          </PrimaryButton>

          {/* The longest wait in a round, and it used to be announced by a
              disabled button whose label had changed. A button that does not
              move is a caption.

              Nothing takes the screen here on purpose. What is being marked
              is the student's own explanation, sitting in the box directly
              above, and covering it would take away the one thing worth
              looking at while a rubric is applied to it. So the signal goes
              beside the button and the words stay put.

              No label on it. The button an inch to the left already says
              "Marking…", and a meter captioned "Marking what you wrote" next
              to it was the same word twice. The meter supplies the movement,
              which is the half the button cannot do. */}
          {loading && <Working />}
          {/* Keyboard instructions, for people with a keyboard. On a phone
              this was three key names and a plus sign describing a device the
              student is not holding.

              There is no "tap" wording to put in its place here, the way the
              verdict has one: what a touch screen does instead is press the
              Submit button immediately to its left, and a line of text telling
              you to press the button next to it is not an instruction, it is
              furniture. Off by pointer rather than by width, so a laptop in a
              narrow window keeps a hint it can still act on.

              Also off while the answer is being marked. It tells you how to
              send something you have already sent, and leaving it there put
              two lines of small grey text either side of the one thing on
              that row worth reading. */}
          {!loading && (
            <span
              style={{ fontVariationSettings: '"wdth" 88' }}
              className="font-sans text-[0.75rem] text-ink-faint pointer-coarse:hidden"
            >
              <kbd className="rounded-[3px] border border-line-strong bg-sunk px-1.5 py-0.5 font-mono text-[0.6875rem]">
                Enter
              </kbd>{" "}
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
