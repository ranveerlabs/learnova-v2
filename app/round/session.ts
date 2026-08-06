"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { postJSON } from "../client";
import {
  buildReveal,
  currentStreak,
  isCorrect,
  nextDifficulty,
  pickQuestion,
  pointsFor,
  beatsBest,
  rankForProduction,
} from "./engine";
import { setMusic, stopMusic } from "./music";
import { newSeed } from "./presentations/registry";
import {
  type Answer,
  type Difficulty,
  type Format,
  type Production,
  type Provenance,
  type Question,
  QUESTIONS_PER_ROUND,
  type Round,
  type Split,
  WARM_UP_COUNT,
} from "./types";

/* The session, start to finish.

   The decisions all live in engine.ts, where they are pure and tested. What
   is left here is orchestration: when to call the model, what to hold in
   memory, and when to move. That split is deliberate, because orchestration
   is the part that is hard to test and easy to read, and the decisions are
   the part that is the opposite.

   Nothing is written to disk, to storage, or to a server. Closing the tab
   ends the session, which is the honest state of a product with no accounts
   in it yet. */

export type Phase =
  | "entry"
  | "opening"
  /** A round the student has reached before the model finished writing it.
      Always transient: it resolves itself the moment the bank lands. */
  | "waiting"
  | "playing"
  | "interval"
  | "round4"
  | "reveal";

/** One completed run, kept in memory so the next run has something to beat.

    This is the whole of the "persistence" here, and it is not persistence: it
    lives in a React ref for as long as the tab is open and dies with it. No
    storage, no account, nothing leaves the page. It exists because a score
    with nothing to measure it against is just a number, and a student who
    cannot see that they went faster this time has no reason to go again. */
export type RunRecord = {
  points: number;
  runTime: number;
  openCorrect: number;
  openAnswered: number;
  demonstrated: number;
  productions: number;
};

export type Best = {
  points: number;
  runTime: number;
} | null;

/** A question as the repeat check needs it. Four fields, because the rest of a
    Question is presentation and shipping it back to the server would be
    bandwidth spent on nothing. */
type Asked = { concept: string; answer: string; prompt: string; format: Format };

const MAX_PRODUCTIONS = 3;

function lite(q: Question): Asked {
  return { concept: q.concept, answer: q.answer, prompt: q.prompt, format: q.format };
}

export function useRoundSession() {
  const [phase, setPhase] = useState<Phase>("entry");
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [provenance, setProvenance] = useState<Provenance>("generated");
  const [concepts, setConcepts] = useState<string[]>([]);

  const [warmUp, setWarmUp] = useState<Question[]>([]);
  const [banks, setBanks] = useState<Partial<Record<Round, Question[]>>>({});

  /** Rounds where the generator ran out of genuinely new questions. The ladder
      will not ease below medium in one of these: there is nothing down there
      left to serve that the student has not already answered. */
  const [floors, setFloors] = useState<Partial<Record<Round, Difficulty>>>({});

  const [stage, setStage] = useState<0 | Round>(0);
  const [current, setCurrent] = useState<Question | null>(null);
  const [asked, setAsked] = useState<Set<string>>(new Set());
  const [servedThisStage, setServedThisStage] = useState(0);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");

  const [answers, setAnswers] = useState<Answer[]>([]);
  const [productions, setProductions] = useState<Production[]>([]);
  const [splits, setSplits] = useState<Split[]>([]);
  const [productionIndex, setProductionIndex] = useState(0);
  const [pendingRound, setPendingRound] = useState<Round | null>(null);

  const [error, setError] = useState<string | null>(null);

  /* Audio, and both halves of it are the student's to decide.

     Music starts off. Not "off until a gesture arrives", genuinely off: the
     only thing that ever turns it on is the toggle, so there is no path
     through this file that plays anything at somebody who has not asked. A
     study tool that starts playing music at whoever opens it is unusable in a
     library or a classroom, which is most of the places it would be opened.

     The answer tones start on, because they are feedback rather than
     atmosphere and they were already on. That difference in default is why
     these are two settings and not one: a single control cannot start one of
     them on and the other off.

     Both survive a restart. Somebody who turned the music on for one run
     wants it on for the next, and being asked again every time is its own
     small annoyance. */
  const [sound, setSound] = useState(true);
  const [music, setMusicOn] = useState(false);

  useEffect(() => {
    setMusic(music);
  }, [music]);

  /* A track must not outlive the page that started it. */
  useEffect(() => stopMusic, []);

  /* Presentations are how rounds look, so there is no setting for them. This
     is the one way to the plain rendering, and it is reached through the skip
     link in the question area rather than through any menu. It lasts the
     session and survives a restart, because someone who needed it once needs
     it on the next run too. */
  const [plainOnly, setPlainOnly] = useState(false);
  const [seed, setSeed] = useState(() => newSeed());

  /* Run history for the tab. A ref rather than state: nothing renders off it
     directly except through `best`, and it must survive a restart, which
     resets everything else. */
  const runs = useRef<RunRecord[]>([]);
  const [best, setBest] = useState<Best>(null);

  /* Every question this tab has generated, by topic, so a second run on the
     same topic is not the first one again. In memory, like everything else
     here: it dies with the tab and is never written anywhere. */
  const seenByTopic = useRef<Map<string, Asked[]>>(new Map());
  /* Rounds already requested, so a bank cannot be fetched twice. State would
     be a frame behind and let a double fetch through. */
  const requested = useRef<Set<Round>>(new Set());

  const key = useCallback((t: string) => t.trim().toLowerCase(), []);

  const remember = useCallback(
    (forTopic: string, questions: Question[]) => {
      const k = key(forTopic);
      const held = seenByTopic.current.get(k) ?? [];
      seenByTopic.current.set(k, [...held, ...questions.map(lite)]);
    },
    [key]
  );

  const seenFor = useCallback(
    (forTopic: string): Asked[] => seenByTopic.current.get(key(forTopic)) ?? [],
    [key]
  );

  /* Clocks. `performance.now()` throughout, because it is monotonic: a
     student whose machine adjusts its wall clock mid-session should not get a
     negative split. */
  const questionShownAt = useRef<number>(0);
  const stageStartedAt = useRef<number>(0);
  const runStartedAt = useRef<number | null>(null);

  /* The warm up is outside the game entirely. It is taken before any studying,
     it is explicitly not scored, and the screen says so in two words while the
     student is answering it. Letting points or a streak accumulate there would
     contradict that, and would also hand Round 1 a combo the student earned by
     guessing. Scoring starts at Round 1. */
  const scoring = answers.filter((a) => a.stage >= 1);
  const streak = currentStreak(scoring);
  const points = scoring.reduce((sum, a) => sum + (a.points ?? 0), 0);

  /** Elapsed run time so far, for the ghost comparison between rounds. */
  const runElapsed = useCallback(
    () => (runStartedAt.current === null ? 0 : performance.now() - runStartedAt.current),
    []
  );

  /* ── Generation ───────────────────────────────────────────────────────
     The warm up is the only call ever waited on. Every round bank is fetched
     while the student is busy with the round before it, so the latency lands
     in time they were already spending. */

  const fetchBank = useCallback(
    async (round: Round, forTopic: string, forNotes: string, forConcepts: string[]) => {
      if (round === 4) return;
      if (requested.current.has(round)) return;
      requested.current.add(round);

      try {
        const { questions, exhausted } = await postJSON<{
          questions: Question[];
          exhausted?: boolean;
        }>("/api/round", {
          stage: "round",
          round,
          topic: forTopic,
          notes: forNotes,
          concepts: forConcepts,
          /* Everything already asked, so the model writes something new rather
             than the same question in different words, and so the server can
             drop what it writes anyway. */
          asked: seenFor(forTopic),
        });

        remember(forTopic, questions);
        if (exhausted) setFloors((prev) => ({ ...prev, [round]: "medium" }));
        setBanks((prev) => ({ ...prev, [round]: questions }));
      } catch (err) {
        /* A failed bank is not fatal to the session: the rounds before it
           still happened and still count. It surfaces when the student
           reaches that round, not as an interruption to the one they are in. */
        console.error(`Round ${round} bank failed:`, err);
        setBanks((prev) => ({ ...prev, [round]: [] }));
      }
    },
    [remember, seenFor]
  );

  const start = useCallback(
    async (nextTopic: string, nextNotes: string) => {
      setPhase("opening");
      setError(null);
      setTopic(nextTopic);
      setNotes(nextNotes);

      try {
        const payload = await postJSON<{
          concepts: string[];
          questions: Question[];
          provenance: Provenance;
        }>("/api/round", {
          stage: "open",
          topic: nextTopic,
          notes: nextNotes,
          asked: seenFor(nextTopic),
        });

        setConcepts(payload.concepts);
        setWarmUp(payload.questions);
        setProvenance(payload.provenance);
        remember(nextTopic, payload.questions);

        /* Round 1 starts generating the instant the warm up lands, so it is
           ready long before it is needed. */
        void fetchBank(1, nextTopic, nextNotes, payload.concepts);

        const now = performance.now();
        runStartedAt.current = now;
        stageStartedAt.current = now;
        questionShownAt.current = now;

        setStage(0);
        setServedThisStage(1);
        setAsked(new Set([payload.questions[0].id]));
        setCurrent(payload.questions[0]);
        setPhase("playing");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setPhase("entry");
      }
    },
    [fetchBank, remember, seenFor]
  );

  /* ── Answering ────────────────────────────────────────────────────────── */

  /** Record an answer and return what just happened, so the interface can
      react in the same frame rather than a render later. */
  const answer = useCallback(
    (given: string | number | string[], timedOut = false) => {
      const question = current;
      if (!question) return null;

      const ms = performance.now() - questionShownAt.current;
      const right = !timedOut && isCorrect(question, given);

      /* Nothing in the game layer moves during the warm up. */
      const counts = stage >= 1;
      const earlier = answers.filter((a) => a.stage >= 1);
      const newStreak = counts && right ? currentStreak(earlier) + 1 : 0;
      const scored = counts && right ? pointsFor(newStreak) : 0;
      const record = counts && beatsBest(earlier, ms, right);

      const entry: Answer = {
        questionId: question.id,
        concept: question.concept,
        difficulty: question.difficulty,
        format: question.format,
        stage,
        correct: right,
        ms,
        given: Array.isArray(given) ? given.join(" ") : String(given),
        timedOut: timedOut || undefined,
        points: scored || undefined,
      };

      setAnswers((prev) => [...prev, entry]);
      return { correct: right, points: scored, streak: newStreak, record, question };
    },
    [answers, current, stage]
  );

  /** Move to the next question, or end the stage when there is no next one. */
  const advance = useCallback(() => {
    const limit = stage === 0 ? WARM_UP_COUNT : QUESTIONS_PER_ROUND;
    const pool = stage === 0 ? warmUp : (banks[stage as Round] ?? []);

    const roundAnswers = answers.filter((a) => a.stage === stage);
    const done = servedThisStage >= limit;

    if (!done) {
      const floor = stage === 0 ? "easy" : (floors[stage as Round] ?? "easy");
      const wanted = stage === 0 ? difficulty : nextDifficulty(difficulty, roundAnswers, floor);
      const next =
        stage === 0
          ? (pool.find((q) => !asked.has(q.id)) ?? null)
          : pickQuestion(pool, wanted, asked);

      if (next) {
        setDifficulty(wanted);
        setAsked((prev) => new Set(prev).add(next.id));
        setServedThisStage((n) => n + 1);
        setCurrent(next);
        questionShownAt.current = performance.now();
        return;
      }
      /* Nothing left that has not been asked. The round ends here rather than
         serving anything twice, which is the trade this mode makes: a short
         round is honest, a padded one is not. */
    }

    /* Stage over. The split is closed here and nowhere else, so the sum of
       the splits is always exactly the run. */
    const now = performance.now();
    setSplits((prev) => [...prev, { stage, ms: now - stageStartedAt.current }]);
    setCurrent(null);
    setPhase("interval");
  }, [answers, asked, banks, difficulty, floors, servedThisStage, stage, warmUp]);

  const openRound4 = useCallback(() => {
    setStage(4);
    setProductionIndex(0);
    setPhase("round4");
  }, []);

  /** Begin a round, or wait for it if it is not built yet.

      A bank that is still generating and a bank that failed are different
      situations. Undefined means keep waiting; an empty array means that round
      genuinely has nothing and the session moves on to the next one it can
      actually run.

      Walking forward past a failed round used to be able to strand a student
      forever: banks are fetched one round ahead, so skipping Round 1 arrived
      at a Round 2 nobody had asked for, and the waiting screen waited on a
      request that was never going to be made. Anything walked into that has
      not been requested is requested here. */
  const beginRound = useCallback(
    (from: Round) => {
      let target = from;

      while (target <= 3) {
        const pool = banks[target];
        if (pool === undefined) {
          void fetchBank(target, topic, notes, concepts);
          setPendingRound(target);
          setPhase("waiting");
          return;
        }
        if (pool.length > 0) break;
        target = (target + 1) as Round;
      }

      if (target > 3) {
        openRound4();
        return;
      }

      /* Always one round ahead: starting round N is the moment to fetch N+1. */
      if (target < 3) {
        void fetchBank((target + 1) as Round, topic, notes, concepts);
      }

      const first = pickQuestion(banks[target] ?? [], "medium", new Set());
      if (!first) {
        openRound4();
        return;
      }

      setPendingRound(null);
      setStage(target);
      setDifficulty("medium");
      setAsked(new Set([first.id]));
      setServedThisStage(1);
      setCurrent(first);
      stageStartedAt.current = performance.now();
      questionShownAt.current = performance.now();
      setPhase("playing");
    },
    [banks, concepts, fetchBank, notes, openRound4, topic]
  );

  /** Leave the between-rounds screen and begin what comes next. */
  const continueOn = useCallback(() => {
    const next = (stage + 1) as Round;
    if (next === 4) {
      openRound4();
      return;
    }
    beginRound(next);
  }, [beginRound, openRound4, stage]);

  /* A round that was still generating when the student arrived starts the
     moment it lands. The waiting screen is never a dead end. */
  useEffect(() => {
    if (phase !== "waiting" || pendingRound === null) return;
    if (banks[pendingRound] !== undefined) beginRound(pendingRound);
  }, [banks, beginRound, pendingRound, phase]);

  /* ── Round 4 ──────────────────────────────────────────────────────────── */

  /** The concepts to offer, strongest first, capped so the finish line stays
      a finish line rather than an essay exam. */
  const productionOrder = rankForProduction(answers)
    .map((r) => r.concept)
    .slice(0, MAX_PRODUCTIONS);

  const recordProduction = useCallback((production: Production) => {
    setProductions((prev) => {
      const without = prev.filter((p) => p.concept !== production.concept);
      return [...without, production];
    });
  }, []);

  const nextProduction = useCallback(() => {
    setProductionIndex((i) => i + 1);
  }, []);

  const finish = useCallback(() => {
    setPhase("reveal");
  }, []);

  /* ── Ending and going again ───────────────────────────────────────────── */

  const reveal = useCallback(
    () => buildReveal(answers, productions, splits),
    [answers, productions, splits]
  );

  /** Bank this run and reset for another, keeping the run history so the next
      one has a target, and keeping every question already asked so the next
      run on the same topic is a different set of questions. */
  const restart = useCallback(() => {
    const data = buildReveal(answers, productions, splits);
    if (data.splits.length > 0) {
      const record: RunRecord = {
        points: data.points,
        runTime: data.runTime,
        openCorrect: data.open?.correct ?? 0,
        openAnswered: data.open?.answered ?? 0,
        demonstrated: data.productions.filter((p) => p.outcome === "solid").length,
        productions: data.productions.length,
      };
      runs.current = [...runs.current, record];
      setBest({
        points: Math.max(...runs.current.map((r) => r.points)),
        /* Only completed runs count toward a best time. A run abandoned in
           Round 1 is not a fast run. */
        runTime: Math.min(
          ...runs.current.filter((r) => r.productions > 0).map((r) => r.runTime),
          record.productions > 0 ? record.runTime : Infinity
        ),
      });
    }

    setPhase("entry");
    setTopic("");
    setNotes("");
    setConcepts([]);
    setWarmUp([]);
    setBanks({});
    setFloors({});
    requested.current = new Set();
    setStage(0);
    setCurrent(null);
    setAsked(new Set());
    setServedThisStage(0);
    setDifficulty("medium");
    setAnswers([]);
    setProductions([]);
    setSplits([]);
    setProductionIndex(0);
    setPendingRound(null);
    setError(null);
    /* A new seed for the next run, so going again does not draw the same
       presentations in the same order. */
    setSeed(newSeed());
    runStartedAt.current = null;
  }, [answers, productions, splits]);

  return {
    phase,
    topic,
    notes,
    provenance,
    concepts,
    stage,
    current,
    answers,
    productions,
    splits,
    difficulty,
    streak,
    points,
    error,
    sound,
    music,
    best,
    runCount: runs.current.length,
    banks,
    servedThisStage,
    productionOrder,
    productionIndex,
    pendingRound,
    stageLimit: stage === 0 ? WARM_UP_COUNT : QUESTIONS_PER_ROUND,
    plainOnly,
    seed,
    setPlainOnly,
    setSound,
    setMusicOn,
    start,
    answer,
    advance,
    continueOn,
    recordProduction,
    nextProduction,
    finish,
    restart,
    reveal,
    runElapsed,
  };
}
