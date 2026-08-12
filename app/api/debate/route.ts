import { NextResponse } from "next/server";
import { AIError, chatJSON, chatText } from "@/lib/ai";
import {
  type Ballot,
  DIMENSIONS,
  type Format,
  type Setup,
  type Side,
  type Turn,
  tier,
  type TierId,
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
  novice: `You are a first-year debater. Make ONE clear argument per speech and support it with a plain example. Signpost simply ("First," "Second"). You sometimes fail to answer one of your opponent's points, and that is fine: do not manufacture a response to everything. Do not use technical debate jargon. Keep it under 130 words.`,
  varsity: `You are a solid varsity debater. Signpost your arguments, answer your opponent's points directly and by name, and weigh at least once ("even if you win X, we outweigh on Y"). If your opponent dropped an argument, say so and explain what that concedes. Keep it under 180 words.`,
  circuit: `You are a strong national-circuit debater. You are fast, technical and precise. Line-by-line your opponent's case, collapse to your strongest offence in later speeches, and weigh explicitly on magnitude, probability and timeframe. Where your opponent has given you a framework, turn it and use it against them. Do not be gratuitously obscure, but do not simplify for comfort either. Keep it under 220 words.`,
};

function opponentSystem(setup: Setup): string {
  const side: Side = setup.side === "Pro" ? "Con" : "Pro";
  const craft = OPPONENT_CRAFT[setup.tierId];

  const format = setup.format
    ? `You are debating in ${setup.format} format. Argue the way that format expects: ${FORMAT_NOTE[setup.format]}`
    : `This is a casual debate with no format rules. Argue in plain, direct language. No jargon, no framework requirements.`;

  return `You are arguing one side of a debate against a human. You argue to win.

MOTION: ${setup.motion}
YOU ARE ARGUING: ${side}
${format}

${craft}

Rules that hold whatever the tier:
- Argue the ${side} side and never concede the round. You may concede an individual point when it is clearly lost, and doing so gracefully is a strength, not a weakness.
- Respond to what your opponent ACTUALLY said. Never restate their argument in a weaker form than they made it.
- No personal remarks about your opponent. Attack the argument.
- Do not narrate what you are doing ("I will now rebut"). Just argue.
- Do not use em dashes. Use commas, colons or separate sentences.
- Write only your speech. No headers, no stage directions, no word count.`;
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

const CONTRACT = `Output ONLY valid JSON, no markdown fences, no preamble, matching this schema:

{
  "winner": "user" | "opponent" | "draw",
  "scores": {
    "user": { "logic": 0-100, "evidence": 0-100, "rebuttal": 0-100, "structure": 0-100, "clarity": 0-100 },
    "opponent": { "logic": 0-100, "evidence": 0-100, "rebuttal": 0-100, "structure": 0-100, "clarity": 0-100 }
  },
  "margin": 1-10,
  "key_moments": [
    { "speaker": "user" | "opponent", "quote_paraphrase": "string, under 20 words", "why_it_mattered": "string, under 25 words" }
  ],
  "feedback": {
    "biggest_strength": "string, under 30 words",
    "biggest_weakness": "string, under 30 words",
    "one_fix_for_next_round": "string, under 30 words"
  }
}

"margin" is how decisive the win was, 1 for razor-thin and 10 for a total blowout. It is required and it scales the rating change, so do not omit it and do not default it to a middle value out of caution: a close round must report a low margin.
Give AT MOST 3 key_moments. Fewer is fine.
Never let format or delivery polish substitute for missing logic in the "winner" call. A well-spoken weak argument does not beat a clumsy strong one.
Do not use em dashes anywhere in your output.`;

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

Keep the tone encouraging but honest. This is practice, not a pile-on. If a debater is clearly a beginner, say so gently in the feedback rather than grading them against an expert bar.

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

function readSetup(v: unknown): Setup | null {
  if (typeof v !== "object" || v === null) return null;
  const s = v as Record<string, unknown>;
  const tab = s.tab === "competitive" ? "competitive" : s.tab === "casual" ? "casual" : null;
  if (!tab) return null;
  if (typeof s.motion !== "string" || !s.motion.trim()) return null;
  if (s.side !== "Pro" && s.side !== "Con") return null;
  const tierId = s.tierId;
  if (tierId !== "novice" && tierId !== "varsity" && tierId !== "circuit") return null;
  if (tab === "competitive" && typeof s.format !== "string") return null;

  return {
    tab,
    motion: s.motion.trim().slice(0, 400),
    side: s.side,
    tierId,
    format: tab === "competitive" ? (s.format as Format) : undefined,
  };
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
      speech: (typeof turn.speech === "string" ? turn.speech : "Constructive") as Turn["speech"],
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
      const speech = typeof body.speech === "string" ? body.speech : "Constructive";
      const said = turns.length
        ? `The round so far:\n\n${render(turns)}\n\nWrite your ${speech}.`
        : `Open the round. Write your ${speech}.`;

      const text = await chatText(opponentSystem(setup), said);
      return NextResponse.json({ text, tier: tier(setup.tierId).name });
    }

    if (body.action === "judge") {
      if (turns.length < 2) {
        return NextResponse.json(
          { error: "There is not enough of a round here to judge." },
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
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
