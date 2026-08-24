import type { Outcome } from "../api/grade/route";

export type Difficulty = "easy" | "medium" | "hard";

export const TIERS: Difficulty[] = ["easy", "medium", "hard"];

export type Format =
  | "recognition"
  | "choice"
  | "blank"
  | "assemble"
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
  concept: string;
  difficulty: Difficulty;
  format: Format;
  prompt: string;
  options?: string[];
  answerIndex?: number;
  accepted?: string[];
  chips?: string[];
  tray?: string[];
  answer: string;
  because?: string;
  citation?: string;
};

export type Provenance =
  | "grounded"
  | "generated";

export type Answer = {
  questionId: string;
  concept: string;
  difficulty: Difficulty;
  format: Format;
  stage: 0 | Round;
  correct: boolean;
  ms: number;
  given: string;
  timedOut?: boolean;
};

export type Production = {
  concept: string;
  explanation: string;
  via: "voice" | "typed";
  outcome: Outcome;
};

export type Bank = {
  round: Round;
  questions: Question[];
};

export type Split = {
  stage: 0 | Round;
  ms: number;
};

export const WARM_UP_COUNT = 5;

export const QUESTIONS_PER_ROUND = 9;

export const QUESTION_SECONDS = 15;

export const PER_TIER = 5;

export const TARGET_LOW = 0.7;
export const TARGET_HIGH = 0.8;

export const ADVANCE_MS = { correct: 620, wrong: 2100, timeout: 2400 } as const;
