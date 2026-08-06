import type { Outcome } from "../api/grade/route";

/* Round Mode: the shapes shared by the generator and the session.

   Nothing here is persisted. A session lives in memory for as long as the tab
   does, by design: there are no accounts yet, so there is nowhere honest to
   put it. */

export type Difficulty = "easy" | "medium" | "hard";

/** Difficulty as an ordered list, so a tier can be stepped up or down. */
export const TIERS: Difficulty[] = ["easy", "medium", "hard"];

/* ── The ladder ───────────────────────────────────────────────────────────
   One concept set, five stages, and at every stage the scaffolding under the
   student is taken away one piece at a time. Recognition asks only "have you
   seen this before". Production asks "can you say it with nothing in front of
   you". The gap between those two answers is the entire product. */

export type Format =
  /** Warm up. Two options, answered on sight, before any studying. */
  | "recognition"
  /** Round 1. Four options. */
  | "choice"
  /** Round 2. A sentence with the key term missing, typed. */
  | "blank"
  /** Round 3. The sentence itself is gone; its pieces are on the table. */
  | "assemble"
  /** Round 4. Nothing on screen. Their own words, spoken or typed. */
  | "open";

export type Round = 1 | 2 | 3 | 4;

export const ROUND_FORMAT: Record<Round, Format> = {
  1: "choice",
  2: "blank",
  3: "assemble",
  4: "open",
};

/** What the student is being asked to do, in the words the screen uses. */
export const ROUND_TITLE: Record<Round, string> = {
  1: "Pick it out",
  2: "Fill the gap",
  3: "Build the sentence",
  4: "Say it yourself",
};

/** What each stage still gives away, as the share you would expect to get
    right by guessing alone.

    This number exists so the results screen can never quietly compare two
    scores that were never the same test. Three out of five on a two-option
    question and three out of five on open production are different events.

    These hold because option order is placed rather than generated: see
    shuffle.ts. A model that puts the correct answer first three times in four
    turns the 0.25 below into something closer to 0.75 for anyone who notices,
    and every figure downstream of it into fiction. */
export const CHANCE: Record<Format, number> = {
  recognition: 0.5,
  choice: 0.25,
  blank: 0,
  /* Not strictly zero: with five chips and no distractors there are a hundred
     and twenty orderings, so blind luck is under one percent. Close enough to
     zero that calling it zero would be the honest simplification, but it is
     shown as its own thing rather than folded in with typed recall. */
  assemble: 0.01,
  open: 0,
};

export type Question = {
  id: string;
  /** Which concept this tests. Rounds escalate on the same concepts, so this
      is what ties a cold-open question to its Round 3 counterpart. */
  concept: string;
  difficulty: Difficulty;
  format: Format;
  prompt: string;
  /** "recognition" and "choice". */
  options?: string[];
  /** Index into `options`. */
  answerIndex?: number;
  /** "blank": what counts as right beyond the canonical answer. Matching is
      done locally so feedback can be instant. */
  accepted?: string[];
  /** "assemble": the correct sentence, already broken into chips in order. */
  chips?: string[];
  /** "assemble": plausible chips that do not belong in the sentence. */
  distractors?: string[];
  /** "assemble": the chips and distractors together, in the order they are
      laid out for the student. Decided on the server for the same reason
      option order is: an order chosen in the browser is an order nobody can
      measure. Absent only on questions that predate placement, where the
      presentation falls back to laying the pieces out itself. */
  tray?: string[];
  /** The canonical correct answer, always shown in feedback. */
  answer: string;
  /** One line on why, shown after the answer. Never shown before it. */
  because?: string;
  /** Verbatim span from the student's own material behind this question.
      Present only in grounded sessions, and only once the server has
      confirmed it really appears in what they pasted. */
  citation?: string;
};

/** Where a session's questions came from. The student is told which, on
    every screen, and invented material is never implied to be theirs. */
export type Provenance =
  /** Written from the student's pasted notes. Every question cited. */
  | "grounded"
  /** Written from a topic alone. Not their material, and said so. */
  | "generated";

export type Answer = {
  questionId: string;
  concept: string;
  difficulty: Difficulty;
  format: Format;
  /** 0 for the warm up, 1 to 4 for the rounds. */
  stage: 0 | Round;
  correct: boolean;
  /** Time from the question appearing to the answer landing. */
  ms: number;
  /** What the student actually picked, typed or assembled. */
  given: string;
  /** The per-question timer ran out. Never counted as a wrong answer in
      anything the student is shown: an unanswered question is not a failed
      one. It does still ease the difficulty ladder, which is a separate
      judgement and explained where that happens. */
  timedOut?: boolean;
  /** Points this answer scored, after the combo multiplier. */
  points?: number;
};

/** One open production in Round 4, with the grade it came back with. */
export type Production = {
  concept: string;
  /** What they actually said or typed. */
  explanation: string;
  /** Whether it arrived by voice or keyboard, for the record only. */
  via: "voice" | "typed";
  outcome: Outcome;
};

/** A round's questions, generated one round ahead of the student. */
export type Bank = {
  round: Round;
  questions: Question[];
};

/** A stage's elapsed time, in the speedrun sense: how long that leg took.

    The clock runs across the warm up and Rounds 1 to 3 and stops there.
    Round 4 is deliberately outside it. Speed on a four-option question is a
    fair thing to chase; speed on the one moment a student has to produce an
    explanation in their own words is not, and putting a running clock next to
    that would push exactly the shallow, fast, half-formed answer the round
    exists to catch. The results screen says so rather than leaving the gap
    unexplained. */
export type Split = {
  stage: 0 | Round;
  ms: number;
};

/** Stages the speedrun clock covers. */
export const TIMED_STAGES: (0 | Round)[] = [0, 1, 2, 3];

/* ── The numbers the session runs on ─────────────────────────────────────── */

export const WARM_UP_COUNT = 5;

/** Questions served per round. Enough to feel like a round rather than a
    handful, short enough that the ladder is still climbing at the end. */
export const QUESTIONS_PER_ROUND = 9;

/** Per question, not per round. A round timer makes the last question of a
    round worth less than the first, which is exactly backwards. */
export const QUESTION_SECONDS = 15;

/** Generated per tier, per round. Three tiers, so fifteen a round: a student
    who eases to the bottom tier and stays there for a whole round still has
    unasked easy questions when it ends. */
export const PER_TIER = 5;

/** The retrieval success band to aim for. Below the floor, the next question
    gets easier. This is a research requirement, not a comfort setting:
    retrieval practice that mostly fails, with the answer supplied every time,
    stops being retrieval and becomes reading. */
export const TARGET_LOW = 0.7;
export const TARGET_HIGH = 0.8;

/* ── Scoring ──────────────────────────────────────────────────────────────
   A game layer, and kept visibly separate from the diagnosis. Points and
   combos run during the rounds; the results screen at the end does not use
   them, because how it felt is not evidence of what was learned. */

export const BASE_POINTS = 100;

/** The multiplier at a given run of consecutive correct answers.

    It climbs every two, which is fast enough that a student feels it move
    inside a single round, and caps at five so a good run stays worth
    something without making the first miss of a long streak feel like a
    catastrophe. */
export const MAX_COMBO = 5;

export function comboMultiplier(streak: number): number {
  if (streak <= 1) return 1;
  return Math.min(MAX_COMBO, 1 + Math.floor(streak / 2));
}

/** How long feedback sits on screen before the next question.

    Correct answers move almost immediately: the student already knows, and
    the pace is the point. A miss holds longer, because the correct answer is
    on screen and nobody reads an answer they just got wrong in six hundred
    milliseconds. The feedback IS the intervention, so it gets the time it
    needs and an immediate manual advance for anyone faster. */
export const ADVANCE_MS = { correct: 620, wrong: 2100, timeout: 2400 } as const;
