/* Round Mode: every decision the session makes, as pure functions.

   None of this touches React, the network, or the clock. It is separated
   because it is the part that can be wrong in ways nobody notices: a
   difficulty ladder that never eases, an answer check that quietly accepts a
   different word, a results screen that flatters. Kept pure, each of those
   can be run against real cases and read as arithmetic. */

import {
  type Answer,
  BASE_POINTS,
  comboMultiplier,
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

/* ── Answer checking ──────────────────────────────────────────────────────
   Rounds 2 and 3 are checked here rather than by a model. That is a feel
   decision with a correctness cost, so the bar is set deliberately:
   forgiving about how a student types, strict about what they typed. A
   grading round trip per question would be more nuanced and would also put a
   second and a half between every answer and the next one, which is the one
   thing this mode cannot afford. */

/** Strip everything that is not the answer: case, punctuation, the shape of
    the spacing, and a leading article. What is left is the term itself. */
export function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    /* Hyphens, slashes and underscores are word joins here, not punctuation:
       "cell-wall" and "cell wall" are the same answer typed two ways. */
    .replace(/[-–—_/]+/g, " ")
    .replace(/[^\p{L}\p{N}\s']/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:the|a|an)\s+/, "");
}

/** Levenshtein distance, bailing out once it cannot come in under `limit`.
    Only ever asked about short strings, so the simple two-row table is more
    than fast enough. */
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
    /* Every remaining row can only add to the best score on this one, so a
       row already over the limit settles it. */
    if (best > limit) return limit + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/** How far off a typed answer may be and still count.

    Short answers get none. At four characters or fewer, one edit is usually a
    different word rather than a slip: "gene" to "genes" is fine to accept,
    but "mass" to "mash" is not, and nothing here can tell them apart. Longer
    answers earn a little room, because a student who typed eleven of twelve
    characters correctly knew it. */
function typoTolerance(len: number): number {
  if (len <= 4) return 0;
  if (len <= 8) return 1;
  return 2;
}

/** A term and its singular, so number never decides a question.

    "Gene" and "genes" are one answer, but both are too short to earn any typo
    tolerance, and widening the tolerance to catch them would also start
    accepting different words. Handling number directly is the narrow fix: it
    admits exactly the plural and nothing else. */
function numberForms(s: string): string[] {
  const out = new Set([s]);
  if (/ies$/.test(s) && s.length > 4) out.add(`${s.slice(0, -3)}y`);
  if (/es$/.test(s) && s.length > 3) out.add(s.slice(0, -2));
  if (/s$/.test(s) && !/ss$/.test(s) && s.length > 3) out.add(s.slice(0, -1));
  return [...out];
}

/** Whether typed text answers the question. Checked against the canonical
    answer and every variant the generator supplied. */
export function checkTyped(q: Question, given: string): boolean {
  const typed = normalizeAnswer(given);
  if (!typed) return false;

  const targets = [q.answer, ...(q.accepted ?? [])].map(normalizeAnswer).filter(Boolean);
  const typedForms = numberForms(typed);

  return targets.some((target) => {
    for (const t of numberForms(target)) {
      if (typedForms.includes(t)) return true;
    }
    /* Typos are measured against what was actually asked for, not against a
       stemmed version of it, so the allowance cannot compound. */
    const tolerance = typoTolerance(target.length);
    if (tolerance === 0) return false;
    return editDistance(typed, target, tolerance) <= tolerance;
  });
}

/** Whether an assembled row of chips says the right thing.

    Compared as a normalized sentence rather than chip by chip, so a student
    who built the sentence correctly is not marked wrong because the generator
    split "in order to" across two chips and they chose the other split.
    Alternative phrasings the generator supplied are accepted whole. */
export function checkAssembled(q: Question, selected: string[]): boolean {
  const built = normalizeAnswer(selected.join(" "));
  if (!built) return false;

  const targets = [
    (q.chips ?? []).join(" "),
    q.answer,
    ...(q.accepted ?? []),
  ]
    .map(normalizeAnswer)
    .filter(Boolean);

  return targets.includes(built);
}

/** Whether an answer is right, whichever way the question was asked.
    `given` is an option index for the two option formats, the assembled chips
    for Round 3, and the typed text for Round 2. */
export function isCorrect(q: Question, given: string | number | string[]): boolean {
  if (q.format === "recognition" || q.format === "choice") {
    return typeof given === "number" && given === q.answerIndex;
  }
  if (q.format === "assemble") {
    return Array.isArray(given) && checkAssembled(q, given);
  }
  return typeof given === "string" && checkTyped(q, given);
}

/* ── Adaptive difficulty ──────────────────────────────────────────────────
   The target band is 70 to 80 percent correct. A student below it is not
   being stretched, they are being drowned, and retrieval practice that fails
   most of the time with the answer handed over each time is just reading with
   extra steps. So the ladder responds after every answer rather than at the
   end of a round, by which time the round is over. */

/** Accuracy as the student is shown it: a question that ran out of time was
    not answered, so it is not a wrong answer. */
export function accuracy(answers: Answer[]): number {
  const counted = answers.filter((a) => !a.timedOut);
  if (counted.length === 0) return 0;
  return counted.filter((a) => a.correct).length / counted.length;
}

/** Accuracy as the ladder reads it, where running out of time counts against.

    These two deliberately disagree. Fifteen seconds of silence on a
    four-option question is not a wrong answer, and telling a student it was
    would be a lie. But it is still evidence they are out of their depth, and
    a ladder that ignores it leaves them stranded at a tier they cannot reach,
    timing out over and over while the difficulty holds. Reporting protects
    the student's record; the ladder protects the student. */
export function ladderAccuracy(answers: Answer[]): number {
  if (answers.length === 0) return 0;
  return answers.filter((a) => a.correct).length / answers.length;
}

function step(d: Difficulty, by: -1 | 0 | 1, floor: Difficulty = "easy"): Difficulty {
  const i = TIERS.indexOf(d);
  const lowest = Math.max(0, TIERS.indexOf(floor));
  return TIERS[Math.min(TIERS.length - 1, Math.max(lowest, i + by))];
}

/** The tier the next question in this round should come from.

    `roundAnswers` is this round's answers only. Difficulty does not carry
    across rounds, because the format changes underneath it: hard recall and
    hard multiple choice are not the same demand, and a student who earned the
    top tier by recognising answers has not earned it for producing them.

    `floor` is raised when the generator has run out of new easy questions on
    this topic. Easing into a tier with nothing left in it would mean either a
    repeated question or a round that stops early, and of the two ways to
    honour "never ask the same thing twice", holding the difficulty up is the
    one that still gives the student a round to play. */
export function nextDifficulty(
  current: Difficulty,
  roundAnswers: Answer[],
  floor: Difficulty = "easy"
): Difficulty {
  /* Two failures in a row eases immediately, whatever the running average
     says. A streak of failures is the specific thing that does the damage,
     and averaging it away over a good start is how a student ends a round
     having got the last four wrong. A timeout counts here. */
  const lastTwo = roundAnswers.slice(-2);
  if (lastTwo.length === 2 && lastTwo.every((a) => !a.correct)) {
    return step(current, -1, floor);
  }

  /* One answer is not evidence: it can only read as 0 or 100 percent, and
     acting on it would send every student who opens with a miss straight to
     the bottom tier. */
  if (roundAnswers.length < 2) return current;

  const rate = ladderAccuracy(roundAnswers);
  if (rate < TARGET_LOW) return step(current, -1, floor);
  if (rate > TARGET_HIGH) return step(current, 1, floor);
  return current;
}

/* ── Choosing the next question ───────────────────────────────────────── */

function unasked(pool: Question[], tier: Difficulty, asked: Set<string>): Question | undefined {
  return pool.find((q) => q.difficulty === tier && !asked.has(q.id));
}

/** Pull the next question from a round's bank at, or as near as possible to,
    the wanted tier.

    Nothing is ever served twice. There used to be a fallback here that brought
    back a question the student had got wrong earlier in the round when the
    wanted tier ran dry, on the reasoning that meeting a missed question again
    is the exercise rather than filler. That reasoning still holds for a study
    tool in general and it is wrong for this one: the ladder's whole claim is
    that each rung measured a fresh retrieval, and a rung padded with a
    question answered ninety seconds ago measures recall of the last ninety
    seconds. It is now removed at the root, so no path through this function
    can return an id that is already in `asked`.

    What replaces it is upward pressure. The banks are generated with a third
    to spare, the route refuses to write repeats and escalates instead when it
    runs dry, and the tier fallback below walks outward from the wanted tier.
    If all of that is exhausted the round ends early, which is the honest
    outcome and is reported as one. */
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
    /* Ties break downward: when the wanted tier is empty, a student is more
       likely to be there from easing than from climbing. */
    return TIERS.indexOf(a) - TIERS.indexOf(b);
  });

  for (const tier of order) {
    const found = unasked(pool, tier, asked);
    if (found) return found;
  }

  return null;
}

/* ── Streaks, combo, points ───────────────────────────────────────────────
   The game layer. It runs during the rounds and stops at the results screen,
   which does not use any of it: how a session felt is not evidence of what
   was learned, and putting a score next to the diagnosis would invite the
   student to read one as the other.

   A question that timed out neither extends a streak nor breaks one. It was
   not answered, so it is not a miss, and a student who steps away mid-round
   should not come back to a broken run. */

export function currentStreak(answers: Answer[]): number {
  let n = 0;
  for (let i = answers.length - 1; i >= 0; i--) {
    if (answers[i].timedOut) continue;
    if (!answers[i].correct) break;
    n++;
  }
  return n;
}

export function bestStreak(answers: Answer[]): number {
  let best = 0;
  let run = 0;
  for (const a of answers) {
    if (a.timedOut) continue;
    if (a.correct) {
      run++;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return best;
}

/** What a correct answer is worth, given the run it lands in.

    `streakAfter` is the streak including this answer, so the second
    consecutive correct answer is the one that first pays double. */
export function pointsFor(streakAfter: number): number {
  return BASE_POINTS * comboMultiplier(streakAfter);
}

export function totalPoints(answers: Answer[]): number {
  return answers.reduce((sum, a) => sum + (a.points ?? 0), 0);
}

/* ── The speedrun clock ───────────────────────────────────────────────────
   Splits, in the speedrun sense: how long each leg took. Real elapsed time,
   measured from a monotonic clock, never estimated and never adjusted. */

/** mm:ss.t, the way a run timer reads. Tenths, because hundredths flicker
    too fast to be read and read as noise rather than as speed. */
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

/** The quickest correct answer so far. Only correct ones count: the fastest
    way to answer a question is to get it wrong instantly, and a personal best
    that rewards that would be worse than having none. */
export function fastestCorrect(answers: Answer[]): number | null {
  const times = answers.filter((a) => a.correct && !a.timedOut).map((a) => a.ms);
  return times.length > 0 ? Math.min(...times) : null;
}

/** Whether an answer that just landed is the fastest correct one yet, given
    everything before it. What the "fastest yet" flash fires on. */
export function beatsBest(previous: Answer[], ms: number, correct: boolean): boolean {
  if (!correct) return false;
  const best = fastestCorrect(previous);
  return best === null || ms < best;
}

/* ── Between rounds ───────────────────────────────────────────────────────
   What actually changed, from this session's answers and nothing else. When
   the honest answer is "nothing yet", these return nothing and the screen
   says so rather than finding something flattering to show. */

export type RoundSummary = {
  /** 0 is the warm up, which gets a summary of its own shape: it is
      reported without a score, because it was taken before any studying. */
  stage: 0 | Round;
  correct: number;
  answered: number;
  timedOut: number;
  /** Concepts answered correctly this round that the student had got wrong
      at every earlier stage. Real movement, not a projection. */
  turnedAround: string[];
  /** Concepts still not right at any stage. Named plainly, not hidden. */
  stillOpen: string[];
  bestStreak: number;
  points: number;
};

export function summarizeRound(answers: Answer[], stage: 0 | Round): RoundSummary {
  const mine = answers.filter((a) => a.stage === stage);
  const scored = mine.filter((a) => !a.timedOut);
  const earlier = answers.filter((a) => a.stage < stage && !a.timedOut);

  const rightNow = new Set(scored.filter((a) => a.correct).map((a) => a.concept));
  const rightBefore = new Set(earlier.filter((a) => a.correct).map((a) => a.concept));
  const seenBefore = new Set(earlier.map((a) => a.concept));

  const turnedAround = [...rightNow].filter((c) => seenBefore.has(c) && !rightBefore.has(c));

  const everRight = new Set(
    answers.filter((a) => !a.timedOut && a.correct).map((a) => a.concept)
  );
  const stillOpen = [...new Set(answers.map((a) => a.concept))].filter((c) => !everRight.has(c));

  return {
    stage,
    correct: scored.filter((a) => a.correct).length,
    answered: scored.length,
    timedOut: mine.filter((a) => a.timedOut).length,
    turnedAround,
    stillOpen,
    bestStreak: bestStreak(mine),
    points: mine.reduce((sum, a) => sum + (a.points ?? 0), 0),
  };
}

/* ── Round 4 ordering ─────────────────────────────────────────────────────
   Which concept the student is asked to produce first. */

export type ProductionRank = {
  concept: string;
  /** How this concept was ranked, so the screen can say so plainly rather
      than presenting an order the student cannot see the reason for. */
  basis: "strongest" | "most-seen";
  /** Highest round it was answered correctly in. 0 when never. */
  highestRound: number;
  /** Median time on the correct answers that earned it the place. */
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

/** The session's concepts, strongest first.

    Strongest leads because Round 4 is the one moment with no scaffolding at
    all, and the first unscaffolded attempt of a student's life goes better
    when it is on the thing they just proved they can do. The weaker concepts
    follow, offered rather than forced.

    "Confidently" is not measurable, so it is not claimed. What is measurable
    is how far up the escalation a concept survived and how quickly the
    correct answers came, and that pair decides the order. Warm up answers
    are excluded outright: that stage is guessing by design, and a lucky coin
    flip is not evidence of anything. */
export function rankForProduction(answers: Answer[]): ProductionRank[] {
  const inRounds = answers.filter((a) => a.stage >= 1 && a.stage <= 3 && !a.timedOut);
  if (inRounds.length === 0) return [];

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
    if (a.correct > 0 !== b.correct > 0) return a.correct > 0 ? -1 : 1;
    if (a.highestRound !== b.highestRound) return b.highestRound - a.highestRound;
    const am = a.medianMs ?? Infinity;
    const bm = b.medianMs ?? Infinity;
    if (am !== bm) return am - bm;
    if (a.correct !== b.correct) return b.correct - a.correct;
    return b.attempts - a.attempts;
  });
}

/* ── The results screen ───────────────────────────────────────────────────
   This session's answers, counted. Nothing else.

   There is deliberately no improvement figure. The warm up is two-option
   recognition; Round 4 is unscaffolded production graded on a rubric. They
   are not the same test and there is no arithmetic that turns one into the
   other, so subtracting them would produce a number that looks like progress
   and means nothing. A student who genuinely learned can score lower at the
   end than at the start. The screen shows both, names what each one asked
   for, and lets the change in kind carry it. */

export type StageScore = {
  correct: number;
  answered: number;
  format: Format;
  /** Share of these you would expect to get right by guessing. */
  chance: number;
};

export type ConceptLine = {
  concept: string;
  openCorrect: number;
  openAnswered: number;
  /** Best stage this concept was ever answered correctly at. 0 when never. */
  reached: number;
  /** The Round 4 grade, when they produced this one. */
  outcome: Production["outcome"] | null;
};

export type Reveal = {
  open: StageScore | null;
  rounds: StageScore[];
  productions: Production[];
  concepts: ConceptLine[];
  bestStreak: number;
  points: number;
  /** Questions that ran out of time, reported on their own so they are never
      folded into a wrong answer. */
  timedOut: number;
  /** Per-stage splits and the total run, covering the warm up and Rounds 1
      to 3 only. Round 4 is untimed and outside the run. */
  splits: Split[];
  runTime: number;
  fastestAnswer: number | null;
};

function stageScore(answers: Answer[], stage: 0 | Round, format: Format): StageScore | null {
  const mine = answers.filter((a) => a.stage === stage && !a.timedOut);
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
    const open = answers.filter((a) => a.concept === concept && a.stage === 0 && !a.timedOut);
    const right = answers.filter((a) => a.concept === concept && a.correct && !a.timedOut);
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
    points: totalPoints(answers),
    timedOut: answers.filter((a) => a.timedOut).length,
    splits,
    runTime: splitTotal(splits),
    fastestAnswer: fastestCorrect(answers),
  };
}
