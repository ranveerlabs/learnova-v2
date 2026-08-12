/* Debate mode: the shapes shared by the route and the screens.

   Two tabs, kept apart everywhere they touch. A competitive round is judged
   by the conventions of a named format against a tournament bar; a casual one
   is judged on whether the argument holds up. They do not share a rubric and
   they do not share a rating, because the competitive number is only worth
   having if it means one thing. */

export type Tab = "competitive" | "casual";

/** The formats the competitive judge knows, and the only ones it may be
    asked for. Judging Lincoln-Douglas by Public Forum conventions is the
    fastest way to make a competitive debater stop believing the ballot. */
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

/** How hard the opponent argues, and what that is worth.

    The rating attached to each tier is the point of having tiers at all. ELO
    is a relative measure: rating somebody against one fixed opponent produces
    a monotonic restatement of their win rate, not a rating, and it cannot
    support the comparison the number invites. Three tiers with declared
    strengths make "1450" mean something, because it means 1450 against
    opposition whose strength was declared in advance. */
export const TIERS = [
  {
    id: "novice" as const,
    name: "Novice",
    rating: 1000,
    brief:
      "Argues in good faith, makes one clear point per speech, misses some of what you said.",
  },
  {
    id: "varsity" as const,
    name: "Varsity",
    rating: 1300,
    brief: "Signposts, weighs, and will punish a dropped argument.",
  },
  {
    id: "circuit" as const,
    name: "Circuit",
    rating: 1650,
    brief: "Fast, technical, turns your own framework against you.",
  },
] as const;

export type TierId = (typeof TIERS)[number]["id"];

export function tier(id: TierId) {
  return TIERS.find((t) => t.id === id) ?? TIERS[1];
}

/** One thing somebody said, in order. The transcript is the whole input to
    the judge, so this is the only record of the round that matters. */
export type Turn = {
  speaker: "user" | "opponent";
  /** Which speech this was, for the formats that care. */
  speech: Speech;
  text: string;
};

export type Setup = {
  tab: Tab;
  /** The motion, for competitive. The subject, for casual. */
  motion: string;
  side: Side;
  tierId: TierId;
  /** Competitive only. Absent on a casual round, where there are no format
      conventions to judge against. */
  format?: Format;
};

/* ── What the judge returns ───────────────────────────────────────────────
   The contract, exactly as the prompts state it. Winner, margin and the
   per-dimension scores are kept as separate fields rather than folded into
   one verdict, so the weighting can be changed later without re-running a
   single round through the model again. */

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
  /** 1 razor-thin to 10 blowout. Scales how far the rating moves. */
  margin: number;
  key_moments: KeyMoment[];
  feedback: {
    biggest_strength: string;
    biggest_weakness: string;
    one_fix_for_next_round: string;
  };
};

/** How many exchanges a round runs for. Four speeches each way is a real
    debate and about as much typing as anybody will do in one sitting. */
export const SPEECH_ORDER: Speech[] = ["Constructive", "Rebuttal", "Summary", "Final Focus"];
