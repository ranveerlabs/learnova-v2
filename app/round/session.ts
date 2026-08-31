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

export type Phase = "entry" | "opening" | "waiting" | "playing" | "interval" | "round4" | "reveal";

export type RunRecord = {
  rating: number;
  runTime: number;
  openCorrect: number;
  openAnswered: number;
  demonstrated: number;
  productions: number;
};

export type Best = { rating: number } | null;

type Asked = { concept: string; answer: string; prompt: string; format: Format };

const MAX_PRODUCTIONS = 3;

// what the route needs to know we already asked. not the whole question
const lite = (q: Question): Asked => ({
  concept: q.concept,
  answer: q.answer,
  prompt: q.prompt,
  format: q.format,
});

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
    (forTopic: string, qs: Question[]) => {
      const k = key(forTopic);
      const held = seenByTopic.current.get(k) ?? [];
      seenByTopic.current.set(k, [...held, ...qs.map(lite)]);
    },
    [key]
  );

  const seenFor = useCallback(
    (forTopic: string): Asked[] => seenByTopic.current.get(key(forTopic)) ?? [],
    [key]
  );

  const shownAt = useRef<number>(0);
  const stageAt = useRef<number>(0);

  const streak = currentStreak(answers.filter((a) => a.stage >= 1));

  const runElapsed = useCallback(() => {
    const banked = splits.reduce((n, s) => n + s.ms, 0);
    if (phase !== "playing" && phase !== "round4") return banked;
    return banked + (performance.now() - stageAt.current);
  }, [phase, splits]);

  // pulled in the background, one round ahead, so nobody waits on a spinner mid run
  const fetchBank = useCallback(
    async (round: Round, t: string, n: string, cs: string[]) => {
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
          topic: t,
          notes: n,
          concepts: cs,
          asked: seenFor(t),
        });

        remember(t, questions);
        if (exhausted) setFloors((p) => ({ ...p, [round]: "medium" }));
        if (lost) setDropped((p) => ({ ...p, [round]: lost }));
        setBanks((p) => ({ ...p, [round]: questions }));
      } catch (e) {
        console.error(`bank:r${round} rip`, e);
        if (isBusy(e)) setBusyRounds((p) => (p.includes(round) ? p : [...p, round]));
        // empty bank, not undefined. undefined means "still coming"
        setBanks((p) => ({ ...p, [round]: [] }));
      }
    },
    [remember, seenFor]
  );

  const start = useCallback(
    async (t: string, n: string) => {
      setPhase("opening");
      setError(null);
      setTopic(t);
      setNotes(n);

      stillOpen.current = openConcepts(recordFor(t));
      setPreviously(standingsFor(t));
      const b = bestFor(t);
      setBest(b === null ? null : { rating: b });
      recorded.current = false;

      try {
        const p = await postJSON<{
          concepts: string[];
          questions: Question[];
          provenance: Provenance;
          dropped?: number;
          sampled?: boolean;
          chunksKept?: number;
          chunksTotal?: number;
        }>("/api/round", { stage: "open", topic: t, notes: n, asked: seenFor(t) });

        setConcepts(p.concepts);
        setWarmUp(p.questions);
        setProvenance(p.provenance);
        if (p.dropped) setDropped({ 0: p.dropped });
        setSampled(p.sampled ? { kept: p.chunksKept ?? 0, total: p.chunksTotal ?? 0 } : null);
        remember(t, p.questions);

        void fetchBank(1, t, n, p.concepts);

        const now = performance.now();
        stageAt.current = now;
        shownAt.current = now;

        setStage(0);
        setServedThisStage(1);
        setAsked(new Set([p.questions[0].id]));
        setCurrent(p.questions[0]);
        setPhase("playing");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not start that one. Try again.");
        setPhase("entry");
      }
    },
    [fetchBank, remember, seenFor]
  );

  const answer = useCallback(
    (given: string | number | string[], timedOut = false) => {
      const q = current;
      if (!q) return null;

      const ms = performance.now() - shownAt.current;
      const right = !timedOut && isCorrect(q, given);

      // the warm up is before studying, so it doesn't count toward streaks or records
      const counts = stage >= 1;
      const before = answers.filter((a) => a.stage >= 1);
      const run = counts && right ? currentStreak(before) + 1 : 0;
      const pb = counts && beatsBest(before, ms, right);

      const row: Answer = {
        questionId: q.id,
        concept: q.concept,
        difficulty: q.difficulty,
        format: q.format,
        stage,
        correct: right,
        ms,
        given: Array.isArray(given) ? given.join(" ") : String(given),
        timedOut: timedOut || undefined,
      };

      setAnswers((prev) => [...prev, row]);
      return { correct: right, streak: run, record: pb, question: q };
    },
    [answers, current, stage]
  );

  const advance = useCallback(() => {
    const limit = stage === 0 ? WARM_UP_COUNT : QUESTIONS_PER_ROUND;
    const pool = stage === 0 ? warmUp : banks[stage as Round] ?? [];

    const mine = answers.filter((a) => a.stage === stage);
    const spent = servedThisStage >= limit;

    if (!spent) {
      const floor = stage === 0 ? "easy" : floors[stage as Round] ?? "easy";
      const want = stage === 0 ? difficulty : nextDifficulty(difficulty, mine, floor);
      const next =
        stage === 0 ? pool.find((q) => !asked.has(q.id)) ?? null : pickQuestion(pool, want, asked);

      if (next) {
        setDifficulty(want);
        setAsked((prev) => new Set(prev).add(next.id));
        setServedThisStage((n) => n + 1);
        setCurrent(next);
        shownAt.current = performance.now();
        return;
      }
    }

    setSplits((prev) => [...prev, { stage, ms: performance.now() - stageAt.current }]);
    setCurrent(null);
    setPhase("interval");
  }, [answers, asked, banks, difficulty, floors, servedThisStage, stage, warmUp]);

  const openRound4 = useCallback(() => {
    setStage(4);
    setProductionIndex(0);
    stageAt.current = performance.now();
    setPhase("round4");
  }, []);

  const beginRound = useCallback(
    (from: Round) => {
      let r = from;

      // skip past any round whose bank came back empty
      while (r <= 3) {
        const pool = banks[r];
        if (pool === undefined) {
          void fetchBank(r, topic, notes, concepts);
          setPendingRound(r);
          setPhase("waiting");
          return;
        }
        if (pool.length > 0) break;
        r = (r + 1) as Round;
      }

      if (r > 3) return openRound4();

      if (r < 3) void fetchBank((r + 1) as Round, topic, notes, concepts);

      const first = pickQuestion(banks[r] ?? [], "medium", new Set());
      if (!first) return openRound4();

      setPendingRound(null);
      setStage(r);
      setDifficulty("medium");
      setAsked(new Set([first.id]));
      setServedThisStage(1);
      setCurrent(first);
      stageAt.current = performance.now();
      shownAt.current = performance.now();
      setPhase("playing");
    },
    [banks, concepts, fetchBank, notes, openRound4, topic]
  );

  const continueOn = useCallback(() => {
    const next = (stage + 1) as Round;
    if (next === 4) return openRound4();
    beginRound(next);
  }, [beginRound, openRound4, stage]);

  // bank landed while we were sat on the waiting screen
  useEffect(() => {
    if (phase !== "waiting" || pendingRound === null) return;
    if (banks[pendingRound] !== undefined) beginRound(pendingRound);
  }, [banks, beginRound, pendingRound, phase]);

  const productionOrder = rankForProduction(answers, stillOpen.current)
    .map((r) => r.concept)
    .slice(0, MAX_PRODUCTIONS);

  const recordProduction = useCallback((p: Production) => {
    setProductions((prev) => [...prev.filter((x) => x.concept !== p.concept), p]);
  }, []);

  const nextProduction = useCallback(() => setProductionIndex((i) => i + 1), []);

  const finish = useCallback(() => {
    setSplits((prev) =>
      prev.some((s) => s.stage === 4)
        ? prev
        : [...prev, { stage: 4, ms: performance.now() - stageAt.current }]
    );
    setPhase("reveal");
  }, []);

  const nextPlayable: Round = (() => {
    let r = (stage + 1) as Round;
    while (r <= 3 && banks[r]?.length === 0) r = (r + 1) as Round;
    return r > 3 ? 4 : r;
  })();

  const reveal = useCallback(
    () => buildReveal(answers, productions, splits),
    [answers, productions, splits]
  );

  useEffect(() => {
    if (phase !== "reveal" || recorded.current || !topic) return;
    recorded.current = true;
    rememberRun(topic, buildReveal(answers, productions, splits));
  }, [answers, phase, productions, splits, topic]);

  const bank = useCallback(() => {
    const d = buildReveal(answers, productions, splits);
    if (!d.splits.length) return;

    runs.current = [
      ...runs.current,
      {
        rating: d.rating.score,
        runTime: d.runTime,
        openCorrect: d.open?.correct ?? 0,
        openAnswered: d.open?.answered ?? 0,
        demonstrated: d.productions.filter((p) => p.outcome === "solid").length,
        productions: d.productions.length,
      },
    ];
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
    const t = topic;
    const n = notes;
    bank();
    wipe();
    void start(t, n);
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
    droppedTotal: Object.values(dropped).reduce((n, x) => n + (x ?? 0), 0),
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
