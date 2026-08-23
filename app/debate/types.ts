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

/** How hard the opponent argues.

    Each tier used to carry a `strength` as well: a number in rating points
    the elo was computed against, -125, 50 and 275, tuned so that a player at
    0 was expected to take 67% off Novice, 43% off Varsity and 17% off
    Circuit. It was the load-bearing half of the tier, and the argument for
    having tiers at all was that a rating means nothing unless the opposition
    has a declared strength.

    There is no rating now, and no record either, so there is nothing to
    declare a strength to. What is left is the half a student could always
    actually feel: how hard this opponent argues, and the brief that says so,
    which is what reaches the prompt in app/api/debate/route.ts.

    The tiers are not a lesser thing for having lost the number. Choosing an
    opponent who will punish a dropped argument is why somebody preparing for
    a tournament opens the fold, and that was never about what beating it was
    worth. */
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

/** The tier a round is being argued against, if there is one.

    `undefined` is a real answer rather than a missing argument. A live 1v1
    room has no tier, because the opponent is a person and there is no model
    to set a difficulty for. The fallback is kept for a bad id, which is still
    a bug, but an absent one is a live round and every caller that actually
    needs a brief is on the single-player path where one was chosen. */
export function tier(id: TierId | undefined) {
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
  /** Which opponent the model is playing. Absent in a live 1v1 room, where
      the opponent is a person and there is nothing to declare a strength
      for. Every path that reads a strength off this is a single-player path
      where one was chosen on the setup screen. */
  tierId?: TierId;
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
  /** Written about the person reading it. */
  feedback: Feedback;
  /** The same three lines about the other chair.

      Single-player never shows these: there is nobody on the other side who
      wants coaching, and printing the model's notes on its own performance
      would be the mode talking about itself. They exist for the live room,
      where the other chair is a person, only one of the two tabs calls the
      judge, and `mirror` has to be able to hand each of them their own.

      Before this existed `mirror` turned over the winner, the scores and
      the key moments and left `feedback` alone, so both players read the
      host's strength and the host's weakness as though it were theirs. The
      guest was told they named Studio and limiteds when the host had, and
      told their own rebuttal was gibberish when it was the host's. That is
      the one class of error a debater cannot catch from the screen. */
  feedback_opponent: Feedback;
};

export type Feedback = {
  biggest_strength: string;
  biggest_weakness: string;
  one_fix_for_next_round: string;
};

/** How many exchanges a round runs for. Four speeches each way is a real
    debate and about as much typing as anybody will do in one sitting. */
export const SPEECH_ORDER: Speech[] = ["Constructive", "Rebuttal", "Summary", "Final Focus"];
