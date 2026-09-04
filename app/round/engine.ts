import {
  type Answer,
  type Difficulty,
  type Format,
  type Production,
  type Question,
  type Round,
  type Split,
  TARGET_HIGH,
  TARGET_LOW,
  TIERS,
} from "./types";

export function normalizeAnswer(s: string) {
  return s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[-–—_/]+/g, " ")
    .replace(/[^\p{L}\p{N}\s']/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:the|a|an)\s+/, "");
}

function dist(a: string, b: string, limit: number) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > limit) return limit + 1;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let cur = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    let best = cur[0];
    for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + c);
      if (cur[j] < best) best = cur[j];
    }
    if (best > limit) return limit + 1;
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
}

const slack = (n: number) => (n <= 4 ? 0 : n <= 8 ? 1 : 2);

function plurals(s: string) {
  const out = new Set([s]);
  if (/ies$/.test(s) && s.length > 4) out.add(`${s.slice(0, -3)}y`);
  if (/es$/.test(s) && s.length > 3) out.add(s.slice(0, -2));
  if (/s$/.test(s) && !/ss$/.test(s) && s.length > 3) out.add(s.slice(0, -1));
  return [...out];
}

export function checkTyped(q: Question, given: string) {
  const typed = normalizeAnswer(given);
  if (!typed) return false;

  const want = [q.answer, ...(q.accepted ?? [])].map(normalizeAnswer).filter(Boolean);
  const mine = plurals(typed);

  return want.some((t) => {
    for (const form of plurals(t)) if (mine.includes(form)) return true;
    const s = slack(t.length);
    return s === 0 ? false : dist(typed, t, s) <= s;
  });
}

const bits = (s: string) =>
  s
    .split(/\s*,\s*|\s+and\s+|\s+or\s+|\s*;\s*/i)
    .map(normalizeAnswer)
    .filter(Boolean);

function sameListShuffled(built: string, want: string) {
  const a = built.toLowerCase().split(/\s+/).filter(Boolean);
  const b = want.toLowerCase().split(/\s+/).filter(Boolean);

  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;

  let tail = 0;
  while (
    tail < a.length - head &&
    tail < b.length - head &&
    a[a.length - 1 - tail] === b[b.length - 1 - tail]
  ) {
    tail++;
  }

  const l = bits(a.slice(head, a.length - tail).join(" "));
  const r = bits(b.slice(head, b.length - tail).join(" "));
  if (l.length < 2 || l.length !== r.length) return false;

  const ls = [...l].sort();
  const rs = [...r].sort();
  return ls.every((x, i) => x === rs[i]);
}

export function checkAssembled(q: Question, picked: string[]) {
  const raw = picked.join(" ");
  const built = normalizeAnswer(raw);
  if (!built) return false;

  const want = [(q.chips ?? []).join(" "), q.answer, ...(q.accepted ?? [])].filter((t) => t.trim());

  if (want.map(normalizeAnswer).includes(built)) return true;
  return want.some((t) => sameListShuffled(raw, t));
}

export function isCorrect(q: Question, given: string | number | string[]) {
  if (q.format === "recognition" || q.format === "choice")
    return typeof given === "number" && given === q.answerIndex;
  if (q.format === "assemble") return Array.isArray(given) && checkAssembled(q, given);
  return typeof given === "string" && checkTyped(q, given);
}

export const accuracy = (as: Answer[]) =>
  as.length ? as.filter((a) => a.correct).length / as.length : 0;

function step(d: Difficulty, by: -1 | 0 | 1, floor: Difficulty = "easy"): Difficulty {
  const i = TIERS.indexOf(d);
  const lo = Math.max(0, TIERS.indexOf(floor));
  return TIERS[Math.min(TIERS.length - 1, Math.max(lo, i + by))];
}

export function nextDifficulty(now: Difficulty, answers: Answer[], floor: Difficulty = "easy") {
  const last2 = answers.slice(-2);
  if (last2.length === 2 && last2.every((a) => !a.correct)) return step(now, -1, floor);

  if (answers.length < 2) return now;

  const rate = accuracy(answers);
  if (rate < TARGET_LOW) return step(now, -1, floor);
  if (rate > TARGET_HIGH) return step(now, 1, floor);
  return now;
}

const fresh = (pool: Question[], tier: Difficulty, asked: Set<string>) =>
  pool.find((q) => q.difficulty === tier && !asked.has(q.id));

export function pickQuestion(pool: Question[], want: Difficulty, asked: Set<string>) {
  const hit = fresh(pool, want, asked);
  if (hit) return hit;

  const wi = TIERS.indexOf(want);
  const near = [...TIERS].sort((a, b) => {
    const da = Math.abs(TIERS.indexOf(a) - wi);
    const db = Math.abs(TIERS.indexOf(b) - wi);
    return da !== db ? da - db : TIERS.indexOf(a) - TIERS.indexOf(b);
  });

  for (const t of near) {
    const q = fresh(pool, t, asked);
    if (q) return q;
  }
  return null;
}

export function currentStreak(as: Answer[]) {
  let n = 0;
  for (let i = as.length - 1; i >= 0; i--) {
    if (!as[i].correct) break;
    n++;
  }
  return n;
}

export function bestStreak(as: Answer[]) {
  let best = 0;
  let run = 0;
  for (const a of as) {
    if (!a.correct) {
      run = 0;
      continue;
    }
    run++;
    if (run > best) best = run;
  }
  return best;
}

export function formatClock(ms: number) {
  const t = Math.max(0, ms);
  const m = Math.floor(t / 60000);
  const s = Math.floor((t % 60000) / 1000);
  return `${m}:${String(s).padStart(2, "0")}.${Math.floor((t % 1000) / 100)}`;
}

export const splitTotal = (ss: Split[]) => ss.reduce((n, s) => n + s.ms, 0);

const STAGE_W: Record<number, number> = { 0: 1, 1: 3, 2: 5, 3: 6 };
const DIFF_W: Record<Difficulty, number> = { easy: 1, medium: 1.5, hard: 2 };

const SAID: Record<Production["outcome"], number> = { solid: 150, shaky: 70, "not-yet": 0 };
const SAID_MAX = SAID.solid;

export type Rating = {
  earned: number;
  possible: number;
  share: number;
  score: number;
  band: "strong" | "fair" | "weak";
};

const worth = (a: Answer) => (STAGE_W[a.stage] ?? 0) * DIFF_W[a.difficulty] * 10;

export function rating(answers: Answer[], said: Production[]): Rating {
  let earned = 0;
  let possible = 0;

  for (const a of answers) {
    const v = worth(a);
    possible += v;
    if (a.correct) earned += v;
  }

  for (const p of said) {
    possible += SAID_MAX;
    earned += SAID[p.outcome];
  }

  earned = Math.round(earned);
  possible = Math.round(possible);

  const share = possible > 0 ? earned / possible : 0;
  const band = share >= 0.75 ? "strong" : share >= 0.45 ? "fair" : "weak";

  return { earned, possible, share, score: Math.round(share * 10), band };
}

export function fastestCorrect(as: Answer[]) {
  const ms = as.filter((a) => a.correct).map((a) => a.ms);
  return ms.length ? Math.min(...ms) : null;
}

export function beatsBest(before: Answer[], ms: number, correct: boolean) {
  if (!correct) return false;
  const best = fastestCorrect(before);
  return best === null || ms < best;
}

export type RoundSummary = {
  stage: 0 | Round;
  correct: number;
  answered: number;
  turnedAround: string[];
  stillOpen: string[];
  bestStreak: number;
};

export function summarizeRound(answers: Answer[], stage: 0 | Round): RoundSummary {
  const mine = answers.filter((a) => a.stage === stage);
  const before = answers.filter((a) => a.stage < stage);

  const nowRight = new Set(mine.filter((a) => a.correct).map((a) => a.concept));
  const wasRight = new Set(before.filter((a) => a.correct).map((a) => a.concept));
  const wasAsked = new Set(before.map((a) => a.concept));

  const turnedAround = [...nowRight].filter((c) => wasAsked.has(c) && !wasRight.has(c));

  const everRight = new Set(answers.filter((a) => a.correct).map((a) => a.concept));
  const stillOpen = [...new Set(answers.map((a) => a.concept))].filter((c) => !everRight.has(c));

  return {
    stage,
    correct: mine.filter((a) => a.correct).length,
    answered: mine.length,
    turnedAround,
    stillOpen,
    bestStreak: bestStreak(mine),
  };
}

export type ProductionRank = {
  concept: string;
  basis: "strongest" | "most-seen";
  highestRound: number;
  medianMs: number | null;
  correct: number;
  attempts: number;
};

function median(ns: number[]) {
  if (!ns.length) return null;
  const s = [...ns].sort((x, y) => x - y);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function rankForProduction(answers: Answer[], openFirst: string[] = []): ProductionRank[] {
  const played = answers.filter((a) => a.stage >= 1 && a.stage <= 3);
  if (!played.length) return [];

  const open = new Set(openFirst);

  const scored = [...new Set(played.map((a) => a.concept))].map((concept) => {
    const mine = played.filter((a) => a.concept === concept);
    const right = mine.filter((a) => a.correct);
    return {
      concept,
      attempts: mine.length,
      correct: right.length,
      highestRound: right.reduce((m, a) => Math.max(m, a.stage), 0),
      medianMs: median(right.map((a) => a.ms)),
      basis: (right.length ? "strongest" : "most-seen") as ProductionRank["basis"],
    };
  });

  return scored.sort((a, b) => {
    const ao = open.has(a.concept);
    const bo = open.has(b.concept);
    if (ao !== bo) return ao ? -1 : 1;
    if (a.correct > 0 !== b.correct > 0) return a.correct > 0 ? -1 : 1;
    if (a.highestRound !== b.highestRound) return b.highestRound - a.highestRound;
    const am = a.medianMs ?? Infinity;
    const bm = b.medianMs ?? Infinity;
    if (am !== bm) return am - bm;
    if (a.correct !== b.correct) return b.correct - a.correct;
    return b.attempts - a.attempts;
  });
}

export type StageScore = { correct: number; answered: number; format: Format; chance: number };

export type ConceptLine = {
  concept: string;
  openCorrect: number;
  openAnswered: number;
  reached: number;
  outcome: Production["outcome"] | null;
};

export type Standing = "explained" | "almost" | "not-yet" | "recognised" | "missed";

export function conceptStanding(l: ConceptLine): Standing {
  if (l.outcome === "solid") return "explained";
  if (l.outcome === "shaky") return "almost";
  if (l.outcome === "not-yet") return "not-yet";
  return l.reached > 0 ? "recognised" : "missed";
}

export const isOpen = (s: Standing) => s !== "explained";

export type Reveal = {
  open: StageScore | null;
  rounds: StageScore[];
  productions: Production[];
  concepts: ConceptLine[];
  bestStreak: number;
  rating: Rating;
  splits: Split[];
  runTime: number;
  fastestAnswer: number | null;
};

function stageScore(answers: Answer[], stage: 0 | Round, format: Format): StageScore | null {
  const mine = answers.filter((a) => a.stage === stage);
  if (!mine.length) return null;
  return {
    correct: mine.filter((a) => a.correct).length,
    answered: mine.length,
    format,
    chance:
      format === "recognition" ? 0.5 : format === "choice" ? 0.25 : format === "assemble" ? 0.01 : 0,
  };
}

export function buildReveal(answers: Answer[], said: Production[], splits: Split[] = []): Reveal {
  const concepts = [...new Set(answers.map((a) => a.concept))].map((c) => {
    const open = answers.filter((a) => a.concept === c && a.stage === 0);
    const right = answers.filter((a) => a.concept === c && a.correct);
    return {
      concept: c,
      openCorrect: open.filter((a) => a.correct).length,
      openAnswered: open.length,
      reached: right.reduce((m, a) => Math.max(m, a.stage), 0),
      outcome: said.find((p) => p.concept === c)?.outcome ?? null,
    };
  });

  return {
    open: stageScore(answers, 0, "recognition"),
    rounds: ([1, 2, 3] as Round[])
      .map((r) => stageScore(answers, r, r === 1 ? "choice" : r === 2 ? "blank" : "assemble"))
      .filter((s): s is StageScore => s !== null),
    productions: said,
    concepts,
    bestStreak: bestStreak(answers),
    rating: rating(answers, said),
    splits,
    runTime: splitTotal(splits),
    fastestAnswer: fastestCorrect(answers),
  };
}
