import { NextResponse } from "next/server";
import { AIError, chatJSON, chatStream } from "@/lib/ai";
import { createSpeechFilter } from "./scrub";
import {
  type Ballot,
  DIMENSIONS,
  type Format,
  type Setup,
  type Side,
  type Speech,
  SPEECHES,
  type Turn,
  tier,
  type TierId,
  worthJudging,
} from "@/app/debate/types";

/* Debate mode's one route. Two jobs, told apart by `action`:

   "reply"  the opponent's next speech, as prose.
   "judge"  the ballot for a finished round, as strict JSON.

   They are separate calls on purpose, and not only for tidiness. The judge
   must not be the same conversation that argued one of the sides: a model
   asked to mark a round it just spoke in is marking its own homework, and
   even with no intent to favour itself it will prefer arguments phrased the
   way it phrases things. Every judge call here starts cold, sees a transcript
   with two anonymous sides, and is told nothing about who wrote which. */

/* ── The opponent ─────────────────────────────────────────────────────────
   The spec this was built from defined the judge and the rating maths and
   left the opponent out, which is the part that decides whether a rating
   means anything: a number earned against one fixed adversary is a win rate
   wearing a rating's clothes. So the opponent argues at a declared strength,
   the strength has a rating attached, and the ballot is scored against it.

   It argues to win. An opponent that quietly goes easy is worse than no
   opponent at all, because the student cannot tell it happened and neither
   can their rating. What changes between tiers is craft, not effort. */

const OPPONENT_CRAFT: Record<TierId, string> = {
  novice: `You are in your first year of debate. One argument per speech, backed by a plain example anybody would recognise. You sometimes miss one of their points, and that is fine: do not manufacture an answer to everything. No jargon.`,
  varsity: `You are solid varsity. Answer their arguments by name rather than in general, and weigh at least once: even if they win their point, say why yours decides the round anyway. If they dropped something, say so and say what it concedes.`,
  circuit: `You are national circuit. Technical, fast and precise. Go down their case argument by argument, collapse to your strongest offence in the later speeches, and weigh on magnitude, probability and timeframe. If they handed you a framework, argue under it and turn it. Do not simplify for comfort.`,
};

/* ── What each speech is for ──────────────────────────────────────────────
   The opponent used to get the same instruction for all four speeches, which
   is why all four came back the same: a wall of fresh argument with a summary
   bolted on the end, whatever the round actually needed at that point. A
   debate has a shape. The first speech builds, the second attacks, the third
   collapses, the fourth chooses one thing and says it. Getting that wrong is
   the single most obvious way an opponent stops reading as a debater, and it
   also teaches the student the wrong shape, which is worse. */

const SPEECH_BRIEF: Record<Speech, string> = {
  Constructive: `Build your own case. Two arguments at most. Each one needs a reason it is true and a reason it matters. You may glance at what they said, but do not spend this speech on them.`,
  Rebuttal: `Attack their case. Take their arguments in the order they made them and say why each fails: it is not true, it does not follow, or it does not matter even if it is. No new offence of your own.`,
  Summary: `Collapse. Pick the one or two things you are actually winning, say why they decide the round, and answer their best response to them. Nothing new.`,
  "Final Focus": `One voter. Say what you are winning, why it outweighs whatever they are winning, and stop. Nothing new and no line-by-line.`,
};

/** How long a speech runs, by what it is for and who is giving it.

    These are much shorter than they were, and the reason is the medium rather
    than the format. A real Final Focus is two minutes of speech, which is
    about three hundred words; three hundred words arriving as a block of text
    on a screen, after a wait, is not two minutes of speech, it is an essay the
    student will skim. What a debater has to do to the last speech of a round
    is choose, and a tight budget is the thing that forces the choice.

    Circuit gets more than novice because it has more to fit, not because it
    is allowed to ramble. `scrub` enforces these; the prompt only asks. */
const BUDGET: Record<Speech, Record<TierId, number>> = {
  Constructive: { novice: 85, varsity: 110, circuit: 125 },
  Rebuttal: { novice: 85, varsity: 110, circuit: 125 },
  Summary: { novice: 65, varsity: 80, circuit: 90 },
  "Final Focus": { novice: 45, varsity: 55, circuit: 60 },
};

/* ── How it sounds ────────────────────────────────────────────────────────
   The complaint this exists to answer is that the opponent sounded like a
   model rather than like a person arguing. Almost all of that is one thing:
   asked for a speech, a model writes an essay. Essays open by announcing what
   they will do, march through numbered points on connective tissue nobody
   says out loud, and close by summarising themselves. A debater does none of
   that, because a debater is speaking to somebody who is standing right there
   and can interrupt.

   So the instruction is not "sound natural", which means nothing to a model.
   It is a list of the specific habits, and a ban on the specific phrases. The
   phrase list is also the list `scrub` cleans up afterwards, because being
   told not to write "Furthermore" is not the same as not writing it. */

const VOICE = `HOW YOU SOUND. You are speaking out loud to somebody standing across from you. You are not writing an essay.

- Open on the argument itself. No throat clearing, no thanking anyone, no restating the motion back at them.
- Never write any of these: "Firstly", "Secondly", "Moreover", "Furthermore", "Additionally", "In addition", "In conclusion", "Ultimately", "It is important to note", "Let me be clear", "That said", "At its core", "The reality is", "make no mistake".
- NEVER set up a claim by denying a different one first. This is the single most recognisable habit in machine prose, you will reach for it in every speech, and it has more shapes than you think. All of these are banned: "it isn't just X, it's Y", "it's not X, it's Y", "that's not a feature, it's a loophole", "the fun is the hook, not the point", "it is not only X but Y", "X is more than Y", "this is less about X than about Y". Say what the thing IS, in one clause, and stop. If you have written the word "not" and there is a comma later in the sentence, you have almost certainly just done it: delete the negative half and keep the positive one.
- Do not answer your own sentence. "That's not a feature. It's a loophole." is the same habit with a full stop in the middle of it, and so is any pair of short sentences where the first exists only to be corrected by the second.
- Signpost by naming the argument you are answering, as in "on their jobs point". Never by counting off "first, second, third".
- Use contractions. They're, doesn't, won't, that's.
- Vary your sentence length. At least one sentence under six words.
- Never appeal to a source you cannot name. "Studies show", "research suggests", "experts agree", "it has been proven" are all banned outright. Either say whose finding it is, or drop the appeal and argue why the thing is true. A debater who says "studies show" gets asked which study, and has nothing.
- Do not summarise yourself at the end. Stop on your strongest line.
- No em dashes, no bullet points, no bold, no headers, no stage directions, no word count, no speech label.
- Never narrate what you are doing. "I will now rebut" is not a sentence anyone says.
- Do not reuse a phrase you already used earlier in this round. If a line landed once, saying it again is not emphasis, it is padding.`;

/* ── Not making things up ─────────────────────────────────────────────────
   The hardest rule to hold, and the one worth the most words.

   What VOICE used to say was "do not invent statistics", plus an instruction
   to anchor a claim in a real place or year. Together those were close to the
   worst possible pair. The ban covered numbers and nothing else, so the model
   obeyed it to the letter and invented everything around them: what a
   country's policy was, what its data showed, which way its results went. And
   the anchoring instruction is what sent it looking for a country to do that
   to in the first place.

   A real example, from a round somebody actually played: "Finland cut
   homework in the 2010s and their PISA scores didn't climb; they'd never been
   high." Every clause is wrong. Finland led the PISA rankings for most of a
   decade, the homework claim is a staple internet myth, and the speech
   contained no statistic at all, so the old rule had nothing to say about it.

   This is worse than a bad argument. A student practising here is practising
   against a confident liar, and the specific danger is that a fabricated fact
   is the most persuasive-sounding thing in the speech: they lose to it, and
   they may carry it into a real round.

   So the anchoring requirement is gone, the ban now covers claims rather than
   digits, and the model is told what to do instead, which is the part that
   makes a prohibition work. The judge is told not to reward specificity it
   cannot check, so the incentive points the same way.

   ── The hole the first version left ──────────────────────────────────────
   Covering statistics, studies and named cases still left the most common
   fabrication untouched, because it contains none of those things. From a
   real round: "Other games don't let children create and sell content for
   profit." No digits, no study, no country, and a claim about every other
   game there has ever been, made by something that has checked none of them.
   The same speech asserted that a nine-year-old's social standing depends on
   what their parents spend, which is a survey result nobody ran.

   Claims of that shape are the most dangerous thing in a speech precisely
   because they sound like reasoning rather than evidence. A student cannot
   challenge "no other game does this" the way they can challenge a number,
   and it will not occur to them to try.

   This is prompt-side and stays prompt-side. `scrub` handles what can be
   decided from the text alone; whether a sentence is a claim about thousands
   of unchecked cases is a judgement, and a regular expression that guessed at
   it would delete real arguments to catch invented ones. */
const HONESTY = `WHAT YOU MAY ASSERT. You have no sources in this round. Argue like it.

- Never invent a statistic, a percentage, a date, a study, a poll or a quotation. Not one, not approximately, not "around 40%".
- You may name a real country, policy, company or historical case ONLY to assert what is genuinely common knowledge about it. You may not invent what its data showed, what its results were, which direction they went, why it was done, or what happened next. If you catch yourself about to say what some country's numbers did, you do not know that. Cut it.
- Never claim what a whole category does or does not do. "No other game lets kids sell what they build", "every school that tried this went back", "most parents have no idea" are the same move as an invented statistic: a fact about thousands of cases you have not checked. If the sentence has the shape ALL of them, NONE of them, MOST of them, or ONLY this one, you do not know it. Hedging it does not fix it; "arguably most" is still the claim.
- Say instead what you can name, or what follows from how the thing works. "Roblox pays creators a share of what their game earns, which is unusual" is about one thing you can name. "Other games don't do that" is about all the ones you cannot.
- The same rule covers what people think, feel or do in general. "Kids judge each other on what they have bought" is a survey you never read. Argue the mechanism instead: if a game sells items that everyone can see, then what somebody is wearing is public information about what they spent, and the argument follows from that without you asserting what any child believes.
- Reasoning from how something works is always available to you and needs no source. "Cash arrives before the eviction, and an eviction is far more expensive to undo than to prevent" is a complete argument. Use that shape.
- A hypothetical is honest if you mark it as one. "Take a student working an evening shift" is fine. "A study of students working evening shifts found" is not.
- If they challenge a fact you cannot actually support, drop it and argue the mechanism. Do not defend it, do not add detail to it, and do not produce a second invented fact to prop up the first. Dropping a bad card and winning on warrant is what a good debater does.`;

/* The tier arrives beside the setup rather than inside it.

   `Setup.tierId` is optional now, because a live 1v1 round has no tier and
   putting a plausible one in the payload would be a number describing an
   opponent who does not exist. This function cannot run without one, so it
   asks for one outright, and its only caller is the branch that has already
   refused the request without it. */
function opponentSystem(setup: Setup, speech: Speech, tierId: TierId): string {
  const side: Side = setup.side === "Pro" ? "Con" : "Pro";
  const cap = BUDGET[speech][tierId];

  const format = setup.format
    ? `You are debating in ${setup.format} format. Argue the way that format expects: ${FORMAT_NOTE[setup.format]}`
    : `This is a casual debate with no format rules. Argue in plain, direct language. No jargon, no framework requirements.`;

  return `You are arguing one side of a debate against a human. You argue to win.

MOTION: ${setup.motion}
YOU ARE ARGUING: ${side}
${format}

${OPPONENT_CRAFT[tierId]}

THIS SPEECH IS YOUR ${speech.toUpperCase()}. ${SPEECH_BRIEF[speech]}

LENGTH: under ${cap} words. This is a hard limit and going over it is the worst thing you can do here. Anything past it gets cut off mid round.

${HONESTY}

${VOICE}

Rules that hold whatever the tier:
- Argue the ${side} side and never concede the round. You may concede an individual point when it is clearly lost, and doing so gracefully is a strength.
- Every sentence has to work for ${side}. Check the last line of each paragraph against that: restating their case in your own words, or agreeing that the thing you are defending is the problem, means you have lost the thread and the sentence has to go. This is easiest to get wrong in the final paragraph of a rebuttal.
- Never remark on how they are arguing rather than what they argued. "You keep dodging", "you still haven't answered", "the scrutiny you won't give it" and "that's a strawman" are all about them and not about the motion. Answer the argument, or say the argument was not made. If they insult you or write something that is not an argument, say only that there was nothing there to answer and spend the speech on the round.
- Respond to what they ACTUALLY said. Never restate their argument in a weaker form than they made it.
- Do not repeat a line you have already used this round. If you are making the same point again, make it shorter and add the new reason.
- No personal remarks about them. Attack the argument.
- Write only the words you would say. Nothing else.`;
}

const FORMAT_NOTE: Record<Format, string> = {
  "Lincoln-Douglas":
    "establish a value and a criterion, argue philosophically, and weigh through your criterion.",
  "Public Forum":
    "stay accessible to a lay judge, avoid jargon, and weigh on magnitude, probability and timeframe.",
  Policy:
    "argue the stock issues, engage solvency and harms directly, and answer topicality if it is raised.",
  Parliamentary:
    "argue from logic and common knowledge rather than cited evidence, and frame the round rhetorically.",
};

/* ── The judge ────────────────────────────────────────────────────────────
   Two rubrics, and the tab picks one. They differ in the bar and in what
   counts as a foul, and they agree on everything else, including the one
   instruction that carries the most weight in either: polish never stands in
   for substance. A well-spoken weak argument does not beat a clumsy strong
   one, and a judge that forgets it rewards exactly the fluency this rewards
   nothing else for. */

/** How the written half of the ballot has to read.

    A judge writing a ballot has three more rounds to get through and writes
    like it: short, second person, about this round and no other. What a model
    writes unprompted is a performance review. "The debater demonstrated strong
    analytical capabilities" is true of every debater who ever spoke and tells
    this one nothing, and it is also the exact register that made the whole
    mode read as machine output. Every line has to name something that
    actually happened in the transcript above. */
const BALLOT_VOICE = `HOW THE WRITTEN COMMENTS READ. You are a judge scribbling on a ballot with the next round waiting. Clipped. Second person, addressed to Debater A. Every comment must name a specific argument from this round.

"You never answered the cost turn, so it sat there conceded" is a ballot comment.
"The debater demonstrated strong analytical skills" is not. Do not write anything that would fit any other debate.

No praise sandwiches, no encouragement filler, no "overall". Say the thing.

WHO EVERY "YOU" REFERS TO. Debater A, and nobody else. All three feedback lines are about what A did.

Before you write a line of praise, find the speech it came from and check whose it is. Crediting A with an argument B made is the worst thing you can do on this ballot: it is the one error the student cannot catch, because it tells them they made a point they never thought of, and they will walk into the next round believing it. If the good argument in this round was B's, that belongs in "biggest_weakness" as something A failed to answer, or in a key moment with "speaker": "opponent". It never belongs in "biggest_strength".

WHEN A SIDE BARELY SPOKE. Some rounds end with one debater having written "no", or a single line that is not an argument, or a concession and nothing after it. That is a real outcome and you must mark it as one.

Do not manufacture a strength to fill the field. "biggest_strength" may be "Nothing to name here." and on a round like that it should be. An invented compliment is worse than a blunt ballot, because the student believes it and practises it. Score the dimensions against what was actually said, which is close to nothing, and give the round to the other side with a high margin.`;

const CONTRACT = `Output ONLY valid JSON, no markdown fences, no preamble, matching this schema:

{
  "winner": "user" | "opponent" | "draw",
  "scores": {
    "user": { "logic": 0-100, "evidence": 0-100, "rebuttal": 0-100, "structure": 0-100, "clarity": 0-100 },
    "opponent": { "logic": 0-100, "evidence": 0-100, "rebuttal": 0-100, "structure": 0-100, "clarity": 0-100 }
  },
  "margin": 1-10,
  "key_moments": [
    { "speaker": "user" | "opponent", "quote_paraphrase": "string, under 18 words", "why_it_mattered": "string, under 20 words" }
  ],
  "feedback": {
    "biggest_strength": "string, under 25 words",
    "biggest_weakness": "string, under 25 words",
    "one_fix_for_next_round": "string, under 25 words"
  }
}

SCORING "evidence". You cannot check a claim, so do not reward one for sounding checkable. A specific-sounding assertion with no support is worth less than a plainly reasoned one, not more: a debater who says a named country's data showed a particular result, with nothing behind it, has given you an unwarranted claim dressed as a fact, and the dressing is what makes it dangerous. Score evidence on whether claims are warranted and whether the debater explained why the thing is true. Penalise invented-sounding specifics, and penalise a debater who defends a challenged fact by producing another one.

Penalise claims about whole categories on the same footing, and they are easier to miss because they carry no numbers. "No other platform does this", "every country that tried it reversed course", "most parents have no idea" are assertions about thousands of unchecked cases, and they are worth less than one named example or a line of mechanism, not more. Reward the debater who says how the thing works over the one who says how all of them behave.

"margin" is how decisive the win was, 1 for razor-thin and 10 for a total blowout. It is required and it scales the rating change, so do not omit it and do not default it to a middle value out of caution: a close round must report a low margin.
Give AT MOST 3 key_moments. Fewer is fine, and none is right for a round where nothing turned. "speaker" is whoever actually said it.
Every key moment must be a line somebody really spoke in the transcript above. "quote_paraphrase" is that line, tightened to fit, and never a sentence you composed to summarise a position: if you cannot point to the speech it came out of, there is no moment there to report. A quote a debater never said is the one error on this ballot they cannot catch, because the only thing they can conclude is that they said it and forgot.
"one_fix_for_next_round" is one action, not a list. Something they could do differently in their very next speech. Where Debater A gave up or wrote nothing, the fix is to make an argument at all, said plainly.
Never let format or delivery polish substitute for missing logic in the "winner" call. A well-spoken weak argument does not beat a clumsy strong one.
Do not use em dashes anywhere in your output.

${BALLOT_VOICE}`;

function competitiveSystem(setup: Setup): string {
  return `You are an experienced competitive debate judge on the National Speech and Debate Association circuit, judging a practice round. You are strict, format-literate, and you give the ballot a real tournament judge would give.

FORMAT: ${setup.format}
RESOLUTION: ${setup.motion}
DEBATER A IS ARGUING: ${setup.side}

Judge strictly by ${setup.format} conventions:
- Lincoln-Douglas: value and criterion framework, philosophical weighing, single-actor focus.
- Public Forum: lay-accessible language, weighing on magnitude, probability and timeframe, no jargon-only arguments.
- Policy: stock issues, inherency, solvency, harms, topicality; spreading is permitted; engage counterplan and disadvantage interaction if present.
- Parliamentary: logical consistency without cited evidence, points of information, rhetorical framing.

Penalise:
- Format violations, including new arguments in a speech that does not permit them, and a dropped framework.
- Unwarranted claims: an assertion with no warrant or no impact.
- Dropped arguments. An argument the other side made that went unanswered is conceded, and you must treat it as conceded.
- Weak or absent weighing where the format calls for it.

Do NOT penalise:
- Speed, where the format allows it.
- Jargon, where the format expects it.
- Aggressive tone that stays inside format norms.

Score each dimension 0-100 against a competitive tournament bar, not a casual one. A 60 here means genuinely mediocre by tournament standards, not "good for a beginner". Be honest even where it is discouraging: sandbagging the scores defeats the point of practising.

${CONTRACT}`;
}

function casualSystem(setup: Setup): string {
  return `You are a sharp, fair judge for a casual practice debate. The debaters are not preparing for a tournament. They want to get better at arguing clearly and thinking on their feet, so keep the bar realistic for a general audience rather than a competitive circuit.

TOPIC: ${setup.motion}
DEBATER A IS ARGUING: ${setup.side}

Judge on: does the argument make sense, is it supported, does it answer what the other side actually said, is it organised, is it clearly put. No format rules, no framework requirements, and no penalty at all for plain language.

Reward:
- Finding and attacking the weakest point in the other side's case.
- Using a concrete example or analogy well.
- Conceding a point gracefully where it is lost, rather than doubling down.

Penalise:
- Strawmanning: restating the other side's argument in a weaker form and beating that.
- Repeating a point without adding anything to it.
- Personal attacks in place of argument.

Keep it honest and keep it kind. This is practice, not a pile-on. If a debater is clearly a beginner, judge them against a general audience rather than an expert bar, and say the hard thing plainly rather than burying it.

${CONTRACT}`;
}

/* ── Validation ───────────────────────────────────────────────────────────
   The schema is nested and has a variable-length array in it, which is the
   most fragile thing you can ask a small fast model for. Everything is
   checked, and anything out of range is pulled into range rather than thrown
   away: a judge that returns a margin of 12 has still judged the round, and
   losing a student's whole debate over one clamped integer would be a worse
   answer than clamping it. Only a genuinely unreadable ballot is rejected. */

function clamp(n: unknown, lo: number, hi: number, fallback: number): number {
  const value = typeof n === "number" && Number.isFinite(n) ? n : fallback;
  return Math.min(hi, Math.max(lo, Math.round(value)));
}

function scoresOf(v: unknown): Ballot["scores"]["user"] {
  const raw = (v ?? {}) as Record<string, unknown>;
  const out = {} as Ballot["scores"]["user"];
  for (const d of DIMENSIONS) out[d] = clamp(raw[d], 0, 100, 50);
  return out;
}

function isBallotish(v: unknown): v is Record<string, unknown> {
  if (typeof v !== "object" || v === null) return false;
  const b = v as Record<string, unknown>;
  return (
    (b.winner === "user" || b.winner === "opponent" || b.winner === "draw") &&
    typeof b.scores === "object" &&
    b.scores !== null
  );
}

function tidy(raw: Record<string, unknown>): Ballot {
  const scores = (raw.scores ?? {}) as Record<string, unknown>;
  const feedback = (raw.feedback ?? {}) as Record<string, unknown>;
  const said = (v: unknown, fallback: string) =>
    typeof v === "string" && v.trim() ? v.trim() : fallback;

  const moments = Array.isArray(raw.key_moments) ? raw.key_moments : [];

  return {
    winner: raw.winner as Ballot["winner"],
    scores: { user: scoresOf(scores.user), opponent: scoresOf(scores.opponent) },
    margin: clamp(raw.margin, 1, 10, 3),
    key_moments: moments
      .filter((m): m is Record<string, unknown> => typeof m === "object" && m !== null)
      .slice(0, 3)
      .map((m) => ({
        speaker: m.speaker === "opponent" ? ("opponent" as const) : ("user" as const),
        quote_paraphrase: said(m.quote_paraphrase, ""),
        why_it_mattered: said(m.why_it_mattered, ""),
      }))
      .filter((m) => m.quote_paraphrase && m.why_it_mattered),
    feedback: {
      biggest_strength: said(feedback.biggest_strength, "Not given."),
      biggest_weakness: said(feedback.biggest_weakness, "Not given."),
      one_fix_for_next_round: said(feedback.one_fix_for_next_round, "Not given."),
    },
  };
}

/** The transcript as the judge sees it.

    Both sides are anonymous and neither is named as the human. A judge told
    which side a person wrote has a thumb on the scale before it reads a word,
    and the point of the ballot is that it does not. `A` is always the side
    the setup says the user is arguing, so the caller can read the result
    back without the judge ever having been told why. */
function render(turns: Turn[]): string {
  return turns
    .map((t) => `[${t.speaker === "user" ? "A" : "B"} · ${t.speech}]\n${t.text.trim()}`)
    .join("\n\n");
}

/** The transcript as the OPPONENT sees it, which is the opposite problem.

    The judge must not know who wrote which side. The opponent must know
    nothing else, and for a while it did not: this used `render` too, so the
    speech it was about to answer arrived labelled `A` and `B` with no line
    anywhere saying which one it had written. It had to infer that, and the
    tell it inferred from was substance. A student who opens with three words
    against a full case leaves exactly one real argument in the transcript, so
    the model read its own Constructive as the case to attack and spent the
    Rebuttal demolishing itself, side and all.

    Naming the speakers by role costs two words a turn and removes the guess. */
function renderForOpponent(turns: Turn[]): string {
  return turns
    .map((t) => `[${t.speaker === "user" ? "THEM" : "YOU"} · ${t.speech}]\n${t.text.trim()}`)
    .join("\n\n");
}

function readSetup(v: unknown): Setup | null {
  if (typeof v !== "object" || v === null) return null;
  const s = v as Record<string, unknown>;
  const tab = s.tab === "competitive" ? "competitive" : s.tab === "casual" ? "casual" : null;
  if (!tab) return null;
  if (typeof s.motion !== "string" || !s.motion.trim()) return null;
  if (s.side !== "Pro" && s.side !== "Con") return null;
  /* Absent is allowed, wrong is not.

     A live 1v1 round has no tier — the opponent is a person — and it still
     needs the judge, which never looked at the tier anyway: both judge
     prompts read the motion, the side and the format and nothing else. What
     is refused is a tier that is present and is not one of the three, which
     is a request that has been tampered with rather than a live round. */
  const tierId = s.tierId;
  if (tierId !== undefined && tierId !== "novice" && tierId !== "varsity" && tierId !== "circuit") {
    return null;
  }
  if (tab === "competitive" && typeof s.format !== "string") return null;

  return {
    tab,
    motion: s.motion.trim().slice(0, 400),
    side: s.side,
    tierId,
    format: tab === "competitive" ? (s.format as Format) : undefined,
  };
}

/** Which speech this is, kept to the four that exist.

    Anything else falls back rather than being passed through. The speech name
    reaches the prompt and indexes the length budget, and neither of those is a
    thing an arbitrary string from a request body gets to decide. */
function readSpeech(v: unknown): Speech {
  return SPEECHES.includes(v as Speech) ? (v as Speech) : "Constructive";
}

function readTurns(v: unknown): Turn[] | null {
  if (!Array.isArray(v)) return null;
  const turns: Turn[] = [];
  for (const t of v) {
    if (typeof t !== "object" || t === null) return null;
    const turn = t as Record<string, unknown>;
    if (turn.speaker !== "user" && turn.speaker !== "opponent") return null;
    if (typeof turn.text !== "string" || !turn.text.trim()) return null;
    turns.push({
      speaker: turn.speaker,
      speech: readSpeech(turn.speech),
      /* A cap, because the transcript is the prompt and an unbounded one is
         an unbounded bill on a key everybody shares. */
      text: turn.text.trim().slice(0, 4000),
    });
  }
  return turns;
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const setup = readSetup(body.setup);
  const turns = readTurns(body.turns);
  if (!setup || !turns) {
    return NextResponse.json({ error: "setup and turns are required." }, { status: 400 });
  }

  try {
    if (body.action === "reply") {
      /* The one branch that genuinely needs a tier: it picks how the model
         argues and how long it may run. A live 1v1 round has no tier and no
         business here either — the opponent in that room is a person, and
         asking this route for their next speech would be asking the model to
         argue for them. */
      if (!setup.tierId) {
        return NextResponse.json(
          { error: "An opponent strength is required to write a reply." },
          { status: 400 }
        );
      }
      const speech = readSpeech(body.speech);

      /* The nudge at the end is speech-specific, and it has to be.

         It used to be "answer what they just said" on all four, which was the
         right instruction three times out of four and quietly wrong on the
         first: the student always opens, so the opponent's Constructive is
         written having already heard a case, and a blanket instruction to
         answer it produced a rebuttal where a case should have been. The
         speech briefs said otherwise and lost, because this line is the last
         thing the model reads. */
      const nudge =
        speech === "Constructive"
          ? `Write your Constructive. They have spoken, so you may open by taking one line off them, but this speech is where you put YOUR case on the table. Most of it should be your own argument.`
          : `Write your ${speech}. Answer what they actually said, not what you wish they had said.`;

      const said = turns.length
        ? `The round so far. Speeches marked YOU are ones you already gave, arguing ${
            setup.side === "Pro" ? "Con" : "Pro"
          }. Speeches marked THEM are your opponent's, arguing ${setup.side}. Never answer your own speech.\n\n${renderForOpponent(
            turns
          )}\n\n${nudge}`
        : `Open the round. Write your ${speech}.`;

      /* Warmer than the app's default, because the same three sentence
         patterns every round is its own kind of tell. The filter is what keeps
         the extra temperature from costing length discipline.

         It was 0.75 and came down, because the cost of the extra warmth is
         paid in invented facts before it is paid anywhere else: a hotter
         sample reaches further for a vivid specific, and a vivid specific this
         model does not know is a fabrication. 0.6 still varies the phrasing
         round to round, which is all the warmth was ever for. */
      const stream = chatStream(opponentSystem(setup, speech, setup.tierId), said, 0.6);

      /* Ask for the first chunk here, inside the try, rather than inside the
         stream below. Everything that can fail with a status a student should
         see fails on that first read: a busy key, a bad model id, no key at
         all. Pulling it now means those are still an ordinary JSON error with
         an ordinary status code, and the catch at the bottom of this function
         handles them exactly as it always did. After this line the response is
         committed and a failure can only end the speech early. */
      const opening = await stream.next();

      const filter = createSpeechFilter(BUDGET[speech][setup.tierId]);
      const encode = new TextEncoder();

      /* Plain text rather than server-sent events. There is one kind of thing
         on this stream, it is the words of a speech in order, and wrapping
         each of them in a JSON envelope with an event name would be a
         protocol for a problem nobody has. */
      return new Response(
        new ReadableStream<Uint8Array>({
          async start(controller) {
            let said = "";

            const write = (text: string) => {
              if (!text) return;
              said += text;
              controller.enqueue(encode.encode(text));
            };

            /* A kilobyte of nothing, first.

               WebKit holds a streamed response until it has received 1024
               bytes and only then starts handing it to the page. A speech is
               about six hundred bytes, so without this the entire feature is
               invisible on Safari and on every browser on iOS: the speech
               would arrive in one piece at the end, which is exactly what
               this replaced. Next's own streaming guide names the threshold.

               The client drops leading whitespace before it shows anything,
               so this never reaches the transcript. It costs one kilobyte per
               speech, four per round. */
            controller.enqueue(encode.encode(" ".repeat(1024)));

            try {
              if (!opening.done) write(filter.push(opening.value));

              if (!filter.finished()) {
                for await (const delta of stream) {
                  write(filter.push(delta));
                  /* The speech has run its length. Breaking here also ends the
                     generation: the loop's return runs the generator's finally,
                     which cancels the upstream read. */
                  if (filter.finished()) break;
                }
              }

              write(filter.end());

              /* Nothing survived. The whole reply was packaging, or the model
                 returned an empty completion. The status is long since sent, so
                 this is the only way left to say so, and the client reads an
                 empty body as the failure it is. */
              if (!said.trim()) console.error("Debate reply produced no speech.");
            } catch (err) {
              /* Mid-stream failure. Whatever was already read is already on
                 screen and stays there; there is no status left to change. */
              console.error("Debate reply stream failed:", err);
            } finally {
              controller.close();
            }
          },
        }),
        {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "x-content-type-options": "nosniff",
            "cache-control": "no-store",
            /* Tells a reverse proxy not to sit on the body until it is
               complete, which would turn the whole point of this back into a
               wait followed by a wall of text. */
            "x-accel-buffering": "no",
          },
        }
      );
    }

    if (body.action === "judge") {
      if (turns.length < 2) {
        return NextResponse.json(
          { error: "There is not enough of a round here to judge." },
          { status: 400 }
        );
      }

      /* Nobody argued. Refused before the call rather than after it, and the
         message says what is missing rather than that something went wrong,
         because nothing did: see `worthJudging` in app/debate/types.ts. */
      if (!worthJudging(turns)) {
        return NextResponse.json(
          {
            error:
              "There is no round here to judge yet. Make an argument, in a sentence or two, and the ballot will have something to mark.",
          },
          { status: 400 }
        );
      }

      const system =
        setup.tab === "competitive" ? competitiveSystem(setup) : casualSystem(setup);
      const raw = await chatJSON(system, render(turns), isBallotish);
      return NextResponse.json({ ballot: tidy(raw) });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    if (err instanceof AIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Debate route failed:", err);
    return NextResponse.json({ error: "Oops! Something went wrong on our end :(" }, { status: 500 });
  }
}
