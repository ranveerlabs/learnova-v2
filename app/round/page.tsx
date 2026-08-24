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

const SHELL = "mx-auto w-full max-w-[96rem] px-4 sm:px-6 lg:px-10 xl:px-14";

export default function Home() {
  const s = useRoundSession();

  const inPlay = s.phase === "playing";
  const showRun = s.phase !== "entry";
  const loading = s.phase === "opening" || s.phase === "waiting";
  const clockLive = showRun && s.phase !== "reveal" && !loading;

  const [remaining, setRemaining] = useState(QUESTION_SECONDS * 1000);

  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panel.current?.scrollTo({ top: 0 });
    const frame = requestAnimationFrame(() => panel.current?.scrollTo({ top: 0 }));
    return () => cancelAnimationFrame(frame);
  }, [s.phase]);

  const servedThisRound = s.answers.filter((a) => a.stage === s.stage).length;
  const shortened =
    (s.dropped[s.stage] ?? 0) > 0 &&
    servedThisRound < (s.stage === 0 ? WARM_UP_COUNT : QUESTIONS_PER_ROUND);

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
            {showRun && <RunClock elapsed={s.runElapsed} live={clockLive} />}
            <AudioControls />
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
          {s.busyRounds.length > 0 && !inPlay && (
            <div className="mx-auto mb-6 w-full max-w-[46rem]">
              <SkippedRounds rounds={s.busyRounds} />
            </div>
          )}

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
  onRemaining: (ms: number) => void;
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
    <section className="relative mx-auto flex h-full min-h-0 w-full max-w-[64rem] flex-col gap-[2vh]">
      {!plainOnly && <PlainEscape onChoose={onPlainOnly} />}

      <div className="flex min-h-0 flex-1 flex-col justify-center gap-[3vh]">
        {question.format !== "blank" && (
          <h2 className="deal-in shrink-0 text-balance font-read text-[clamp(1.375rem,0.9rem+2.1vw+0.9vh,3rem)] font-medium leading-[1.12] tracking-[-0.02em] text-ink">
            {question.prompt}
          </h2>
        )}

        <PresentationBoundary {...props} resetKey={question.id}>
          <Drawn {...props} />
        </PresentationBoundary>
      </div>

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
