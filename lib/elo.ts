/* Debate ratings, computed here and nowhere else.

   The model returns a winner, a margin and five dimension scores. It never
   returns a rating, and it is never shown one. That separation is the whole
   reason this file exists: a language model asked to "update the ELO" will
   produce a number that looks like arithmetic and is not, and the failure is
   invisible because every value it returns is plausible. Ratings move by
   integer arithmetic over a value we already held, or they do not move.

   Everything here is pure. No storage, no fetch, no clock. */

/** Where every debater starts.

    Zero, and the tiers in app/debate/types.ts are rated relative to it: Novice
    sits below a beginner, Varsity level with one, Circuit well above. That
    relationship is the only thing an ELO calculation actually uses, so moving
    the whole scale down by 1200 changes nothing about the maths and changes
    everything about the first screen. A number that starts at 1200 has to be
    explained before it means anything; a number that starts at 0 and goes up
    explains itself.

    What is given up is the convention. 1200 is where chess and most rating
    systems start, so somebody who already knew that scale could read their
    number without learning ours. Nobody arriving here is comparing this to a
    chess rating, and the cost of the convention was a paragraph on the busiest
    screen in the mode. */
export const START = 0;

/** The base step, before the margin scales it. Chess uses 32 for unrated and
    casual play, and this is closer to casual play than to a title norm. */
export const K_BASE = 32;

/** The floor, and it is the starting point.

    A rating that can fall forever stops being information and starts being a
    punishment for having practised on a bad week, and that was true when the
    floor was 100 points below a start of 1200. With the scale rebased it is
    true and also simple: the number goes up from zero and never below it, so
    the first bad round costs nothing and there is no negative rating for
    anybody to feel about. */
export const FLOOR = 0;

/* ── The ladder ───────────────────────────────────────────────────────────
   One rating spans both modes, so it needs rungs. A bare integer that only
   goes up answers "did that round help" and cannot answer "am I any good",
   and the second question is the one somebody actually has about a number
   with no leaderboard behind it.

   Seven rungs. It was four, and four across a range a player actually
   occupies meant most of a career spent watching one word not change: a
   hundred and fifty points of Fresh, then two hundred and fifty of Sharp.
   The rung is the thing a person is climbing toward, so there has to be one
   close enough to be worth climbing toward, and the gaps here are set so the
   next one is always in sight without any of them arriving by turning up.

   ── Where each rung sits, and what it means ──────────────────────────────
   A rating stops moving when the system's expectation matches the player's
   real win rate, so every threshold has an exact meaning that can be read off
   `expected` rather than picked because it was round. Against the tiers in
   app/debate/types.ts, each of these is the win rate that settles there:

     Fresh          0   you have started
     Steady       110   ~78% against Novice, or ~58% against Varsity
     Sharp        230   ~73% against Varsity
     Dangerous    360   ~86% against Varsity, or ~62% against Circuit
     Feared       470   ~75% against Circuit
     Untouchable  580   ~84% against Circuit
     Legend       720   ~93% against Circuit

   The top rung is meant to sit just past the edge of what anybody reaches.
   That is a different thing from the 750 it replaced, which was past the edge
   of what the maths could produce at all: a ladder needs something at the top
   nobody has, and it must still be a number the arithmetic can arrive at.

   The word is what the ladder IS; the colour in the interface is a second
   channel over the top of it. See the `--rank-*` block in globals.css. */

export type Rank = {
  /** Which of the seven, and which step of the colour spectrum it draws in. */
  id: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  name: string;
  /** The rating this rung starts at. */
  from: number;
  /** What holding it says about you, in the plainest terms available.

      Every one of these is the win rate that actually settles at the
      threshold, said as a sentence rather than a percentage. It is here
      rather than in the component because it is a fact about the maths: move
      a threshold or a tier strength and this line becomes wrong, and it
      should be wrong in the file where the change was made. */
  means: string;
};

export const RANKS: readonly Rank[] = [
  { id: 1, name: "Fresh", from: 0, means: "You have started." },
  { id: 2, name: "Steady", from: 110, means: "You beat Novice most times out." },
  { id: 3, name: "Sharp", from: 230, means: "You take about seven rounds in ten off Varsity." },
  { id: 4, name: "Dangerous", from: 360, means: "Varsity rarely beats you, and Circuit sometimes loses." },
  { id: 5, name: "Feared", from: 470, means: "You take three rounds in four off Circuit." },
  { id: 6, name: "Untouchable", from: 580, means: "Circuit beats you about one time in six." },
  { id: 7, name: "Legend", from: 720, means: "Circuit almost never beats you." },
] as const;

export function rankFor(rating: number): Rank {
  let found = RANKS[0];
  for (const rank of RANKS) if (rating >= rank.from) found = rank;
  return found;
}

/** The rung above, or null at the top. */
export function nextRank(rating: number): Rank | null {
  return RANKS.find((r) => rating < r.from) ?? null;
}

/** How far through the current rung, 0 to 1. Full at the top rung, because a
    bar that can never fill is a bar that reads as broken. */
export function progress(rating: number): number {
  const here = rankFor(rating);
  const next = nextRank(rating);
  if (!next) return 1;
  return Math.min(1, Math.max(0, (rating - here.from) / (next.from - here.from)));
}

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

/* ── The other way onto the same ladder ───────────────────────────────────
   Round Mode moves this rating too, and it has no opponent. That is the
   whole difficulty: ELO is a comparison, and a study run compares you to
   nothing. The tempting answer is to convert the run's points into rating
   points directly, and it is wrong in a way that would quietly ruin the
   number. Points scale with how many questions were served, so the fastest
   route up the ladder would be long easy runs on a topic already known,
   which is the one activity the mode exists to talk somebody out of.

   So a run is scored as a match, and the material is the opponent. What you
   scored against it is the share you actually earned rather than a win or a
   loss, because a run reports a percentage and ELO is happy to take one: a
   0.8 against material rated at your level is a win, a 0.5 is not, and the
   arithmetic is the same formula the debate side uses.

   Two things have to come out of the run to make that work, and `rating()`
   in the round engine already computes both. */

/** How much the run was worth if nothing had been missed, at the point where
    the material is rated level with a debater sitting at zero.

    Read off the engine's own weights rather than guessed: a full ladder of
    five questions a stage, plus three explanations graded in Round 4, comes
    to a little over 1500 across 23 items, which is about 68 a question. That
    run is a real piece of work and it is what "level" should mean. */
const LEVEL_DEMAND = 68;

/** Rating points per point of demand. Set so that a run that stops after the
    multiple choice (about 30 a question) rates as Novice-ish material and a
    run of nothing but hard production rates above Circuit. */
const DEMAND_SLOPE = 8;

/** What a full run is worth, for scaling how far a result moves the rating.
    A session abandoned after the warm up is thin evidence and moves the
    number accordingly; nothing moves it further than one debate does. */
const FULL_RUN = 1200;

/** How far a study run alone can carry the rating.

    ── The problem this fixes ───────────────────────────────────────────────
    Run the numbers and the fastest route to the top of this ladder was not
    debating. A student repeating study runs at a 95% share settled above 500,
    and at a perfect share kept climbing past 750, which was then the top rung
    of the whole ladder, without ever arguing with anybody. Reaching the same
    place through debate wanted a win rate around 90% against Varsity.

    The thresholds are quoted as numbers rather than rung names on purpose:
    the rungs have been renamed and remapped since, and a comment about what
    went wrong should stay true across that rather than quietly describing a
    different rung than the one it was written about.

    The two are not comparable and the arithmetic was treating them as though
    they were. A 95% share means you got nineteen questions out of twenty
    right on a topic you had just studied, which most people can do on a good
    day; a 95% win rate against an opponent trying to take the round off you
    is not a thing that happens. Feeding both through the same logistic and
    reading the results as one standing produced a number that rewarded the
    easier activity for being easier.

    ── Why a ceiling rather than a recalibration ────────────────────────────
    Lowering what the material is rated at, or bending the share curve, both
    move the equilibrium a bit and neither addresses the shape of the problem,
    which is that share and win rate do not mean the same thing at the top of
    their range. A ceiling says the true thing outright and can be explained
    in one sentence, which the ladder panel does say: Round Mode tops out at
    the rung below `STUDY_STOPS_BELOW`, and everything above it is earned
    against an opponent.

    Study owns the bottom three rungs and debate owns the top four. A run can
    carry somebody to the last rating inside Sharp and no further.

    Named rather than indexed. This was `RANKS[2].from - 1` when there were
    four rungs, which was correct and was correct only by accident of where
    Feared happened to sit in the array; adding rungs moved index 2 and would
    have silently dropped the ceiling by a hundred and thirty points with
    nothing failing. What the ceiling means is "just under this rung", so that
    is what it says.

    Above the ceiling a run leaves the rating alone entirely rather than
    dragging it down. A ratchet that only debates could climb and study runs
    could slide would punish a strong debater for revising, which is the one
    thing this app should never do. */
export const STUDY_STOPS_BELOW = "Dangerous";
const RUN_CEILING = (RANKS.find((r) => r.name === STUDY_STOPS_BELOW)?.from ?? 360) - 1;

/** The material's strength, on the same scale the debate tiers sit on.

    Difficulty per question rather than total, which is the part that makes
    the ladder honest: twice as many questions is twice as much evidence, not
    a harder opponent, and it is handled by `k` below instead. */
export function materialStrength(possible: number, items: number): number {
  if (items <= 0) return 0;
  const demand = possible / items;
  return Math.max(-400, Math.min(400, Math.round((demand - LEVEL_DEMAND) * DEMAND_SLOPE)));
}

/** One finished run, applied. Same ladder, same arithmetic, different match. */
export function applyRun({
  user,
  share,
  possible,
  items,
}: {
  user: number;
  /** `earned / possible` for the run, 0 to 1. */
  share: number;
  possible: number;
  /** How many things were scored: questions served plus explanations graded. */
  items: number;
}): RatingChange {
  const opponent = materialStrength(possible, items);
  const chance = expected(user, opponent);
  const scored = Math.min(1, Math.max(0, share));

  /* Already past what a study run can speak to. The round still happened and
     the results screen still shows everything it showed before; the one thing
     it does not do is move a number this activity cannot support. */
  if (user >= RUN_CEILING) {
    return { before: user, after: user, delta: 0, expected: chance };
  }

  /* Same floor as the debate side and for the same reason: a run that moves
     nothing reads as the app having ignored it. */
  const k = K_BASE * Math.max(0.2, Math.min(1, possible / FULL_RUN));
  const raw = user + k * (scored - chance);
  const after = Math.min(RUN_CEILING, Math.max(FLOOR, Math.round(raw)));

  return { before: user, after, delta: after - user, expected: chance };
}
