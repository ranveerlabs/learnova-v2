/* Debate ratings, computed here and nowhere else.

   The model returns a winner, a margin and five dimension scores. It never
   returns a rating, and it is never shown one. That separation is the whole
   reason this file exists: a language model asked to "update the ELO" will
   produce a number that looks like arithmetic and is not, and the failure is
   invisible because every value it returns is plausible. Ratings move by
   integer arithmetic over a value we already held, or they do not move.

   Everything here is pure. No storage, no fetch, no clock. */

/** Where every debater starts. 1200 is the conventional entry point and is
    kept for exactly that reason: somebody who has debated before knows what
    1200 means and does not have to learn a private scale. */
export const START = 1200;

/** The base step, before the margin scales it. Chess uses 32 for unrated and
    casual play, and this is closer to casual play than to a title norm. */
export const K_BASE = 32;

/** The floor. A rating that can fall forever stops being information and
    starts being a punishment for having practised on a bad week. */
export const FLOOR = 100;

export type Outcome = "user" | "opponent" | "draw";

/** What one side actually scored, in the 0 to 1 the formula wants. */
function score(outcome: Outcome): number {
  if (outcome === "user") return 1;
  if (outcome === "opponent") return 0;
  return 0.5;
}

/** The chance the rating system expected the user to win, before the round.

    Standard logistic curve on the 400-point scale, which is what makes the
    numbers comparable to every other ELO anybody has seen. */
export function expected(user: number, opponent: number): number {
  return 1 / (1 + 10 ** ((opponent - user) / 400));
}

/** How hard this result should move the rating.

    ── Why the margin is in here ────────────────────────────────────────────
    A judge that only says who won hands us one bit per round, and one bit is
    exactly the input most vulnerable to a judge that is not perfectly
    consistent: a round the model calls 51/49 moves the rating as far as one
    it calls 95/5, and half of those calls will land differently if the same
    transcript is judged twice.

    Scaling by the margin does not remove that noise, but it does stop the
    coin-flip rounds from dominating the rating, because the rounds a judge is
    least sure about are exactly the ones it reports the smallest margin on.
    A razor-thin win moves a rating about a fifth as far as a blowout.

    A draw ignores the margin, which has no meaning there, and takes the base. */
export function kFor(margin: number, outcome: Outcome): number {
  if (outcome === "draw") return K_BASE;
  const clamped = Math.min(10, Math.max(1, Math.round(margin)));
  /* Never below a fifth of the base: a win that moves nothing reads as the
     app having ignored the round. */
  return K_BASE * (0.2 + 0.08 * clamped);
}

export type RatingChange = {
  before: number;
  after: number;
  delta: number;
  /** What the system thought the user's chances were, 0 to 1. Shown, because
      "you were expected to lose that and did not" is the whole content of a
      rating change and the bare number hides it. */
  expected: number;
};

/** One round, applied.

    The opponent's rating is an input rather than something that also moves.
    The opponent is an AI at a chosen strength, not a player with a career:
    its rating is the definition of that strength and drifting it would mean
    the same tier meant something different every week. */
export function applyRound({
  user,
  opponent,
  outcome,
  margin,
}: {
  user: number;
  opponent: number;
  outcome: Outcome;
  margin: number;
}): RatingChange {
  const chance = expected(user, opponent);
  const k = kFor(margin, outcome);
  const raw = user + k * (score(outcome) - chance);
  const after = Math.max(FLOOR, Math.round(raw));

  return { before: user, after, delta: after - user, expected: chance };
}
