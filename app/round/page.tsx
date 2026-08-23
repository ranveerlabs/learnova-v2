"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./round.css";
import { Entry } from "./entry";
import { summarizeRound } from "./engine";
import { Interval } from "./interval";
import { Reveal } from "./reveal";
import { useRoundSession } from "./session";
import { TeachBack } from "./teachback";
import { PresentationBoundary } from "./presentations/boundary";
import { pickPresentation } from "./presentations/registry";
import {
  LadderRail,
  PlainEscape,
  ProvenanceBadge,
  RunClock,
  TimerRing,
  Verdict,
} from "./ui";
import {
  ADVANCE_MS,
  type Question,
  QUESTION_SECONDS,
  QUESTIONS_PER_ROUND,
  type Round,
  WARM_UP_COUNT,
} from "./types";
import { AudioControls } from "../audio-controls";
import { play } from "../tone";
import { Aside, Notice, Waiting, Wordmark } from "../ui";

/* Learnova, Round Mode.

   One mode, five stages, and the same concepts the whole way down with the
   scaffolding removed one rung at a time. This file is the shell and the
   traffic: what is on screen, and when it changes. The decisions are in
   engine.ts and the orchestration is in session.ts. */

/* The gutter starts narrow. Six units either side of a 390pt phone spends a
   twelfth of the width on nothing, and the width is what the options are set
   in; it widens back out the moment there is width to spare. */
const SHELL = "mx-auto w-full max-w-[96rem] px-4 sm:px-6 lg:px-10 xl:px-14";

export default function Home() {
  const s = useRoundSession();

  const inPlay = s.phase === "playing";
  /* Everything except the front door is a run in progress or a run just
     finished, and both want the same strip. The results screen used to drop
     the ladder, the badge and the clock, which is the one screen where a
     filled-in ladder and a final time are the point. */
  const showRun = s.phase !== "entry";
  /* The clock runs while the student is doing something, and stops otherwise.

     It stops on the results, because a finished run has a final time and a
     final time that keeps counting is not one. It also stops on the two
     loading screens: waiting for the model to write a round is not the
     student being slow, and a clock ticking up while they can do nothing but
     watch it is the app charging them for its own latency. */
  const loading = s.phase === "opening" || s.phase === "waiting";
  const clockLive = showRun && s.phase !== "reveal" && !loading;

  /* The question clock is drawn in the header and counted in the question, so
     it is held here, between the two. The countdown itself still belongs to
     `QuestionScreen`, which is the thing that knows when a question is over
     and has to agree with the clock to the millisecond. */
  const [remaining, setRemaining] = useState(QUESTION_SECONDS * 1000);

  /* Every screen starts at its own top.

     The scrolling panel is one element that outlives the screens inside it, so
     without this a student who scrolled the between-rounds screen arrived at
     their results already scrolled past the headline. It looks exactly like a
     screen that has been cut off, and from where they are sitting it is one. */
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    /* Twice: once now, and once after the browser has laid the new screen out.
       The screens arrive with entrance animations and a focused control, and
       either can scroll the panel a frame after the effect has already run. */
    panel.current?.scrollTo({ top: 0 });
    const frame = requestAnimationFrame(() => panel.current?.scrollTo({ top: 0 }));
    return () => cancelAnimationFrame(frame);
  }, [s.phase]);

  /* Whether the round just finished was actually shortened by citation
     checking, rather than merely having lost a couple of spares. */
  const servedThisRound = s.answers.filter((a) => a.stage === s.stage).length;
  const shortened =
    (s.dropped[s.stage] ?? 0) > 0 &&
    servedThisRound < (s.stage === 0 ? WARM_UP_COUNT : QUESTIONS_PER_ROUND);

  /* A correct answer flashes through the header clock. Held here rather than
     in the question because the clock is drawn here. */
  const [cheering, setCheering] = useState(false);
  const cheer = useCallback(() => {
    setCheering(true);
    setTimeout(() => setCheering(false), 420);
  }, []);

  return (
    <div
      className={`relative z-10 flex h-full min-h-0 flex-1 flex-col ${
        s.phase === "entry" ? "desk-grid" : ""
      }`}
    >
      {/* One strip, always on, showing everything at once.

          This used to empty itself the moment a round started: the wordmark,
          the rung, where the questions came from and the run clock all
          disappeared, on the theory that anything in the corner of the eye
          competes with the retrieval. For one person alone with a screen that
          may well be true. For a room watching one screen it is just an
          interface that keeps hiding half of itself, and the half it hides is
          the half that tells you what is going on.

          So the timer and the combo moved up here too, out of the question
          area. There is now exactly one band of chrome instead of two, it is
          in the same place on every screen, and nothing in it ever appears or
          vanishes on you mid-round.

          On a phone it is two rows rather than one, and that is the shape it
          is built to: identity and the ladder above, the run's instruments
          below. What it must never do is spill, and it used to do both. Six
          units of gap on one wrapping line pushed the question timer clean off
          the right edge of a 360pt screen, and the number of rows moved with
          the length of the rung label: "Pick it out" fitted on two and "Say it
          yourself" tipped it onto three, so the top of every screen sat half
          an inch lower in some rounds than in others. The pieces in it shrink
          now instead of wrapping, and the strip is the same height all run. */}
      <header className="z-30 shrink-0 border-b border-line bg-ground/85 backdrop-blur-md">
        <div
          className={`${SHELL} flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 py-2 sm:gap-x-6 sm:gap-y-2 sm:py-2.5`}
        >
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-5">
            <Wordmark />
            {showRun && <LadderRail stage={s.stage} finished={s.phase === "reveal"} />}
          </div>

          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {showRun && s.phase !== "opening" && <ProvenanceBadge provenance={s.provenance} />}
            {/* Just the clock. It used to be a speedrun ghost, racing your own
                best time with a running +/- beside it, and that went with the
                run time being the thing you were judged on. What you are
                measured against now is the rating, which is not a number that
                can be counted up to live. The clock stayed because how long a
                run took is still worth knowing. */}
            {showRun && <RunClock elapsed={s.runElapsed} live={clockLive} />}
            <AudioControls />
            {/* The question clock. Lives here rather than in the question so
                that it is in the same place, at the same size, on every screen
                a run passes through. */}
            {inPlay && (
              <TimerRing
                remaining={remaining}
                total={QUESTION_SECONDS * 1000}
                cheering={cheering}
              />
            )}
          </div>
        </div>
      </header>

      {/* Where the lock is actually enforced, once, for every screen.

          A live question never scrolls and never can: `min-h-0` is what lets
          the flex child shrink to the frame instead of pushing past it, and
          the round is built to fit what is left.

          Everything else is a reading screen. The results, the between-rounds
          summary and the front door with notes pasted into it can all be
          taller than a laptop, and hiding half of a score sheet would be a
          worse answer than scrolling it. They scroll inside this panel, so the
          header and the frame still never move.

          `min-h-full` on the inner element rather than `h-full` is load
          bearing. Centring content in a box that is exactly the container's
          height puts the top of an over-tall panel above its own scroll
          origin, where nothing can reach it; a box that is at least the
          container's height and free to grow centres while it fits and scrolls
          honestly once it does not.

          And `shrink-0` beside it, which is the other half of that same
          sentence and was missing. A minimum height stops a box being squashed
          by its own contents; it does nothing about the box being squashed by
          the flex line it sits in, and this one was: `flex-1` carries a shrink
          factor, so a reading screen taller than the panel was compressed back
          to exactly the panel's height with its content hanging out of both
          ends of a centred column. The overflow at the bottom scrolled. The
          overflow at the top did not, because the panel could not see it, and
          what was above the fold was above it for good.

          On a laptop that needed the front door with a wall of notes pasted
          into it before anything went missing. On a phone it was every reading
          screen in the run: the front door opened halfway down its own
          headline, and a graded explanation opened below the word saying how
          it went. */}
      <div
        ref={panel}
        className={`${SHELL} flex min-h-0 flex-1 flex-col ${
          inPlay ? "overflow-hidden py-2" : "overflow-y-auto py-4 lg:py-6"
        }`}
      >
        <main
          className={`flex w-full min-w-0 flex-col ${
            inPlay ? "min-h-0 flex-1" : "min-h-full shrink-0 grow justify-center"
          }`}
        >
          {/* A round the shared key was too busy to write. Said once, between
              rounds, where there is room to read it: never over a live
              question, which is the one screen this app keeps clear of
              everything that is not the question. The session has already
              stepped around the missing round by the time this appears. */}
          {s.busyRounds.length > 0 && !inPlay && (
            <div className="mx-auto mb-6 w-full max-w-[46rem]">
              <SkippedRounds rounds={s.busyRounds} />
            </div>
          )}

          {/* A round cut short because the generator could not back it up.

              Said only when the drops actually cost the student questions.
              A bank is written with a third to spare, so losing two of fifteen
              and still serving a full nine is the check doing its job with no
              consequence anybody needs to read about; announcing that would be
              noise, and noise is how a real notice gets skipped. When the round
              is genuinely short, though, the student is looking at a round that
              ended early and the honest explanation is a good one: the model
              wrote questions your notes do not support and they were thrown
              away before they reached you. */}
          {s.phase === "interval" && shortened && (
            <div className="mx-auto mb-6 w-full max-w-[46rem]">
              <DroppedQuestions
                count={s.dropped[s.stage] ?? 0}
                served={s.answers.filter((a) => a.stage === s.stage).length}
              />
            </div>
          )}

          {s.phase === "entry" && <Entry onStart={s.start} error={s.error} />}

          {s.phase === "opening" && (
            <Waiting
              title="Building your first questions"
              sub="Five quick ones, before you study anything."
            />
          )}

          {/* Reached a round faster than it could be written. Rare, but it is
              exactly what happens to the quickest students, who are the last
              people who should be punished for it. */}
          {s.phase === "waiting" && (
            <Waiting
              title={`Writing Round ${s.pendingRound ?? ""}`}
              sub="You got here faster than it could be built. A few seconds."
            />
          )}

          {s.phase === "playing" && s.current && (
            <QuestionScreen
              key={s.current.id}
              question={s.current}
              stage={s.stage}
              seed={s.seed}
              plainOnly={s.plainOnly}
              onPlainOnly={() => s.setPlainOnly(true)}
              onAnswer={s.answer}
              onAdvance={s.advance}
              onRemaining={setRemaining}
              onCorrect={cheer}
            />
          )}

          {s.phase === "interval" && (
            <Interval
              summary={summarizeRound(s.answers, s.stage as Round)}
              /* The round the session will actually reach, not the next rung
                 of the ladder. They differ when a round was skipped. */
              next={s.nextPlayable}
              splitMs={s.splits[s.splits.length - 1]?.ms ?? 0}
              runMs={s.splits.reduce((sum, sp) => sum + sp.ms, 0)}
              returning={Object.keys(s.previously).length > 0}
              onContinue={s.continueOn}
            />
          )}

          {s.phase === "round4" &&
            (s.productionOrder.length > 0 && s.productionIndex < s.productionOrder.length ? (
              <TeachBack
                key={s.productionOrder[s.productionIndex]}
                concept={s.productionOrder[s.productionIndex]}
                notes={s.notes}
                questions={Object.values(s.banks).flat().filter(Boolean) as Question[]}
                provenance={s.provenance}
                index={s.productionIndex}
                total={s.productionOrder.length}
                onDone={s.recordProduction}
                onNext={s.nextProduction}
                onStop={s.finish}
              />
            ) : (
              <NothingToProduce onFinish={s.finish} />
            ))}

          {/* `BeatIt`, the panel that used to sit under this comparing run
              times against a personal best, is gone. The comparison it made is
              now one line beside the rating, and it compares ratings, which is
              the thing worth beating. */}
          {s.phase === "reveal" && (
            <Reveal
              data={s.reveal()}
              topic={s.topic}
              provenance={s.provenance}
              best={s.best}
              previously={s.previously}
              droppedTotal={s.droppedTotal}
              sampled={s.sampled}
              onAgain={s.again}
              onRestart={s.restart}
            />
          )}
        </main>
      </div>
    </div>
  );
}


/** Which rounds were lost to the shared key being busy, and what that did and
    did not cost.

    The second sentence is the whole point of showing this at all. A round
    quietly missing is the sort of thing a student blames themselves or the app
    for; a round that is named, explained, and followed by everything else
    still working is just a queue. */
function SkippedRounds({ rounds }: { rounds: Round[] }) {
  const listed = [...rounds].sort((a, b) => a - b);
  const names = listed.map((r) => `Round ${r}`);
  const which =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

  return (
    <Aside>
      Learnova was busy when {which} {names.length === 1 ? "was" : "were"} due, so{" "}
      {names.length === 1 ? "it was" : "they were"} skipped. Everything you have already answered
      still counts, and the rest of the session carries on from here.
    </Aside>
  );
}

/** Questions the generator wrote and the server would not serve.

    Framed as what it is rather than as a fault. Every question in a grounded
    session has to carry a span copied out of the student's own material, and
    the server checks that the span is genuinely in there, character for
    character, before anybody sees the question. What could not be traced was
    invented, and inventing is the whole failure this mode exists to prevent.

    So this does not apologise for the short round. A round that is honest and
    short is the product working; the alternative on offer is a full-length
    round with made-up questions in it, which is what a topic-only session is
    and is exactly why it now says so on every screen. */
function DroppedQuestions({ count, served }: { count: number; served: number }) {
  return (
    <Aside>
      {served} questions this round, not {QUESTIONS_PER_ROUND}. Another {count} were written and
      dropped: {count === 1 ? "its quote was" : "their quotes were"} not in your notes, so you never
      saw {count === 1 ? "it" : "them"}.
    </Aside>
  );
}

function NothingToProduce({ onFinish }: { onFinish: () => void }) {
  return (
    <section className="mx-auto flex w-full max-w-[46rem] flex-col gap-5 py-10">
      <Notice>
        There was not enough answered in the rounds to pick a concept for you to explain, so Round 4
        has nothing honest to ask you about.
      </Notice>
      <button
        onClick={onFinish}
        className="btn inline-flex items-center gap-2 self-start rounded-[3px] bg-accent px-5 py-2.5 font-sans text-[0.875rem] font-semibold text-on-accent"
      >
        See the results <span aria-hidden className="arrow">→</span>
      </button>
    </section>
  );
}

/* ── A question ───────────────────────────────────────────────────────────
   The question and the options. That is now the whole of it: the timer, the
   combo and the audio controls have gone up into the header, where they are on
   screen the whole time rather than only while a question is live. */

type Result = {
  correct: boolean;
  streak: number;
  record: boolean;
  question: Question;
};

function QuestionScreen({
  question,
  stage,
  seed,
  plainOnly,
  onPlainOnly,
  onAnswer,
  onAdvance,
  onRemaining,
  onCorrect,
}: {
  question: Question;
  stage: 0 | Round;
  seed: number;
  plainOnly: boolean;
  onPlainOnly: () => void;
  onAnswer: (given: string | number | string[], timedOut?: boolean) => Result | null;
  onAdvance: () => void;
  /** Reports the countdown up to the header, which draws it. */
  onRemaining: (ms: number) => void;
  /** Fired the instant an answer lands correctly, so the header can react. */
  onCorrect: () => void;
}) {
  const [chosen, setChosen] = useState<number | null>(null);
  const [typed, setTyped] = useState("");
  const [built, setBuilt] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [ranOut, setRanOut] = useState(false);

  const startedAt = useRef(performance.now());
  const settled = useRef(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const total = QUESTION_SECONDS * 1000;

  const settle = useCallback(
    (given: string | number | string[], timedOut = false) => {
      if (settled.current) return;
      settled.current = true;

      const outcome = onAnswer(given, timedOut);
      if (!outcome) return;
      setRanOut(timedOut);
      setResult(outcome);
      if (outcome.correct) onCorrect();

      /* The tone still climbs with a run of correct answers. That was the one
         part of the combo worth keeping: it is felt rather than read, it costs
         no room on screen, and it is the difference between a run that sounds
         like a run and eight identical beeps. The multiplier it used to be
         derived from is gone, so the heat comes straight off the streak. */
      const heat = Math.min(1, Math.max(0, (outcome.streak - 1) / 8));
      play(outcome.correct ? (outcome.streak >= 2 ? "combo" : "right") : "wrong", heat);

      const wait = timedOut
        ? ADVANCE_MS.timeout
        : outcome.correct
          ? ADVANCE_MS.correct
          : ADVANCE_MS.wrong;
      advanceTimer.current = setTimeout(onAdvance, wait);
    },
    [onAdvance, onAnswer, onCorrect]
  );

  /* The countdown. Driven from a monotonic start rather than by decrementing,
     so a backgrounded tab does not gain the student free time. */
  useEffect(() => {
    const id = setInterval(() => {
      const left = total - (performance.now() - startedAt.current);
      onRemaining(Math.max(0, left));
      if (left <= 0) settle("", true);
    }, 100);
    return () => clearInterval(id);
  }, [onRemaining, settle, total]);

  useEffect(() => {
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);

  /* Enter advances once an answer is showing, which is what makes a fast run
     possible without reaching for the mouse.

     Enter does double duty: it commits an answer in Rounds 2 and 3, and it
     moves on from the verdict here. That reads as a conflict and is not one,
     because the two never exist at the same moment. This listener is only
     mounted once `result` is set, and every commit handler bails the instant
     the question is revealed, so at any given moment exactly one of them is
     listening. One key for "I am done with this screen" turned out to be
     worth more than the tidiness of giving each job its own. */
  useEffect(() => {
    if (!result) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Enter" || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      onAdvance();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onAdvance, result]);

  const revealed = result !== null;

  /* Chosen once per question and remembered, so a re-render cannot swap the
     presentation out from under a student mid-answer. */
  const presentation = useMemo(
    () =>
      pickPresentation({
        format: question.format,
        question,
        seed,
        round: stage,
        plainOnly,
      }),
    [plainOnly, question, seed, stage]
  );
  const Drawn = presentation.Component;

  const props = {
    question,
    revealed,
    correct: result?.correct ?? false,
    chosen,
    value: typed,
    onChange: setTyped,
    built,
    onBuild: setBuilt,
    onAnswer: (given: string | number | string[]) => {
      if (typeof given === "number") setChosen(given);
      settle(given);
    },
  };

  /* Fills the frame rather than sitting in a 70vh puddle inside it. A question
     that occupies a third of the screen is a question nobody across the room
     can read, so this one is given the whole height and its type is sized off
     the viewport. */
  return (
    <section className="relative mx-auto flex h-full min-h-0 w-full max-w-[64rem] flex-col gap-[2vh]">
      {/* First in the tab order, invisible until focused. See PlainEscape. */}
      {!plainOnly && <PlainEscape onChoose={onPlainOnly} />}

      {/* The question and the answers, as one block, centred in whatever the
          header left behind.

          They used to be separate children of a `justify-center` column, which
          sounds the same and is not: the answer area took the slack, so the
          question sat alone at the top of the screen with a hand's width of
          empty page between it and the things that answer it. Two people
          looking at that from across a room are reading two unrelated objects.
          Grouped, they are one board. */}
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-[3vh]">
        {/* Given the full column rather than a 34-character measure: the
            generation prompt caps questions at 12 words, and the point of
            capping the words was so the question could fit a line without the
            type being shrunk to make it.

            Sized for the back of the room. The old ceiling was thirty pixels,
            which is a comfortable reading size for one person at arm's length
            and illegible to the three people behind them, and three people
            behind them is the situation this is built for.

            The size is read off both axes rather than off the width alone. A
            phone turned on its side is a wide viewport and a very short one,
            and sizing a headline off width only gave that case thirty-seven
            pixel type with about a hundred and thirty pixels left underneath
            it for four answers. The height term costs a desktop nothing,
            because the ceiling is what binds there either way. */}
        {question.format !== "blank" && (
          <h2 className="deal-in shrink-0 text-balance font-read text-[clamp(1.375rem,0.9rem+2.1vw+0.9vh,3rem)] font-medium leading-[1.12] tracking-[-0.02em] text-ink">
            {question.prompt}
          </h2>
        )}

        {/* The one place the presentation layer touches the round. Everything
            below this point is the same whichever one is drawn: the answer
            comes back in the shape checking already understands, and a
            presentation has no way to reach the ladder, the timer or the
            grade. */}
        <PresentationBoundary {...props} resetKey={question.id}>
          <Drawn {...props} />
        </PresentationBoundary>
      </div>

      {/* The verdict has a slot whether or not there is a verdict in it.

          It used to be added to the column at the moment it appeared, which
          did two bad things at once on a screen that is now pinned to the
          viewport: the whole board jumped up as the answer landed, and on a
          short window the verdict itself was pushed off the bottom edge and
          clipped, so the one line telling you what the answer was is the line
          you could not read. An empty row costs about an inch and buys a board
          that does not move all round.

          The inch it costs is scaled to the frame. Four and a half rem is a
          reasonable reservation out of a laptop and a sixth of a phone held
          sideways, where every pixel it holds empty is one the four answers
          above it needed. */}
      <div className="flex min-h-[clamp(3.25rem,9vh,4.5rem)] shrink-0 items-center">
        {result && (
          <Verdict
            correct={result.correct}
            timedOut={ranOut}
            answer={question.answer}
            onNext={() => {
              if (advanceTimer.current) clearTimeout(advanceTimer.current);
              onAdvance();
            }}
          />
        )}
      </div>
    </section>
  );
}
