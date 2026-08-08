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
    storage, no account, nothing leaves the page. It exists because a rating
    with nothing to measure it against is just a number, and a student who
    cannot see that they did better this time has no reason to go again.

    What is compared across runs is the rating, not the run time. Beating your
    own clock rewards answering faster, which on a topic you have already seen
    mostly means answering more carelessly; beating your own rating rewards
    getting more of it right. */
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

  /** A round that could not be written because the shared key was busy.

      Held apart from `error` because it is a different kind of news and gets
      different treatment. An error stops the session; this does not. The
      rounds already played still happened, still count, and still lead to
      Round 4 and the results. All that is lost is the round nobody could
      write, and the student is told that in one calm line rather than left to
      notice a round went missing. */
  const [busyRounds, setBusyRounds] = useState<Round[]>([]);

  /* Audio. Both halves on by default, and the music starts as early as a
     browser will let it.

     Asked for on mount rather than at any particular button, so that a
     student who lands on the entry screen and reads it for a moment has music
     while they read. A browser will not actually allow sound on a page nobody
     has touched, so in practice it begins at the first interaction, whatever
     that turns out to be: clicking the topic field, tapping a starter chip,
     typing the first letter of a topic, or pressing start. music.ts handles
     that fallback; nothing here needs to know which gesture won.

     Turning it off is one click on a control that is on every screen, and the
     control is on the entry screen precisely so it can be reached before the
     first gesture has started anything.

     Both settings survive a restart, so the choice is made once per tab. */
  const [sound, setSound] = useState(true);
  const [music, setMusicOn] = useState(true);

  useEffect(() => {
    setMusic(music);
  }, [music]);

  /** Flip the music, and tell music.ts immediately rather than waiting for the
      effect above to notice.

      The duplicate call is deliberate and load bearing. React batches state,
      so the effect does not run until after this click has finished
      propagating, and music.ts is meanwhile listening on window for the first
      gesture. Without this line, a student whose very first action is hitting
      mute gets: React sets the state, the window listener fires with the old
      value still in place, starts the track, and the effect pauses it a frame
      later. A blip of music played at exactly the person switching it off.
      Setting it synchronously here means the listener sees the truth. */
  const toggleMusic = useCallback(() => {
    const next = !music;
    setMusicOn(next);
    setMusic(next);
  }, [music]);

  const toggleSound = useCallback(() => setSound((on) => !on), []);

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

  /* The warm up is outside the game entirely: it is taken before any studying,
     so a streak earned by guessing there would be carried into Round 1 as
     though it had been earned by knowing something. The run starts counting at
     Round 1. */
  const streak = currentStreak(answers.filter((a) => a.stage >= 1));

  /** Elapsed run time so far: the stages that are finished, plus the one
      being played right now.

      Deliberately NOT wall clock since the run began. Wall clock counts the
      time the student spent watching a loading screen while the model wrote
      the next round, and it counts the between-rounds screen, and it counts
      Round 4. None of that is in the run: `runTime` on the results is the sum
      of the splits, and a split is one stage's own time. So a header clock
      driven off wall clock ran ahead of the number the session would
      eventually report, and jumped forward every time a round was generated.

      Built from the same splits the results are, so the clock a student
      watches during the run and the time they are given at the end of it are
      the same measurement. */
  const runElapsed = useCallback(() => {
    const banked = splits.reduce((sum, s) => sum + s.ms, 0);
    /* The two phases where the student is actually working. Round 4 counts:
       its clock stopping dead on the last screen of the run read as a broken
       timer rather than as a deliberate exemption. */
    if (phase !== "playing" && phase !== "round4") return banked;
    return banked + (performance.now() - stageStartedAt.current);
  }, [phase, splits]);

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
           reaches that round, not as an interruption to the one they are in.

           The empty array is what makes that true, and it is set on every
           failure including this one. `beginRound` reads undefined as "still
           being written" and an empty array as "this round has nothing", and
           only the second of those lets the session walk on. A rate limit
           that left the bank undefined would leave a student watching the
           waiting screen for a request that had already failed. */
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
    /* Round 4 is a timed leg like any other, so its clock starts when it
       opens. Without this the stage would inherit Round 3's start time and
       report a split covering both. */
    stageStartedAt.current = performance.now();
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

  /** Close Round 4's split and go to the results.

      Guarded against a second call, because this is reachable from three
      controls on the Round 4 screens and a duplicate split would be counted
      twice in the run total. Closing it here rather than in `advance` is
      because Round 4 does not go through `advance`: it has no per-question
      timer and ends when the student says it does. */
  const finish = useCallback(() => {
    setSplits((prev) =>
      prev.some((s) => s.stage === 4)
        ? prev
        : [...prev, { stage: 4, ms: performance.now() - stageStartedAt.current }]
    );
    setPhase("reveal");
  }, []);

  /** The round continuing on will actually land on.

      `stage + 1` is the next rung of the ladder. This is the next rung this
      session still has, which is a different thing once a bank has come back
      empty, and a bank coming back empty is what a rate limited round looks
      like from in here. The between-rounds screen announces the round it is
      about to start, and announcing one that was skipped would put "Round 1
      was skipped" and "Start round 1" on the same screen.

      The walk matches `beginRound`, including on the distinction that matters:
      an undefined bank is one still being written, and that round is still the
      next one. Only an empty array is a round with nothing in it. */
  const nextPlayable: Round = (() => {
    let target = (stage + 1) as Round;
    while (target <= 3 && banks[target]?.length === 0) {
      target = (target + 1) as Round;
    }
    return target > 3 ? 4 : target;
  })();

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
        rating: data.rating.earned,
        runTime: data.runTime,
        openCorrect: data.open?.correct ?? 0,
        openAnswered: data.open?.answered ?? 0,
        demonstrated: data.productions.filter((p) => p.outcome === "solid").length,
        productions: data.productions.length,
      };
      runs.current = [...runs.current, record];
      /* Every run counts toward the best rating, including one abandoned
         early. There is no way to inflate a rating by stopping, because
         stopping means the questions you never reached earned nothing. */
      setBest({ rating: Math.max(...runs.current.map((r) => r.rating)) });
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
    setBusyRounds([]);
    /* A new seed for the next run, so going again does not draw the same
       presentations in the same order. */
    setSeed(newSeed());
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

    error,
    busyRounds,
    nextPlayable,
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
    toggleSound,
    toggleMusic,
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
