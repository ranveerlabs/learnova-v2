/* Round Mode: every decision the session makes, as pure functions.

   None of this touches React, the network, or the clock. It is separated
   because it is the part that can be wrong in ways nobody notices: a
   difficulty ladder that never eases, an answer check that quietly accepts a
   different word, a results screen that flatters. Kept pure, each of those
   can be run against real cases and read as arithmetic. */

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

/** The parts of a sentence that a list separator holds apart.

    "water, carbon dioxide and light" becomes three pieces. Anything with no
    separator in it comes back as a single piece, which is what keeps the
    comparison below strict for ordinary sentences.

    Splitting happens BEFORE normalising, and that order is the whole trick:
    `normalizeAnswer` strips punctuation, so a comma-separated list run through
    it first arrives here as one undifferentiated run of words with nothing
    left to split on. Each piece is normalised individually afterwards. */
function listParts(sentence: string): string[] {
  return sentence
    .split(/\s*,\s*|\s+and\s+|\s+or\s+|\s*;\s*/i)
    .map(normalizeAnswer)
    .filter(Boolean);
}

/** The same pieces in a different order, and nothing looser than that.

    The shared beginning and end of the two sentences are removed first, so
    that the sentence's stem does not travel with whichever list item happens
    to follow it. Without that, "produces oxygen, ATP and NADPH" splits into
    "produces oxygen" / "ATP" / "NADPH", and reordering the list changes which
    item the stem is glued to, which looks like a different sentence.

    What is left is compared as a multiset. It cannot match anything that is
    not a reordering: the pieces must be identical and there must be the same
    number of them. "sugar traps light" against "light traps sugar" shares no
    beginning, no end, and has no separator in it, so it comes out as one piece
    a side and is rejected. */
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

/** Whether an assembled row of chips says the right thing.

    Compared as a normalized sentence rather than chip by chip, so a student
    who built the sentence correctly is not marked wrong because the generator
    split "in order to" across two chips and they chose the other split.
    Alternative phrasings the generator supplied are accepted whole.

    Order inside a list does not count against them. A student who assembles
    "produces oxygen, ATP and NADPH" when the generator happened to write
    "produces ATP, NADPH and oxygen" has said the identical true thing, and
    marking that wrong teaches them to guess at the generator's word order
    instead of at the material. The tolerance is deliberately narrow: it
    forgives the order of complete list items and nothing else, so the round is
    still an assembly rather than a pile of words in any arrangement. */
export function checkAssembled(q: Question, selected: string[]): boolean {
  const builtRaw = selected.join(" ");
  const built = normalizeAnswer(builtRaw);
  if (!built) return false;

  /* Kept in both forms. The exact comparison needs them normalised; the
     reordering comparison needs the punctuation that normalising removes. */
  const rawTargets = [(q.chips ?? []).join(" "), q.answer, ...(q.accepted ?? [])].filter((t) =>
    t.trim()
  );

  if (rawTargets.map(normalizeAnswer).includes(built)) return true;
  return rawTargets.some((target) => sameListDifferentOrder(builtRaw, target));
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

/** Accuracy: right answers over questions asked.

    Running out of time counts as wrong, here and everywhere else. There used
    to be two of these, deliberately disagreeing: one for the ladder where a
    timeout counted against, and one for the student's record where it did
    not, on the argument that fifteen seconds of silence is not a wrong answer
    and calling it one would be a lie.

    It is not a lie, it is a rule, and it is the same rule every game with a
    clock in it has. A question you did not answer in time is a question you
    did not get. Saying so is also simpler to play against than an accuracy
    that quietly ignores some of the questions, and it means the streak, the
    round summary and the results all count the same events. */
export function accuracy(answers: Answer[]): number {
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

  const rate = accuracy(roundAnswers);
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

   A question that timed out breaks a streak, the same as any other question
   the student did not get. It used to be skipped over, so a run could survive
   any number of them; a run that survives not answering is not a run. */

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

/* ── The rating ───────────────────────────────────────────────────────────
   One number for the whole session, and the only one the results screen
   leads with.

   It exists because the run time was doing that job and could not. Time is
   not a measure of how well you did: the fastest way through a round is to
   answer everything wrong immediately, and a student who thinks carefully and
   gets more right comes out looking worse. Time is still shown, as a fact
   about the run, but it is no longer the headline.

   What the rating counts is what you actually demonstrated, weighted by how
   much the demonstration was worth:

   - Later rounds are worth more than earlier ones, because the scaffolding
     comes away as you climb. Recognising the answer among four is not the
     same act as producing it from nothing, and the ladder is the whole point
     of the mode.
   - Harder questions are worth more than easier ones at the same rung.
   - Round 4 is worth the most by a distance. It is the only stage with
     nothing on screen to lean on, so it is the only stage whose result is
     evidence rather than a signal.
   - The warm up counts for very little. It is taken before any studying, so
     it is mostly a baseline, but knowing something already is still knowing
     it and scoring it at zero would be its own kind of lie.

   Nothing here rewards speed and nothing punishes it. Two students who get
   the same questions right get the same rating whether one took four minutes
   or nine.

   `possible` is what this exact session was worth if everything had gone
   perfectly: the same weights over the questions actually served and the
   concepts actually asked for. It is what makes the number mean something
   without a leaderboard, and what the colour band is computed from, since a
   raw total says nothing on its own when a short session and a long one are
   scored on different denominators.

   ── Why the screen shows a score out of ten ──────────────────────────────
   The results screen used to lead with the raw pair: "+1,380" over "of
   2,280". Both numbers are honest and the denominator was there precisely
   because the numerator means nothing alone — but four digits over four
   digits is arithmetic handed to somebody to do, at the exact moment they
   want to know one thing. Nobody reads 1,380 of 2,280 as a proportion; they
   read it as a big number and then have to work.

   `score` is that division already done, on a scale everybody has used
   since school. It throws away nothing the reader was going to use: the
   weights still decide it, `share` still drives the colour band, and a 6 is
   a 6 whether the session ran eight questions or thirty, which is the one
   thing the raw pair could never say without being read twice. */

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

/** What one graded explanation in Round 4 is worth, by how it was marked. */
const PRODUCTION_VALUE: Record<Production["outcome"], number> = {
  solid: 150,
  shaky: 70,
  "not-yet": 0,
};

const PRODUCTION_BEST = PRODUCTION_VALUE.solid;

export type Rating = {
  /** The weighted total. Not shown any more; `score` is what the screen
      leads with. Kept because it is what `possible` is a denominator of,
      and dropping it would leave `share` a bare fraction with nothing
      behind it. */
  earned: number;
  /** What this session was worth if nothing had been missed. */
  possible: number;
  /** `earned / possible`, 0 when there was nothing to earn. Drives the band. */
  share: number;
  /** `share` out of ten, whole. The one number the student is shown.

      Rounded rather than floored, so a run that got nearly everything does
      not read as a 9, and a run that got almost nothing does not read as a
      1. It is also what is kept as the best on a topic, which only works
      because it is a proportion: two runs of different lengths on the same
      topic are comparable on this scale and were not comparable on the raw
      total the record used to keep. */
  score: number;
  /** Which of the three colour bands `share` falls in. */
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

/** The quickest correct answer so far. Only correct ones count: the fastest
    way to answer a question is to get it wrong instantly, and a personal best
    that rewards that would be worse than having none. */
export function fastestCorrect(answers: Answer[]): number | null {
  const times = answers.filter((a) => a.correct).map((a) => a.ms);
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
  /** Concepts answered correctly this round that the student had got wrong
      at every earlier stage. Real movement, not a projection. */
  turnedAround: string[];
  /** Concepts still not right at any stage. Named plainly, not hidden. */
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
    flip is not evidence of anything.

    ── Unless they have been here before ────────────────────────────────────
    All of the above is the reasoning for a student's FIRST unscaffolded
    attempt, and it is spent the moment they have had one. On a return visit
    the question is no longer "how do we make this go well", it is "which
    three concepts is this round worth spending on", and the answer is the
    ones they could not say last time. Round 4 is capped at three, so a
    concept not hoisted here is one the return visit will never reach.

    `openFirst` only reorders. A concept still has to have been met in this
    session's rounds to be offered at all, and the ranking inside each group
    is exactly the ranking described above. */
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
    /* Still open beats everything below it, and nothing below it changes. */
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

/** Where a concept stands, in the strongest evidence the session collected.

    One vocabulary, used by three things that must agree: the results screen
    draws it, the record keeps it between runs, and the next run reads it back
    to decide what to lead with. It used to be spelled out on the results
    screen alone, where it was a local detail; the moment anything outlives the
    tab it becomes a shared contract and belongs here with the rest of them. */
export type Standing =
  /** Produced it, unscaffolded, and the grader agreed. */
  | "explained"
  /** Produced it and the grader called it nearly there. */
  | "almost"
  /** Produced it and the grader did not accept it. */
  | "not-yet"
  /** Never produced, but got it right somewhere on the ladder. */
  | "recognised"
  /** Met it and never got it right. */
  | "missed";

/** Where a concept finished, from its line on the results.

    A Round 4 grade wins when there is one, because producing an explanation
    with nothing on screen is the strongest evidence the session collects.
    Otherwise it comes down to whether they ever got it right at all, which is
    the only other thing the rounds actually establish. */
export function conceptStanding(line: ConceptLine): Standing {
  if (line.outcome === "solid") return "explained";
  if (line.outcome === "shaky") return "almost";
  if (line.outcome === "not-yet") return "not-yet";
  return line.reached > 0 ? "recognised" : "missed";
}

/** Whether a concept is finished with, in the only sense this app claims: the
    student said it in their own words and it held up. Everything else is still
    open, including "got it right", which is recognition and is exactly the
    thing this mode exists to stop people mistaking for understanding. */
export function isOpen(standing: Standing): boolean {
  return standing !== "explained";
}

export type Reveal = {
  open: StageScore | null;
  rounds: StageScore[];
  productions: Production[];
  concepts: ConceptLine[];
  bestStreak: number;
  /** The one number the results screen leads with. See `rating`. */
  rating: Rating;
  /** Per-stage splits and the total run, every stage included. */
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
