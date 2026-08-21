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
  /** "assemble": the chips, in the order they are laid out for the student.
      Decided on the server for the same reason option order is: an order
      chosen in the browser is an order nobody can measure. Absent only on
      questions that predate placement, where the presentation falls back to
      laying the pieces out itself.

      Nothing but the real chips is ever in here. Round 3 used to salt the tray
      with decoys, 0 to 2 by difficulty, and they made the round a hunt for the
      wrong words rather than the assembly of a right sentence. */
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
  /** The per-question timer ran out.

      Counted as wrong, the same as any other question the student did not
      get. It used to be held apart from wrong answers everywhere they were
      reported, on the argument that unanswered is not failed; the flag now
      only decides which word the verdict shows, "Time" rather than "Not
      quite", so you can still see what happened to it. */
  timedOut?: boolean;
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

    Every stage has one, Round 4 included. It used to stop at Round 3, on the
    argument that a running clock beside the one moment a student has to
    produce an explanation would push exactly the shallow, fast, half-formed
    answer that round exists to catch.

    What that produced in practice was a clock that visibly stopped when you
    reached the last round, which reads as broken rather than as principled,
    and there was no longer anything on screen explaining the gap. A run is
    now the whole run. Round 4 still has no per-question countdown and nothing
    hurries you through it: the only thing counting is the same clock that has
    been counting since the warm up, and it is the number the results report.

    `TIMED_STAGES` used to live here to name the stages the clock covered. It
    had no callers and is gone with the exception it described. */
export type Split = {
  stage: 0 | Round;
  ms: number;
};

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

/* ── There is no scoring ──────────────────────────────────────────────────
   There was: a hundred points a question, a combo multiplier climbing every
   two correct answers and capping at five, a running total on three screens
   and a personal best to beat.

   All of it is gone, and what is left is the clock and whether you got it
   right. The points were a number derived from those two facts and shown
   beside them, so they never said anything the student could not already see,
   and the multiplier was a number derived from the points. A student who
   answers six in a row quickly knows they are doing well; being told they have
   4,800 and a x4 is not more information, it is the same information wearing a
   costume, and it was the loudest thing on a screen built to be uncluttered.

   Time and correctness are the whole scoreboard now. */

/** How long feedback sits on screen before the next question.

    Correct answers move almost immediately: the student already knows, and
    the pace is the point. A miss holds longer, because the correct answer is
    on screen and nobody reads an answer they just got wrong in six hundred
    milliseconds. The feedback IS the intervention, so it gets the time it
    needs and an immediate manual advance for anyone faster. */
export const ADVANCE_MS = { correct: 620, wrong: 2100, timeout: 2400 } as const;
