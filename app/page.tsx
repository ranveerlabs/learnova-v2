"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import "./round/round.css";
import { Entry } from "./round/entry";
import { formatClock, summarizeRound } from "./round/engine";
import { Interval } from "./round/interval";
import { Reveal } from "./round/reveal";
import { useRoundSession } from "./round/session";
import { TeachBack } from "./round/teachback";
import {
  BlankField,
  ChipBoard,
  ChoiceGrid,
  ComboMeter,
  Generating,
  LadderRail,
  PointsFly,
  ProvenanceBadge,
  RunClock,
  SoundToggle,
  TimerRing,
  Verdict,
} from "./round/ui";
import { ADVANCE_MS, comboMultiplier, MAX_COMBO, type Question, QUESTION_SECONDS, type Round, ROUND_TITLE } from "./round/types";
import { play } from "./round/voice";
import { Notice, Wordmark } from "./ui";

/* Learnova, Round Mode.

   One mode, five stages, and the same concepts the whole way down with the
   scaffolding removed one rung at a time. This file is the shell and the
   traffic: what is on screen, and when it changes. The decisions are in
   engine.ts and the orchestration is in session.ts. */

const SHELL = "mx-auto w-full max-w-[96rem] px-6 lg:px-10 xl:px-14";

export default function Home() {
  const s = useRoundSession();

  const inPlay = s.phase === "playing";
  const showRun = s.phase !== "entry" && s.phase !== "reveal";

  return (
    <div
      className={`relative z-10 flex min-h-full flex-1 flex-col ${
        s.phase === "entry" ? "desk-grid" : ""
      }`}
    >
      <header className="sticky top-0 z-30 border-b border-line bg-ground/85 backdrop-blur-md">
        <div className={`${SHELL} flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-3.5`}>
          <div className="flex items-center gap-5">
            <Wordmark />
            {showRun && <LadderRail stage={s.stage} />}
          </div>

          <div className="flex items-center gap-4">
            {showRun && s.provenance && s.phase !== "opening" && (
              <ProvenanceBadge provenance={s.provenance} />
            )}
            {showRun && <Ghost best={s.best} elapsed={s.runElapsed} live={inPlay} />}
            {/* Not during the cold open: that stage is unscored, and a points
                counter beside copy saying "nothing here is scored" would be
                the interface contradicting itself. */}
            {inPlay && s.stage !== 0 && <ComboMeter streak={s.streak} points={s.points} />}
            <SoundToggle on={s.sound} onToggle={() => s.setSound(!s.sound)} />
          </div>
        </div>
      </header>

      <div className={`${SHELL} flex-1 py-8 lg:py-10`}>
        <main className="min-w-0">
          {s.phase === "entry" && (
            <Entry onStart={s.start} error={s.error} />
          )}

          {s.phase === "opening" && (
            <Generating
              title="Building your first questions"
              sub="Five quick ones, before you study anything."
            />
          )}

          {/* Reached a round faster than it could be written. Rare, but it is
              exactly what happens to the quickest students, who are the last
              people who should be punished for it. */}
          {s.phase === "waiting" && (
            <Generating
              title={`Writing Round ${s.pendingRound ?? ""}`}
              sub="You got here faster than it could be built. A few seconds."
            />
          )}

          {s.phase === "playing" && s.current && (
            <QuestionScreen
              key={s.current.id}
              question={s.current}
              stage={s.stage}
              served={s.servedThisStage}
              limit={s.stageLimit}
              sound={s.sound}
              streak={s.streak}
              onAnswer={s.answer}
              onAdvance={s.advance}
            />
          )}

          {s.phase === "interval" && (
            <Interval
              summary={summarizeRound(s.answers, s.stage as Round)}
              next={(s.stage + 1) as Round}
              splitMs={s.splits[s.splits.length - 1]?.ms ?? 0}
              runMs={s.splits.reduce((sum, sp) => sum + sp.ms, 0)}
              onContinue={s.continueOn}
            />
          )}

          {s.phase === "round4" && (
            s.productionOrder.length > 0 && s.productionIndex < s.productionOrder.length ? (
              <TeachBack
                key={s.productionOrder[s.productionIndex]}
                concept={s.productionOrder[s.productionIndex]}
                notes={s.notes}
                questions={Object.values(s.banks).flat().filter(Boolean) as Question[]}
                provenance={s.provenance}
                index={s.productionIndex}
                total={s.productionOrder.length}
                sound={s.sound}
                onDone={s.recordProduction}
                onNext={s.nextProduction}
                onStop={s.finish}
              />
            ) : (
              <NothingToProduce onFinish={s.finish} />
            )
          )}

          {s.phase === "reveal" && (
            <>
              <Reveal
                data={s.reveal()}
                topic={s.topic}
                provenance={s.provenance}
                onRestart={s.restart}
              />
              {s.best && <BeatIt best={s.best} data={s.reveal()} runs={s.runCount} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

/* ── The ghost ────────────────────────────────────────────────────────────
   A speedrun ghost, in the literal sense: the run you are racing is your own
   last one. It only appears once there is a real previous run in this tab to
   race, because a ghost with nothing behind it is just a clock. */

function Ghost({
  best,
  elapsed,
  live,
}: {
  best: { points: number; runTime: number } | null;
  elapsed: () => number;
  live: boolean;
}) {
  const [delta, setDelta] = useState(0);

  useEffect(() => {
    if (!best || !live || !Number.isFinite(best.runTime)) return;
    let raf = 0;
    const tick = () => {
      setDelta(elapsed() - best.runTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [best, elapsed, live]);

  if (!best || !Number.isFinite(best.runTime)) return <RunClock elapsed={elapsed} live={live} />;

  const ahead = delta < 0;
  return (
    <div className="flex items-center gap-3">
      <RunClock elapsed={elapsed} live={live} />
      {Number.isFinite(best.runTime) && (
        <span
          title="Against your last completed run in this tab"
          className={`run-clock rounded-[3px] px-1.5 py-0.5 font-mono text-[0.75rem] font-semibold tabular-nums ${
            ahead ? "bg-solid-tint text-solid-ink" : "bg-sunk text-ink-faint"
          }`}
        >
          {ahead ? "-" : "+"}
          {formatClock(Math.abs(delta))}
        </span>
      )}
    </div>
  );
}

/** How this run finished against the best one in this tab. Shown only when
    there is a real previous run to compare with, and it never invents a
    target: a first run has nothing to beat and is told so. */
function BeatIt({
  best,
  data,
  runs,
}: {
  best: { points: number; runTime: number };
  data: { points: number; runTime: number };
  runs: number;
}) {
  const beatPoints = data.points > best.points;
  const beatTime = Number.isFinite(best.runTime) && data.runTime < best.runTime;

  return (
    <section className={`${""} mx-auto mt-2 flex w-full max-w-[58rem] flex-col gap-3 rounded-[3px] border border-line bg-page p-5`}>
      <span
        style={{ fontVariationSettings: '"wdth" 88' }}
        className="font-sans text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-ink-faint"
      >
        Against your best this session
      </span>
      <div className="flex flex-wrap gap-x-10 gap-y-3">
        <p className="font-read text-[1.0625rem] text-ink">
          Points:{" "}
          <span className={beatPoints ? "font-semibold text-solid-ink" : "text-ink-soft"}>
            {data.points.toLocaleString()}
          </span>{" "}
          <span className="font-mono text-[0.8125rem] text-ink-faint">
            best {best.points.toLocaleString()}
          </span>
        </p>
        {Number.isFinite(best.runTime) && (
          <p className="font-read text-[1.0625rem] text-ink">
            Time:{" "}
            <span className={beatTime ? "font-semibold text-solid-ink" : "text-ink-soft"}>
              {formatClock(data.runTime)}
            </span>{" "}
            <span className="font-mono text-[0.8125rem] text-ink-faint">
              best {formatClock(best.runTime)}
            </span>
          </p>
        )}
      </div>
      <p className="font-sans text-[0.75rem] leading-[1.5] text-ink-faint">
        {runs} run{runs === 1 ? "" : "s"} this tab. These live in memory only and go when the tab
        closes, because there are no accounts yet to keep them in.
      </p>
    </section>
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
   One screen, three possible answer surfaces, and a timer that decides when
   the question is over. */

type Result = {
  correct: boolean;
  points: number;
  streak: number;
  record: boolean;
  question: Question;
};

function QuestionScreen({
  question,
  stage,
  served,
  limit,
  sound,
  streak,
  onAnswer,
  onAdvance,
}: {
  question: Question;
  stage: 0 | Round;
  served: number;
  limit: number;
  sound: boolean;
  streak: number;
  onAnswer: (given: string | number | string[], timedOut?: boolean) => Result | null;
  onAdvance: () => void;
}) {
  const [chosen, setChosen] = useState<number | null>(null);
  const [typed, setTyped] = useState("");
  const [built, setBuilt] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [remaining, setRemaining] = useState(QUESTION_SECONDS * 1000);

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
      setResult(outcome);

      if (sound) {
        const heat = (comboMultiplier(outcome.streak) - 1) / (MAX_COMBO - 1);
        play(outcome.correct ? (outcome.streak >= 2 ? "combo" : "right") : "wrong", heat);
      }

      const wait = timedOut
        ? ADVANCE_MS.timeout
        : outcome.correct
          ? ADVANCE_MS.correct
          : ADVANCE_MS.wrong;
      advanceTimer.current = setTimeout(onAdvance, wait);
    },
    [onAdvance, onAnswer, sound]
  );

  /* The countdown. Driven from a monotonic start rather than by decrementing,
     so a backgrounded tab does not gain the student free time. */
  useEffect(() => {
    const id = setInterval(() => {
      const left = total - (performance.now() - startedAt.current);
      setRemaining(Math.max(0, left));
      if (left <= 0) settle("", true);
    }, 100);
    return () => clearInterval(id);
  }, [settle, total]);

  useEffect(() => {
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);

  /* Any key advances once an answer is showing, which is what makes a fast
     run possible without reaching for the mouse. */
  useEffect(() => {
    if (!result) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (advanceTimer.current) clearTimeout(advanceTimer.current);
        onAdvance();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onAdvance, result]);

  const revealed = result !== null;
  const heading = stage === 0 ? "Cold open" : `Round ${stage} · ${ROUND_TITLE[stage as Round]}`;

  return (
    /* Centred in the viewport rather than sitting at the top of it. A
       question with a screenful of empty page under it reads as a form; the
       same question held in the middle of the screen reads as the only thing
       happening, which is what this mode needs it to be. */
    <section className="relative mx-auto flex min-h-[66vh] w-full max-w-[46rem] flex-col justify-center gap-6 py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <span
            style={{ fontVariationSettings: '"wdth" 88' }}
            className="font-sans text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-ink-faint"
          >
            {heading}
          </span>
          <span className="font-mono text-[0.75rem] tabular-nums text-ink-faint">
            {served}/{limit}
          </span>
        </div>
        {!revealed && <TimerRing remaining={remaining} total={total} />}
      </div>

      {/* The cold open says what it is, every question, because a student
          getting them wrong needs to know that is the expected outcome and
          not a verdict on them. */}
      {stage === 0 && (
        <p className="font-sans text-[0.8125rem] leading-[1.55] text-ink-soft">
          Guess. You have not studied this yet, and missing is the point: guessing first makes the
          right answer stick harder when it arrives. Nothing here is scored.
        </p>
      )}

      <h2 className="deal-in max-w-[34ch] text-balance font-read text-[clamp(1.375rem,1.1rem+1.3vw,1.875rem)] font-normal leading-[1.2] tracking-[-0.015em] text-ink">
        {question.format === "blank" ? "Fill in what is missing." : question.prompt}
      </h2>

      <div className="relative">
        {result?.correct && result.points > 0 && (
          <PointsFly amount={result.points} best={result.record} />
        )}

        {(question.format === "recognition" || question.format === "choice") && (
          <ChoiceGrid
            question={question}
            chosen={chosen}
            revealed={revealed}
            onPick={(i) => {
              setChosen(i);
              settle(i);
            }}
          />
        )}

        {question.format === "blank" && (
          <BlankField
            question={question}
            value={typed}
            revealed={revealed}
            correct={result?.correct ?? false}
            onChange={setTyped}
            onSubmit={() => settle(typed)}
          />
        )}

        {question.format === "assemble" && (
          <ChipBoard
            question={question}
            built={built}
            revealed={revealed}
            correct={result?.correct ?? false}
            onBuild={setBuilt}
            onSubmit={() => settle(built)}
          />
        )}
      </div>

      {result && (
        <Verdict
          correct={result.correct}
          timedOut={remaining <= 0 && !result.correct && chosen === null && !typed && built.length === 0}
          answer={question.answer}
          because={question.because}
          citation={question.citation}
          onNext={() => {
            if (advanceTimer.current) clearTimeout(advanceTimer.current);
            onAdvance();
          }}
        />
      )}

      {/* A live streak line under the question, so the run is visible where
          the eye already is rather than only up in the header. */}
      {!revealed && streak >= 2 && stage !== 0 && (
        <p
          style={{ fontVariationSettings: '"wdth" 88' }}
          className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-accent"
        >
          {streak} in a row. Next one is worth &times;{comboMultiplier(streak + 1)}.
        </p>
      )}
    </section>
  );
}
