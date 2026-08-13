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

/** The side, as it is said to a person.

    "Pro" and "Con" stay in the prompts, because that is the vocabulary a
    model has actually read a lot of debates in and swapping it for plain
    English there would trade accuracy for a nicety nobody sees. On screen
    they are "For" and "Against", which is what the setup screen's two buttons
    already said: somebody who pressed "Argue against" should not be told a
    moment later that they are Con, and a person who has never been to a
    tournament should not have to learn a word to read their own ballot. */
export function sideWord(side: Side): "For" | "Against" {
  return side === "Pro" ? "For" : "Against";
}

/** How hard the opponent argues, and what that is worth.

    The strength attached to each tier is the point of having tiers at all. ELO
    is a relative measure: rating somebody against one fixed opponent produces
    a monotonic restatement of their win rate, not a rating, and it cannot
    support the comparison the number invites. Three tiers with declared
    strengths make a rating mean something, because it means that much against
    opposition whose strength was declared in advance.

    ── Why these numbers, and what was wrong with the last set ───────────────
    They were -300, 0 and 350, which were the old 1000/1300/1650 gaps moved so
    that a beginner started level with Varsity. The gaps were preserved and the
    thing they were preserved against was not: on the old scale a player began
    at 1200 with a thousand points of room beneath them, and on this one they
    begin at 0 with a floor at 0. Every point of Novice's -300 was under that
    floor.

    What that did to a beginner is the whole reason these moved. Rated -300
    against a player at 0, Novice is an opponent you are expected to beat 85%
    of the time, so a win is worth almost nothing and the rating cannot rise:
    a student who picked the gentlest opponent and beat it four times out of
    five settled at exactly 0 and stayed there. They won, and the number never
    moved. That is the worst feedback this app can give, and it was aimed
    squarely at the people least able to read past it.

    The three now sit where a player standing at 0 is expected to take 67% off
    Novice, 43% off Varsity and 17% off Circuit. The spread is narrower than it
    was, which is the correction rather than a compromise: tiers are only ever
    used as a difference from the player's rating, and a 650-point spread was
    calibrated for a scale where the player had room to move underneath it.
    Players live between 0 and about 600 here, so the opposition has to.

    `strength` rather than `rating`, because there is only one rating in this
    app and it belongs to the person playing. A second number called a rating,
    sitting on a button next to theirs, was two things with one name. */
export const TIERS = [
  {
    id: "novice" as const,
    name: "Novice",
    strength: -125,
    brief:
      "Argues in good faith, makes one clear point per speech, misses some of what you said.",
  },
  {
    id: "varsity" as const,
    name: "Varsity",
    strength: 50,
    brief: "Signposts, weighs, and will punish a dropped argument.",
  },
  {
    id: "circuit" as const,
    name: "Circuit",
    strength: 275,
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

/* ── Was there a round here at all ────────────────────────────────────────
   A judge call reads a whole transcript and writes a structured ballot, and
   it is the most expensive thing either mode does. Spending one to be told
   that somebody who typed "no" did not win the debate is a bill for an answer
   nobody needed, and the ballot that comes back is worse than useless: the
   contract demands a strength, so the model reaches for something, and what
   it reaches for is whatever argument is in the transcript, which on a round
   like that belongs to the opponent.

   The prompt is told to handle this honestly and mostly does. This is the
   half that does not depend on a model behaving: a round nobody argued is
   recognisable from the text alone, and it costs nothing to look.

   Shared by the route and the screen on purpose. The route is the one that
   has to be right, because it is the one that spends the money; the screen
   uses it to grey the button out so the trip is never made. Two thresholds
   that could drift apart would mean a button that offers something the
   server then refuses. */

/** The least a person can say across a whole round and still have debated.

    Twenty words, which is about one real sentence of argument. Deliberately
    far below anything a genuine attempt reaches: "Homework wastes hours kids
    could spend on things they actually chose" is twelve words and a real
    argument, and two of those clear this comfortably. The bar is not "was
    this good", which is the judge's job. It is "did anything happen". */
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
