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

export function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[-–—_/]+/g, " ")
    .replace(/[^\p{L}\p{N}\s']/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:the|a|an)\s+/, "");
}

function editDistance(a: string, b: string, limit: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > limit) return limit + 1;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let best = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < best) best = curr[j];
    }
    if (best > limit) return limit + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

function typoTolerance(len: number): number {
  if (len <= 4) return 0;
  if (len <= 8) return 1;
  return 2;
}

function numberForms(s: string): string[] {
  const out = new Set([s]);
  if (/ies$/.test(s) && s.length > 4) out.add(`${s.slice(0, -3)}y`);
  if (/es$/.test(s) && s.length > 3) out.add(s.slice(0, -2));
  if (/s$/.test(s) && !/ss$/.test(s) && s.length > 3) out.add(s.slice(0, -1));
  return [...out];
}

export function checkTyped(q: Question, given: string): boolean {
  const typed = normalizeAnswer(given);
  if (!typed) return false;

  const targets = [q.answer, ...(q.accepted ?? [])].map(normalizeAnswer).filter(Boolean);
  const typedForms = numberForms(typed);

  return targets.some((target) => {
    for (const t of numberForms(target)) {
      if (typedForms.includes(t)) return true;
    }
    const tolerance = typoTolerance(target.length);
    if (tolerance === 0) return false;
    return editDistance(typed, target, tolerance) <= tolerance;
  });
}

function listParts(sentence: string): string[] {
  return sentence
    .split(/\s*,\s*|\s+and\s+|\s+or\s+|\s*;\s*/i)
    .map(normalizeAnswer)
    .filter(Boolean);
}

function sameListDifferentOrder(builtRaw: string, targetRaw: string): boolean {
  const a = builtRaw.toLowerCase().split(/\s+/).filter(Boolean);
  const b = targetRaw.toLowerCase().split(/\s+/).filter(Boolean);

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

  const left = listParts(a.slice(head, a.length - tail).join(" "));
  const right = listParts(b.slice(head, b.length - tail).join(" "));
  if (left.length < 2 || left.length !== right.length) return false;

  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((part, i) => part === sortedRight[i]);
}

export function checkAssembled(q: Question, selected: string[]): boolean {
  const builtRaw = selected.join(" ");
  const built = normalizeAnswer(builtRaw);
  if (!built) return false;

  const rawTargets = [(q.chips ?? []).join(" "), q.answer, ...(q.accepted ?? [])].filter((t) =>
    t.trim()
  );

  if (rawTargets.map(normalizeAnswer).includes(built)) return true;
  return rawTargets.some((target) => sameListDifferentOrder(builtRaw, target));
}

export function isCorrect(q: Question, given: string | number | string[]): boolean {
  if (q.format === "recognition" || q.format === "choice") {
    return typeof given === "number" && given === q.answerIndex;
  }
  if (q.format === "assemble") {
    return Array.isArray(given) && checkAssembled(q, given);
  }
  return typeof given === "string" && checkTyped(q, given);
}

export function accuracy(answers: Answer[]): number {
  if (answers.length === 0) return 0;
  return answers.filter((a) => a.correct).length / answers.length;
}

function step(d: Difficulty, by: -1 | 0 | 1, floor: Difficulty = "easy"): Difficulty {
  const i = TIERS.indexOf(d);
  const lowest = Math.max(0, TIERS.indexOf(floor));
  return TIERS[Math.min(TIERS.length - 1, Math.max(lowest, i + by))];
}

export function nextDifficulty(
  current: Difficulty,
  roundAnswers: Answer[],
  floor: Difficulty = "easy"
): Difficulty {
  const lastTwo = roundAnswers.slice(-2);
  if (lastTwo.length === 2 && lastTwo.every((a) => !a.correct)) {
    return step(current, -1, floor);
  }

  if (roundAnswers.length < 2) return current;

  const rate = accuracy(roundAnswers);
  if (rate < TARGET_LOW) return step(current, -1, floor);
  if (rate > TARGET_HIGH) return step(current, 1, floor);
  return current;
}

function unasked(pool: Question[], tier: Difficulty, asked: Set<string>): Question | undefined {
  return pool.find((q) => q.difficulty === tier && !asked.has(q.id));
}

export function pickQuestion(
  pool: Question[],
  want: Difficulty,
  asked: Set<string>
): Question | null {
  const direct = unasked(pool, want, asked);
  if (direct) return direct;

  const wantIndex = TIERS.indexOf(want);
  const order = [...TIERS].sort((a, b) => {
    const da = Math.abs(TIERS.indexOf(a) - wantIndex);
    const db = Math.abs(TIERS.indexOf(b) - wantIndex);
    if (da !== db) return da - db;
    return TIERS.indexOf(a) - TIERS.indexOf(b);
  });

  for (const tier of order) {
    const found = unasked(pool, tier, asked);
    if (found) return found;
  }

  return null;
}

export function currentStreak(answers: Answer[]): number {
  let n = 0;
  for (let i = answers.length - 1; i >= 0; i--) {
    if (!answers[i].correct) break;
    n++;
  }
  return n;
}

export function bestStreak(answers: Answer[]): number {
  let best = 0;
  let run = 0;
  for (const a of answers) {
    if (a.correct) {
      run++;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return best;
}

export function formatClock(ms: number): string {
  const safe = Math.max(0, ms);
  const minutes = Math.floor(safe / 60000);
  const seconds = Math.floor((safe % 60000) / 1000);
  const tenths = Math.floor((safe % 1000) / 100);
  return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

export function splitTotal(splits: Split[]): number {
  return splits.reduce((sum, s) => sum + s.ms, 0);
}

const STAGE_WEIGHT: Record<number, number> = {
  0: 1, // warm up, before studying
  1: 3, // pick it out
  2: 5, // fill the gap
  3: 6, // build it
};

const DIFFICULTY_WEIGHT: Record<Difficulty, number> = {
  easy: 1,
  medium: 1.5,
  hard: 2,
};

const PRODUCTION_VALUE: Record<Production["outcome"], number> = {
  solid: 150,
  shaky: 70,
  "not-yet": 0,
};

const PRODUCTION_BEST = PRODUCTION_VALUE.solid;

export type Rating = {
  earned: number;
  possible: number;
  share: number;
  score: number;
  band: "strong" | "fair" | "weak";
};

function questionValue(a: Answer): number {
  return (STAGE_WEIGHT[a.stage] ?? 0) * DIFFICULTY_WEIGHT[a.difficulty] * 10;
}

export function rating(answers: Answer[], productions: Production[]): Rating {
  let earned = 0;
  let possible = 0;

  for (const a of answers) {
    const value = questionValue(a);
    possible += value;
    if (a.correct) earned += value;
  }

  for (const p of productions) {
    possible += PRODUCTION_BEST;
    earned += PRODUCTION_VALUE[p.outcome];
  }

  earned = Math.round(earned);
  possible = Math.round(possible);

  const share = possible > 0 ? earned / possible : 0;
  const band = share >= 0.75 ? "strong" : share >= 0.45 ? "fair" : "weak";

  return { earned, possible, share, score: Math.round(share * 10), band };
}

export function fastestCorrect(answers: Answer[]): number | null {
  const times = answers.filter((a) => a.correct).map((a) => a.ms);
  return times.length > 0 ? Math.min(...times) : null;
}

export function beatsBest(previous: Answer[], ms: number, correct: boolean): boolean {
  if (!correct) return false;
  const best = fastestCorrect(previous);
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
  const earlier = answers.filter((a) => a.stage < stage);

  const rightNow = new Set(mine.filter((a) => a.correct).map((a) => a.concept));
  const rightBefore = new Set(earlier.filter((a) => a.correct).map((a) => a.concept));
  const seenBefore = new Set(earlier.map((a) => a.concept));

  const turnedAround = [...rightNow].filter((c) => seenBefore.has(c) && !rightBefore.has(c));

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

function median(ns: number[]): number | null {
  if (ns.length === 0) return null;
  const sorted = [...ns].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function rankForProduction(answers: Answer[], openFirst: string[] = []): ProductionRank[] {
  const inRounds = answers.filter((a) => a.stage >= 1 && a.stage <= 3);
  if (inRounds.length === 0) return [];

  const open = new Set(openFirst);

  const scored = [...new Set(inRounds.map((a) => a.concept))].map((concept) => {
    const mine = inRounds.filter((a) => a.concept === concept);
    const right = mine.filter((a) => a.correct);
    return {
      concept,
      attempts: mine.length,
      correct: right.length,
      highestRound: right.reduce((max, a) => Math.max(max, a.stage), 0),
      medianMs: median(right.map((a) => a.ms)),
      basis: (right.length > 0 ? "strongest" : "most-seen") as ProductionRank["basis"],
    };
  });

  return scored.sort((a, b) => {
    const aOpen = open.has(a.concept);
    const bOpen = open.has(b.concept);
    if (aOpen !== bOpen) return aOpen ? -1 : 1;
    if (a.correct > 0 !== b.correct > 0) return a.correct > 0 ? -1 : 1;
    if (a.highestRound !== b.highestRound) return b.highestRound - a.highestRound;
    const am = a.medianMs ?? Infinity;
    const bm = b.medianMs ?? Infinity;
    if (am !== bm) return am - bm;
    if (a.correct !== b.correct) return b.correct - a.correct;
    return b.attempts - a.attempts;
  });
}

export type StageScore = {
  correct: number;
  answered: number;
  format: Format;
  chance: number;
};

export type ConceptLine = {
  concept: string;
  openCorrect: number;
  openAnswered: number;
  reached: number;
  outcome: Production["outcome"] | null;
};

export type Standing =
  | "explained"
  | "almost"
  | "not-yet"
  | "recognised"
  | "missed";

export function conceptStanding(line: ConceptLine): Standing {
  if (line.outcome === "solid") return "explained";
  if (line.outcome === "shaky") return "almost";
  if (line.outcome === "not-yet") return "not-yet";
  return line.reached > 0 ? "recognised" : "missed";
}

export function isOpen(standing: Standing): boolean {
  return standing !== "explained";
}

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
  if (mine.length === 0) return null;
  return {
    correct: mine.filter((a) => a.correct).length,
    answered: mine.length,
    format,
    chance: format === "recognition" ? 0.5 : format === "choice" ? 0.25 : format === "assemble" ? 0.01 : 0,
  };
}

export function buildReveal(
  answers: Answer[],
  productions: Production[],
  splits: Split[] = []
): Reveal {
  const concepts = [...new Set(answers.map((a) => a.concept))].map((concept) => {
    const open = answers.filter((a) => a.concept === concept && a.stage === 0);
    const right = answers.filter((a) => a.concept === concept && a.correct);
    return {
      concept,
      openCorrect: open.filter((a) => a.correct).length,
      openAnswered: open.length,
      reached: right.reduce((max, a) => Math.max(max, a.stage), 0),
      outcome: productions.find((p) => p.concept === concept)?.outcome ?? null,
    };
  });

  return {
    open: stageScore(answers, 0, "recognition"),
    rounds: ([1, 2, 3] as Round[])
      .map((r) => stageScore(answers, r, r === 1 ? "choice" : r === 2 ? "blank" : "assemble"))
      .filter((s): s is StageScore => s !== null),
    productions,
    concepts,
    bestStreak: bestStreak(answers),
    rating: rating(answers, productions),
    splits,
    runTime: splitTotal(splits),
    fastestAnswer: fastestCorrect(answers),
  };
}
