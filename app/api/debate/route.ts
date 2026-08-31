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

const OPPONENT_CRAFT: Record<TierId, string> = {
  novice: `You are in your first year of debate. One argument per speech, backed by a plain example anybody would recognise. You sometimes miss one of their points, and that is fine: do not manufacture an answer to everything. No jargon.`,
  varsity: `You are solid varsity. Answer their arguments by name rather than in general, and weigh at least once: even if they win their point, say why yours decides the round anyway. If they dropped something, say so and say what it concedes.`,
  circuit: `You are national circuit. Technical, fast and precise. Go down their case argument by argument, collapse to your strongest offence in the later speeches, and weigh on magnitude, probability and timeframe. If they handed you a framework, argue under it and turn it. Do not simplify for comfort.`,
};

const SPEECH_BRIEF: Record<Speech, string> = {
  Constructive: `Build your own case. Two arguments at most. Each one needs a reason it is true and a reason it matters. You may glance at what they said, but do not spend this speech on them.`,
  Rebuttal: `Attack their case. Take their arguments in the order they made them and say why each fails: it is not true, it does not follow, or it does not matter even if it is. No new offence of your own.`,
  Summary: `Collapse. Pick the one or two things you are actually winning, say why they decide the round, and answer their best response to them. Nothing new.`,
  "Final Focus": `One voter. Say what you are winning, why it outweighs whatever they are winning, and stop. Nothing new and no line-by-line.`,
};

const BUDGET: Record<Speech, Record<TierId, number>> = {
  Constructive: { novice: 85, varsity: 110, circuit: 125 },
  Rebuttal: { novice: 85, varsity: 110, circuit: 125 },
  Summary: { novice: 65, varsity: 80, circuit: 90 },
  "Final Focus": { novice: 45, varsity: 55, circuit: 60 },
};

const VOICE = `HOW YOU SOUND. You are speaking out loud to somebody standing across from you. You are not writing an essay.

- Open on the argument itself. No throat clearing, no thanking anyone, no restating the motion back at them.
- Never write any of these: "Firstly", "Secondly", "Moreover", "Furthermore", "Additionally", "In addition", "In conclusion", "Ultimately", "It is important to note", "Let me be clear", "That said", "At its core", "The reality is", "make no mistake".
- NEVER set up a claim by denying a different one first. This is the single most recognisable habit in machine prose, you will reach for it in every speech, and it has more shapes than you think. All of these are banned: "it isn't just X, it's Y", "it's not X, it's Y", "that's not a feature, it's a loophole", "the fun is the hook, not the point", "it is not only X but Y", "X is more than Y", "this is less about X than about Y". Say what the thing IS, in one clause, and stop. If you have written the word "not" and there is a comma later in the sentence, you have almost certainly just done it: delete the negative half and keep the positive one.
- Do not answer your own sentence. "That's not a feature. It's a loophole." is the same habit with a full stop in the middle of it, and so is any pair of short sentences where the first exists only to be corrected by the second.
- Signpost by naming the argument you are answering, as in "on your jobs point". Never by counting off "first, second, third".
- SPEAK TO THEM, NOT ABOUT THEM. There is one other person here and you are looking at them, so they are "you" and their case is "your case". Never "they", "them", "their", "my opponent", "the opposition", or "the other side" for the person you are arguing with. "They're saying kids can cash out" is you describing the round to a spectator who is not in it. Write "you're saying kids can cash out". This is the easiest rule in this list to break without noticing, because writing about a debate is the shape you know best, and it is the one that makes a reply stop sounding like a reply.
- "They" is still the right word for anybody who is not in this room: parents, players, a government, a company. Those keep their pronouns. The rule is about the person across from you and nobody else.
- Use contractions. They're, doesn't, won't, that's.
- Vary your sentence length. At least one sentence under six words.
- Never appeal to a source you cannot name. "Studies show", "research suggests", "experts agree", "it has been proven" are all banned outright. Either say whose finding it is, or drop the appeal and argue why the thing is true. A debater who says "studies show" gets asked which study, and has nothing.
- Do not summarise yourself at the end. Stop on your strongest line.
- No em dashes, no bullet points, no bold, no headers, no stage directions, no word count, no speech label.
- Never narrate what you are doing. "I will now rebut" is not a sentence anyone says.
- Do not reuse a phrase you already used earlier in this round. If a line landed once, saying it again is not emphasis, it is padding.`;

const HONESTY = `WHAT YOU MAY ASSERT. You have no sources in this round. Argue like it.

- Never invent a statistic, a percentage, a date, a study, a poll or a quotation. Not one, not approximately, not "around 40%".
- You may name a real country, policy, company or historical case ONLY to assert what is genuinely common knowledge about it. You may not invent what its data showed, what its results were, which direction they went, why it was done, or what happened next. If you catch yourself about to say what some country's numbers did, you do not know that. Cut it.
- Never claim what a whole category does or does not do. "No other game lets kids sell what they build", "every school that tried this went back", "most parents have no idea" are the same move as an invented statistic: a fact about thousands of cases you have not checked. If the sentence has the shape ALL of them, NONE of them, MOST of them, or ONLY this one, you do not know it. Hedging it does not fix it; "arguably most" is still the claim.
- Say instead what you can name, or what follows from how the thing works. "Roblox pays creators a share of what their game earns, which is unusual" is about one thing you can name. "Other games don't do that" is about all the ones you cannot.
- The same rule covers what people think, feel or do in general. "Kids judge each other on what they have bought" is a survey you never read. Argue the mechanism instead: if a game sells items that everyone can see, then what somebody is wearing is public information about what they spent, and the argument follows from that without you asserting what any child believes.
- Reasoning from how something works is always available to you and needs no source. "Cash arrives before the eviction, and an eviction is far more expensive to undo than to prevent" is a complete argument. Use that shape.
- A hypothetical is honest if you mark it as one. "Take a student working an evening shift" is fine. "A study of students working evening shifts found" is not.
- If they challenge a fact you cannot actually support, drop it and argue the mechanism. Do not defend it, do not add detail to it, and do not produce a second invented fact to prop up the first. Dropping a bad card and winning on warrant is what a good debater does.`;

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

const BALLOT_VOICE = `HOW THE WRITTEN COMMENTS READ. You are a judge scribbling on a ballot with the next round waiting. Clipped. Second person, addressed to Debater A. Every comment must name a specific argument from this round.

"You never answered the cost turn, so it sat there conceded" is a ballot comment.
"The debater demonstrated strong analytical skills" is not. Do not write anything that would fit any other debate.

No praise sandwiches, no encouragement filler, no "overall". Say the thing.

NEVER WRITE THE LETTERS. "A" and "B" are how this prompt tells the two of you apart and they are not words the person reading the ballot has ever seen. "A flaw in A's hanging out point" is you reading out your own notation. The person you are writing to is "you" and "your"; the other one is "they" and "their". No "Debater A", no "A's", no "Debater B", no "the opponent" by letter.

WHO EVERY "YOU" REFERS TO. In "feedback", Debater A and nobody else: all three lines there are about what A did, written to A as "you". In "feedback_opponent" you write the same three lines about Debater B, addressed to B as "you" in exactly the same voice. Two separate ballots, one for each chair, and neither of them contains a letter.

The two must not be the same ballot twice. If A's weakness was dropping the cost turn, that is A's weakness, and B's ballot says what B did, very likely that B pressed the cost turn and never got an answer. Writing one debater's comments into both fields tells the losing debater they made the winner's arguments, and the person reading it has no way to know it happened.

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
  },
  "feedback_opponent": {
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

function clamp(n: unknown, lo: number, hi: number, fb: number): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : fb;
  return Math.min(hi, Math.max(lo, Math.round(v)));
}

function scoresOf(v: unknown): Ballot["scores"]["user"] {
  const raw = (v ?? {}) as Record<string, unknown>;
  const out = {} as Ballot["scores"]["user"];
  for (const d of DIMENSIONS) out[d] = clamp(raw[d], 0, 100, 50);
  return out;
}

// a winner and some scores is enough to work with, the rest gets patched
function ballotish(v: unknown): v is Record<string, unknown> {
  if (typeof v !== "object" || v === null) return false;
  const b = v as Record<string, unknown>;
  return (
    (b.winner === "user" || b.winner === "opponent" || b.winner === "draw") &&
    typeof b.scores === "object" &&
    b.scores !== null
  );
}

function tidy(raw: Record<string, unknown>): Ballot {
  const sc = (raw.scores ?? {}) as Record<string, unknown>;
  const said = (v: unknown, fb: string) => (typeof v === "string" && v.trim() ? v.trim() : fb);
  const moments = Array.isArray(raw.key_moments) ? raw.key_moments : [];

  return {
    winner: raw.winner as Ballot["winner"],
    scores: { user: scoresOf(sc.user), opponent: scoresOf(sc.opponent) },
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
    feedback: readFeedback(raw.feedback, "A"),
    feedback_opponent: readFeedback(raw.feedback_opponent, "B"),
  };
}

const AUX: Record<string, string> = {
  is: "are",
  was: "were",
  has: "have",
  does: "do",
  "isn't": "aren't",
  "wasn't": "weren't",
  "hasn't": "haven't",
  "doesn't": "don't",
};

// take the judge's own A/B notation back off. nobody reading a ballot has seen it
function deletter(text: string, me: "A" | "B"): string {
  const them = me === "A" ? "B" : "A";
  const aux = Object.keys(AUX)
    .map((v) => v.replace("'", "['’]"))
    .join("|");

  let out = text;

  // possessives first, or the rule below eats the "A" out of "Debater A's"
  out = out.replace(new RegExp(`\\b(?:Debater\\s+)?${me}['’]s\\b`, "g"), "your");
  out = out.replace(new RegExp(`\\b(?:Debater\\s+)?${them}['’]s\\b`, "g"), "their");

  const named = (l: string) => new RegExp(`\\bDebater\\s+${l}\\b(\\s+(?:${aux}))?`, "g");
  const verbOf = (v: string) => AUX[v.trim().toLowerCase().replace(/[’]/g, "'")];

  out = out.replace(named(me), (_m, v?: string) => (v ? `you ${verbOf(v)}` : "you"));
  out = out.replace(named(them), (_m, v?: string) => (v ? `they ${verbOf(v)}` : "they"));

  return out.charAt(0).toUpperCase() + out.slice(1);
}

function readFeedback(v: unknown, me: "A" | "B"): Ballot["feedback"] {
  const f = (v ?? {}) as Record<string, unknown>;
  const said = (x: unknown) => (typeof x === "string" && x.trim() ? deletter(x.trim(), me) : "Not given.");
  return {
    biggest_strength: said(f.biggest_strength),
    biggest_weakness: said(f.biggest_weakness),
    one_fix_for_next_round: said(f.one_fix_for_next_round),
  };
}

// judge sees two anonymous sides
const render = (ts: Turn[]) =>
  ts.map((t) => `[${t.speaker === "user" ? "A" : "B"} · ${t.speech}]\n${t.text.trim()}`).join("\n\n");

// the opponent sees itself as YOU
const renderForOpponent = (ts: Turn[]) =>
  ts.map((t) => `[${t.speaker === "user" ? "THEM" : "YOU"} · ${t.speech}]\n${t.text.trim()}`).join("\n\n");

function readSetup(v: unknown): Setup | null {
  if (typeof v !== "object" || v === null) return null;
  const s = v as Record<string, unknown>;

  const tab = s.tab === "competitive" ? "competitive" : s.tab === "casual" ? "casual" : null;
  if (!tab) return null;
  if (typeof s.motion !== "string" || !s.motion.trim()) return null;
  if (s.side !== "Pro" && s.side !== "Con") return null;

  const t = s.tierId;
  if (t !== undefined && t !== "novice" && t !== "varsity" && t !== "circuit") return null;
  if (tab === "competitive" && typeof s.format !== "string") return null;

  return {
    tab,
    motion: s.motion.trim().slice(0, 400),
    side: s.side,
    tierId: t,
    format: tab === "competitive" ? (s.format as Format) : undefined,
  };
}

const readSpeech = (v: unknown): Speech =>
  SPEECHES.includes(v as Speech) ? (v as Speech) : "Constructive";

function readTurns(v: unknown): Turn[] | null {
  if (!Array.isArray(v)) return null;
  const out: Turn[] = [];
  for (const x of v) {
    if (typeof x !== "object" || x === null) return null;
    const t = x as Record<string, unknown>;
    if (t.speaker !== "user" && t.speaker !== "opponent") return null;
    if (typeof t.text !== "string" || !t.text.trim()) return null;
    // capped, the transcript IS the prompt
    out.push({ speaker: t.speaker, speech: readSpeech(t.speech), text: t.text.trim().slice(0, 4000) });
  }
  return out;
}

const err = (msg: string, status: number) => NextResponse.json({ error: msg }, { status });

export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return err("Invalid request body.", 400);
  }

  const setup = readSetup(b.setup);
  const turns = readTurns(b.turns);
  if (!setup || !turns) return err("setup and turns are required.", 400);

  try {
    if (b.action === "reply") {
      if (!setup.tierId) return err("An opponent strength is required to write a reply.", 400);

      const sp = readSpeech(b.speech);

      const nudge =
        sp === "Constructive"
          ? `Write your Constructive. They have spoken, so you may open by taking one line off them, but this speech is where you put YOUR case on the table. Most of it should be your own argument.`
          : `Write your ${sp}. Answer what they actually said, not what you wish they had said.`;

      const usr = turns.length
        ? `The round so far. Speeches marked YOU are ones you already gave, arguing ${
            setup.side === "Pro" ? "Con" : "Pro"
          }. Speeches marked THEM are your opponent's, arguing ${setup.side}. Never answer your own speech.\n\n${renderForOpponent(
            turns
          )}\n\n${nudge}`
        : `Open the round. Write your ${sp}.`;

      const s = chatStream(opponentSystem(setup, sp, setup.tierId), usr, 0.6);

      // first chunk here, inside the try, so a dead key is a 5xx and not a broken stream
      const head = await s.next();

      const f = createSpeechFilter(BUDGET[sp][setup.tierId]);
      const enc = new TextEncoder();

      return new Response(
        new ReadableStream<Uint8Array>({
          async start(c) {
            let got = "";

            const put = (t: string) => {
              if (!t) return;
              got += t;
              c.enqueue(enc.encode(t));
            };

            // a kb of nothing first, or a proxy sits on the body
            c.enqueue(enc.encode(" ".repeat(1024)));

            try {
              if (!head.done) put(f.push(head.value));

              if (!f.finished()) {
                for await (const d of s) {
                  put(f.push(d));
                  if (f.finished()) break;
                }
              }

              put(f.end());
              if (!got.trim()) console.error("debate:reply empty");
            } catch (e) {
              console.error("debate:stream rip", e);
            } finally {
              c.close();
            }
          },
        }),
        {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "x-content-type-options": "nosniff",
            "cache-control": "no-store",
            "x-accel-buffering": "no",
          },
        }
      );
    }

    if (b.action === "judge") {
      if (turns.length < 2) return err("There is not enough of a round here to judge.", 400);

      // nobody actually argued
      if (!worthJudging(turns))
        return err(
          "There is no round here to judge yet. Make an argument, in a sentence or two, and the ballot will have something to mark.",
          400
        );

      const sys = setup.tab === "competitive" ? competitiveSystem(setup) : casualSystem(setup);
      const raw = await chatJSON(sys, render(turns), ballotish);
      return NextResponse.json({ ballot: tidy(raw) });
    }

    return err("Unknown action.", 400);
  } catch (e) {
    if (e instanceof AIError) return err(e.message, e.status);
    console.error("debate:rip", e);
    return err("Oops! Something went wrong on our end :(", 500);
  }
}
