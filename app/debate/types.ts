export type Tab = "competitive" | "casual";

export const FORMATS = [
  "Lincoln-Douglas",
  "Public Forum",
  "Policy",
  "Parliamentary",
] as const;

export type Format = (typeof FORMATS)[number];

export const SPEECHES = ["Constructive", "Rebuttal", "Summary", "Final Focus"] as const;
export type Speech = (typeof SPEECHES)[number];

export type Side = "Pro" | "Con";

export function sideWord(side: Side): "For" | "Against" {
  return side === "Pro" ? "For" : "Against";
}

export const TIERS = [
  {
    id: "novice" as const,
    name: "Novice",
    brief:
      "Argues in good faith, makes one clear point per speech, misses some of what you said.",
  },
  {
    id: "varsity" as const,
    name: "Varsity",
    brief: "Signposts, weighs, and will punish a dropped argument.",
  },
  {
    id: "circuit" as const,
    name: "Circuit",
    brief: "Fast, technical, turns your own framework against you.",
  },
] as const;

export type TierId = (typeof TIERS)[number]["id"];

export function tier(id: TierId | undefined) {
  return TIERS.find((t) => t.id === id) ?? TIERS[1];
}

export type Turn = {
  speaker: "user" | "opponent";
  speech: Speech;
  text: string;
};

export const MIN_WORDS_TO_JUDGE = 20;

export function wordsSpoken(turns: Turn[]): number {
  return turns
    .filter((t) => t.speaker === "user")
    .reduce((sum, t) => {
      const text = t.text.trim();
      return sum + (text ? text.split(/\s+/).length : 0);
    }, 0);
}

export function worthJudging(turns: Turn[]): boolean {
  return wordsSpoken(turns) >= MIN_WORDS_TO_JUDGE;
}

export type Setup = {
  tab: Tab;
  motion: string;
  side: Side;
  tierId?: TierId;
  format?: Format;
};

export const DIMENSIONS = ["logic", "evidence", "rebuttal", "structure", "clarity"] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export type Scores = Record<Dimension, number>;

export type KeyMoment = {
  speaker: "user" | "opponent";
  quote_paraphrase: string;
  why_it_mattered: string;
};

export type Ballot = {
  winner: "user" | "opponent" | "draw";
  scores: { user: Scores; opponent: Scores };
  margin: number;
  key_moments: KeyMoment[];
  feedback: Feedback;
  feedback_opponent: Feedback;
};

export type Feedback = {
  biggest_strength: string;
  biggest_weakness: string;
  one_fix_for_next_round: string;
};

export const SPEECH_ORDER: Speech[] = ["Constructive", "Rebuttal", "Summary", "Final Focus"];
