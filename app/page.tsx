"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./round/round.css";
import { Entry } from "./round/entry";
import { formatClock, summarizeRound } from "./round/engine";
import { Interval } from "./round/interval";
import { Reveal } from "./round/reveal";
import { useRoundSession } from "./round/session";
import { TeachBack } from "./round/teachback";
import { PresentationBoundary } from "./round/presentations/boundary";
import { pickPresentation } from "./round/presentations/registry";
import {
  Generating,
  LadderRail,
  MusicToggle,
  PlainEscape,
  ProvenanceBadge,
  RoundHud,
  RunClock,
  SoundToggle,
  Verdict,
  WarmUpLines,
} from "./round/ui";
import {
  ADVANCE_MS,
  comboMultiplier,
  MAX_COMBO,
  type Question,
  QUESTION_SECONDS,
  type Round,
} from "./round/types";
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
      {/* During a question this holds nothing but the audio controls. The
          wordmark, the rung, where the questions came from and the run clock
          are all true and all worth showing, and none of them is worth showing
          to somebody in the middle of trying to remember something. They come
          back the moment the round does not have them.

          The audio controls are the exception, and they are here on every
          screen for a reason worth writing down: they were briefly in the
          status strip and nowhere else, which meant they existed only during a
          live question. Music is off by default, so a student on the entry
          screen had silence and no way to turn it on, and no control anywhere
          to tell them one existed. A control that only appears once you no
          longer have time to look for it is not a control. */}
      <header
        className={`sticky top-0 z-30 bg-ground/85 backdrop-blur-md ${
          inPlay ? "" : "border-b border-line"
        }`}
      >
        <div
          className={`${SHELL} flex flex-wrap items-center justify-between gap-x-6 gap-y-3 ${
            inPlay ? "py-1" : "py-3.5"
          }`}
        >
          <div className="flex items-center gap-5">
            {!inPlay && <Wordmark />}
            {showRun && !inPlay && <LadderRail stage={s.stage} />}
          </div>

          <div className="flex items-center gap-3">
            {showRun && !inPlay && s.phase !== "opening" && (
              <ProvenanceBadge provenance={s.provenance} />
            )}
            {showRun && !inPlay && <Ghost best={s.best} elapsed={s.runElapsed} live={false} />}
            {/* During a question these are in the status strip instead, beside
                the timer, so the round keeps its one uncluttered row. */}
            {!inPlay && (
              <>
                <MusicToggle on={s.music} onToggle={() => s.setMusicOn(!s.music)} />
                <SoundToggle on={s.sound} onToggle={() => s.setSound(!s.sound)} />
              </>
            )}
          </div>
        </div>
      </header>

      <div className={`${SHELL} flex-1 py-8 lg:py-10`}>
        <main className="min-w-0">
          {s.phase === "entry" && <Entry onStart={s.start} error={s.error} />}

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
              sound={s.sound}
              music={s.music}
              onSound={() => s.setSound(!s.sound)}
              onMusic={() => s.setMusicOn(!s.music)}
              streak={s.streak}
              seed={s.seed}
              plainOnly={s.plainOnly}
              onPlainOnly={() => s.setPlainOnly(true)}
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
              points={s.points}
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
                sound={s.sound}
                onDone={s.recordProduction}
                onNext={s.nextProduction}
                onStop={s.finish}
              />
            ) : (
              <NothingToProduce onFinish={s.finish} />
            ))}

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
   race, because a ghost with nothing behind it is just a clock.

   It no longer ticks during a question. A number counting up against a
   personal best, in the corner of the eye, while trying to retrieve something,
   is the exact shape of the chrome this round was cleared of. The run is still
   timed to the millisecond and the comparison is still real; it is shown
   between rounds and at the end. */

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
      <span
        title="Against your last completed run in this tab"
        className={`run-clock rounded-[3px] px-1.5 py-0.5 font-mono text-[0.75rem] font-semibold tabular-nums ${
          ahead ? "bg-solid-tint text-solid-ink" : "bg-sunk text-ink-faint"
        }`}
      >
        {ahead ? "-" : "+"}
        {formatClock(Math.abs(delta))}
      </span>
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
    <section className="mx-auto mt-2 flex w-full max-w-[58rem] flex-col gap-3 rounded-[3px] border border-line bg-page p-5">
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
      <p
        className="font-sans text-[0.75rem] leading-[1.5] text-ink-faint"
        title="Run history lives in memory only, because there are no accounts yet to keep it in."
      >
        {runs} run{runs === 1 ? "" : "s"} this tab.
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
   The question, the options, the timer, and the combo multiplier when it is
   above one. Nothing else is on this screen, and everything that used to be is
   accounted for in the note at the top of ui.tsx. */

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
  sound,
  music,
  onSound,
  onMusic,
  streak,
  seed,
  plainOnly,
  onPlainOnly,
  onAnswer,
  onAdvance,
}: {
  question: Question;
  stage: 0 | Round;
  sound: boolean;
  music: boolean;
  onSound: () => void;
  onMusic: () => void;
  streak: number;
  seed: number;
  plainOnly: boolean;
  onPlainOnly: () => void;
  onAnswer: (given: string | number | string[], timedOut?: boolean) => Result | null;
  onAdvance: () => void;
}) {
  const [chosen, setChosen] = useState<number | null>(null);
  const [typed, setTyped] = useState("");
  const [built, setBuilt] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [ranOut, setRanOut] = useState(false);
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
      setRanOut(timedOut);
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

  /* Enter or space advances once an answer is showing, which is what makes a
     fast run possible without reaching for the mouse. */
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

  return (
    <section className="relative mx-auto flex min-h-[70vh] w-full max-w-[46rem] flex-col justify-center gap-6 py-4">
      {/* First in the tab order, invisible until focused. See PlainEscape. */}
      {!plainOnly && <PlainEscape onChoose={onPlainOnly} />}

      <div className="flex items-start justify-between gap-6">
        {stage === 0 ? <WarmUpLines /> : <span />}
        <RoundHud
          streak={streak}
          remaining={remaining}
          total={total}
          scoring={stage !== 0}
          music={music}
          sound={sound}
          onMusic={onMusic}
          onSound={onSound}
        />
      </div>

      {/* Given the full column rather than a 34-character measure: the
          generation prompt caps questions at 12 words, and the point of
          capping the words was so the question could fit a line without the
          type being shrunk to make it. */}
      {question.format !== "blank" && (
        <h2 className="deal-in text-balance font-read text-[clamp(1.375rem,1.1rem+1.3vw,1.875rem)] font-normal leading-[1.2] tracking-[-0.015em] text-ink">
          {question.prompt}
        </h2>
      )}

      {/* The one place the presentation layer touches the round. Everything
          below this point is the same whichever one is drawn: the answer comes
          back in the shape checking already understands, and a presentation
          has no way to reach the ladder, the timer or the grade. */}
      <PresentationBoundary {...props} resetKey={question.id}>
        <Drawn {...props} />
      </PresentationBoundary>

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
    </section>
  );
}
