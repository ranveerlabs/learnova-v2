"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isBusy, postJSON } from "../client";
import {
  buildReveal,
  currentStreak,
  isCorrect,
  nextDifficulty,
  pickQuestion,

  beatsBest,
  rankForProduction,
} from "./engine";
import { setMusic } from "../music";

import { newSeed } from "./presentations/registry";
import { bestFor, openConcepts, recordFor, rememberRun, standingsFor } from "./record";
import type { Standing } from "./engine";
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

export type Phase =
  | "entry"
  | "opening"
  | "waiting"
  | "playing"
  | "interval"
  | "round4"
  | "reveal";

export type RunRecord = {
  rating: number;
  runTime: number;
  openCorrect: number;
  openAnswered: number;
  demonstrated: number;
  productions: number;
};

export type Best = {
  rating: number;
} | null;

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

  const [floors, setFloors] = useState<Partial<Record<Round, Difficulty>>>({});

  const [dropped, setDropped] = useState<Partial<Record<0 | Round, number>>>({});

  const [sampled, setSampled] = useState<{ kept: number; total: number } | null>(null);

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

  const [busyRounds, setBusyRounds] = useState<Round[]>([]);

  const [plainOnly, setPlainOnly] = useState(false);
  const [seed, setSeed] = useState(() => newSeed());

  const runs = useRef<RunRecord[]>([]);
  const [best, setBest] = useState<Best>(null);

  const [previously, setPreviously] = useState<Record<string, Standing>>({});
  const stillOpen = useRef<string[]>([]);

  const recorded = useRef(false);

  const seenByTopic = useRef<Map<string, Asked[]>>(new Map());
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

  const questionShownAt = useRef<number>(0);
  const stageStartedAt = useRef<number>(0);

  const streak = currentStreak(answers.filter((a) => a.stage >= 1));

  const runElapsed = useCallback(() => {
    const banked = splits.reduce((sum, s) => sum + s.ms, 0);
    if (phase !== "playing" && phase !== "round4") return banked;
    return banked + (performance.now() - stageStartedAt.current);
  }, [phase, splits]);

  const fetchBank = useCallback(
    async (round: Round, forTopic: string, forNotes: string, forConcepts: string[]) => {
      if (round === 4) return;
      if (requested.current.has(round)) return;
      requested.current.add(round);

      try {
        const { questions, exhausted, dropped: lost } = await postJSON<{
          questions: Question[];
          exhausted?: boolean;
          dropped?: number;
        }>("/api/round", {
          stage: "round",
          round,
          topic: forTopic,
          notes: forNotes,
          concepts: forConcepts,
          asked: seenFor(forTopic),
        });

        remember(forTopic, questions);
        if (exhausted) setFloors((prev) => ({ ...prev, [round]: "medium" }));
        if (lost) setDropped((prev) => ({ ...prev, [round]: lost }));
        setBanks((prev) => ({ ...prev, [round]: questions }));
      } catch (err) {
        console.error(`Round ${round} bank failed:`, err);
        if (isBusy(err)) setBusyRounds((prev) => (prev.includes(round) ? prev : [...prev, round]));
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

      stillOpen.current = openConcepts(recordFor(nextTopic));
      setPreviously(standingsFor(nextTopic));
      const target = bestFor(nextTopic);
      setBest(target === null ? null : { rating: target });
      recorded.current = false;

      try {
        const payload = await postJSON<{
          concepts: string[];
          questions: Question[];
          provenance: Provenance;
          dropped?: number;
          sampled?: boolean;
          chunksKept?: number;
          chunksTotal?: number;
        }>("/api/round", {
          stage: "open",
          topic: nextTopic,
          notes: nextNotes,
          asked: seenFor(nextTopic),
        });

        setConcepts(payload.concepts);
        setWarmUp(payload.questions);
        setProvenance(payload.provenance);
        if (payload.dropped) setDropped({ 0: payload.dropped });
        setSampled(
          payload.sampled
            ? { kept: payload.chunksKept ?? 0, total: payload.chunksTotal ?? 0 }
            : null
        );
        remember(nextTopic, payload.questions);

        void fetchBank(1, nextTopic, nextNotes, payload.concepts);

        const now = performance.now();
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

  const answer = useCallback(
    (given: string | number | string[], timedOut = false) => {
      const question = current;
      if (!question) return null;

      const ms = performance.now() - questionShownAt.current;
      const right = !timedOut && isCorrect(question, given);

      const counts = stage >= 1;
      const earlier = answers.filter((a) => a.stage >= 1);
      const newStreak = counts && right ? currentStreak(earlier) + 1 : 0;
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
      };

      setAnswers((prev) => [...prev, entry]);
      return { correct: right, streak: newStreak, record, question };
    },
    [answers, current, stage]
  );

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
    }

    const now = performance.now();
    setSplits((prev) => [...prev, { stage, ms: now - stageStartedAt.current }]);
    setCurrent(null);
    setPhase("interval");
  }, [answers, asked, banks, difficulty, floors, servedThisStage, stage, warmUp]);

  const openRound4 = useCallback(() => {
    setStage(4);
    setProductionIndex(0);
    stageStartedAt.current = performance.now();
    setPhase("round4");
  }, []);

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

  const continueOn = useCallback(() => {
    const next = (stage + 1) as Round;
    if (next === 4) {
      openRound4();
      return;
    }
    beginRound(next);
  }, [beginRound, openRound4, stage]);

  useEffect(() => {
    if (phase !== "waiting" || pendingRound === null) return;
    if (banks[pendingRound] !== undefined) beginRound(pendingRound);
  }, [banks, beginRound, pendingRound, phase]);

  const productionOrder = rankForProduction(answers, stillOpen.current)
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
    setSplits((prev) =>
      prev.some((s) => s.stage === 4)
        ? prev
        : [...prev, { stage: 4, ms: performance.now() - stageStartedAt.current }]
    );
    setPhase("reveal");
  }, []);

  const nextPlayable: Round = (() => {
    let target = (stage + 1) as Round;
    while (target <= 3 && banks[target]?.length === 0) {
      target = (target + 1) as Round;
    }
    return target > 3 ? 4 : target;
  })();

  const reveal = useCallback(
    () => buildReveal(answers, productions, splits),
    [answers, productions, splits]
  );

  useEffect(() => {
    if (phase !== "reveal" || recorded.current || !topic) return;
    recorded.current = true;

    const data = buildReveal(answers, productions, splits);
    rememberRun(topic, data);
  }, [answers, phase, productions, splits, topic]);

  const bank = useCallback(() => {
    const data = buildReveal(answers, productions, splits);
    if (data.splits.length === 0) return;

    const record: RunRecord = {
      rating: data.rating.score,
      runTime: data.runTime,
      openCorrect: data.open?.correct ?? 0,
      openAnswered: data.open?.answered ?? 0,
      demonstrated: data.productions.filter((p) => p.outcome === "solid").length,
      productions: data.productions.length,
    };
    runs.current = [...runs.current, record];
  }, [answers, productions, splits]);

  const wipe = useCallback(() => {
    setConcepts([]);
    setWarmUp([]);
    setBanks({});
    setFloors({});
    setDropped({});
    setSampled(null);
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
    setBusyRounds([]);
    setBest(null);
    setPreviously({});
    stillOpen.current = [];
    recorded.current = false;
    setSeed(newSeed());
  }, []);

  const again = useCallback(() => {
    const sameTopic = topic;
    const sameNotes = notes;
    bank();
    wipe();
    void start(sameTopic, sameNotes);
  }, [bank, notes, start, topic, wipe]);

  const restart = useCallback(() => {
    bank();
    wipe();
    setPhase("entry");
    setTopic("");
    setNotes("");
  }, [bank, wipe]);

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

    error,
    busyRounds,
    dropped,
    droppedTotal: Object.values(dropped).reduce((sum, n) => sum + (n ?? 0), 0),
    sampled,
    nextPlayable,
    best,
    previously,
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
    start,
    answer,
    advance,
    continueOn,
    recordProduction,
    nextProduction,
    finish,
    again,
    restart,
    reveal,
    runElapsed,
  };
}
