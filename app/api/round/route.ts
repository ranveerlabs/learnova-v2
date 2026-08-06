import { NextResponse } from "next/server";
import { AIError, chatJSON } from "@/lib/ai";
import { runningDry, sift, signature, type Signature } from "@/app/round/dedupe";
import { placeAll } from "@/app/round/shuffle";
import {
  type Difficulty,
  type Format,
  PER_TIER,
  type Provenance,
  type Question,
  type Round,
  ROUND_FORMAT,
  TIERS,
  WARM_UP_COUNT,
} from "@/app/round/types";

// TODO: prompt-injection hardening: the topic and any pasted notes are
// untrusted input fed straight into prompts, same as the rest of the app.
// TODO: per-user abuse and rate limits before this is exposed beyond local use.

/* ── Citation checking ────────────────────────────────────────────────────
   A deliberate copy of the checks in app/api/grade/route.ts rather than a
   shared import. Grading is load-bearing and was fenced off from this work,
   and reaching into it to extract a helper would have meant editing it. The
   two must stay in step: change one, change the other.

   Everything below only ever admits a quote whose characters all appear in
   the source, in order, so it cannot let a fabricated citation through. */

function flatten(s: string): string {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function deflate(s: string): string {
  return flatten(s).replace(/\s+/g, "");
}

/** Whether a quote really appears in the student's own material. */
function citationHolds(quote: string, source: string): boolean {
  if (!quote.trim()) return false;
  const q = flatten(quote);
  const tight = deflate(quote);
  return flatten(source).includes(q) || deflate(source).includes(tight);
}

/* ── What the model is asked for ─────────────────────────────────────────

   One thing this prompt deliberately does NOT ask for: a random position for
   the correct answer. Models are poor at it, and asking would produce output
   that looks placed without being placed, which is worse than not asking
   because it invites everyone downstream to trust it. Placement happens after
   generation, in shuffle.ts, where it can be measured. The shapes below still
   show varied answer indices, because an example that always says
   "answerIndex": 0 is a demonstration of where to put the answer. */

const HOUSE_RULES = `
Hard rules for every question you write:
- LENGTH IS A HARD LIMIT, not a preference. "prompt" must be at most 12 words and must fit on one line. Each option must be at most 5 words. "because" must be one sentence of at most 20 words. A student is reading these against a clock, so every extra word is a word taken from the retrieval itself. If a question cannot be asked in 12 words, ask a narrower question.
- Do not restate the topic or the concept name inside the prompt. The student already knows what they are studying.
- Do not use em dashes anywhere in your output. Use commas, colons or separate sentences instead.
- Address the student as "you" in any explanation.
- Never write a question whose answer is given away by the wording of the question itself.
- Wrong options must be genuinely plausible to someone who half-knows the material. Never pad with obvious filler, jokes, or "none of the above".
- "because" is one short sentence saying why the right answer is right. It is shown only AFTER the student has answered, never before.
- Difficulty means how much retrieval the question demands, not how obscure the trivia is. An "easy" question asks for a central idea in plain words. A "hard" question asks for a distinction, a mechanism, or a consequence. Never make a question harder by making it more obscure.
- Every question in your reply must ask for something different. Two questions with the same answer are one question, however differently they are worded.`;

const GROUNDED_RULES = `
This session is grounded in material the student pasted. Every question MUST be answerable from that material alone.
- "citation" is a span copied VERBATIM from the pasted material, the exact characters word for word, that contains the answer. It must be a literal substring of what they pasted. Do not paraphrase it, do not tidy it, do not join two separate parts of the text.
- If you cannot find a real verbatim span that supports a question, do not write that question. A question with an invented citation is worse than one fewer question.
- Do not test anything the material does not actually say.`;

const GENERATED_RULES = `
This session has no pasted material: the student gave a topic only. Write questions from general knowledge of that topic.
- Leave "citation" as an empty string. Do not invent one.
- Stay on widely agreed, mainstream material for the topic. Do not test contested details, niche trivia, or anything you are unsure of.`;

/** What the student has already been asked, given to the model so it writes
    something new rather than the same question in other words.

    Capped, because this rides on every round call and a session accumulates
    upwards of fifty questions. The most recent are the ones a rephrasing is
    most likely to collide with, so those are the ones that fit. */
function alreadyAsked(asked: Asked[]): string {
  if (asked.length === 0) return "";
  const recent = asked.slice(-40);
  const lines = recent.map((a) => `- ${a.prompt} (answer: ${a.answer})`);
  return `
The student has ALREADY been asked the questions below, in earlier rounds of this same session. Every question you write must be genuinely new.
- Do not reuse any of these. Do not reword them. Do not ask for the same answer from a different angle: if the answer below is "stroma", do not write another question whose answer is "stroma".
- Same concepts, new ground. Ask about a different property, mechanism, consequence, comparison or edge case of the concept than the one already asked.

${lines.join("\n")}`;
}

/** The instruction added when a first attempt came back mostly repeats.

    Deliberately not "try again". A generator that has said everything it has
    to say about a narrow topic will say it again if asked the same way, so the
    second attempt asks for something different in kind rather than for another
    draw from the same pool. */
const ESCALATE = `
IMPORTANT: your previous reply for this round was almost entirely questions the student has already answered, so it was discarded. The plain version of this topic is used up.

Do not write easier or more general questions to get around this. Go the other way:
- Ask for distinctions between two of the concepts rather than facts about one.
- Ask what follows from something, what would break if it were absent, or what a stated condition changes.
- Ask about the boundary of a rule: where it stops applying, and what happens then.
- Prefer "hard" and "medium" over "easy" throughout. If you cannot write a genuinely new easy question, write a medium one instead and label it honestly.`;

/* The warm up is the only call a student ever waits on, and the whole mode
   is built on them answering something within about ten seconds of naming a
   topic. So this prompt is kept deliberately short and asks for deliberately
   short output: the round prompts can afford to be thorough because they are
   generated while the student is busy, and this one cannot. Every clause here
   has to earn the milliseconds it costs. */
const OPEN_SYSTEM = `Open a rapid study session on the topic given. Reply with JSON only, and keep it short.

"concepts": 3 to 5 distinct ideas worth testing, foundational first, 1 to 4 words each.

"questions": exactly ${WARM_UP_COUNT} snap questions, spread across those concepts. Each has exactly TWO options. The student answers on instinct, before studying, so these must be neither tricks nor giveaways.
- prompt: at most 12 words, fitting one line. Each option: at most 5 words. These are hard limits.
- because: one sentence, at most 20 words, shown only after they answer.
- Every question must ask for something different. No two may have the same answer.
- No em dashes. Address the student as "you".

{"concepts":["..."],"questions":[{"concept":"...","prompt":"...","options":["...","..."],"answerIndex":1,"answer":"...","because":"...","citation":"..."}]}`;

function roundSystem(round: Round, concepts: string[]): string {
  const format = ROUND_FORMAT[round];
  const list = concepts.map((c) => `"${c}"`).join(", ");
  const per = PER_TIER;

  const shared = `You are writing one round of a rapid study session. The session escalates: each round asks the student to retrieve the SAME concepts with less help than the round before.

The concepts, which every question must be tagged with one of: ${list}

Write exactly ${per * 3} questions: ${per} "easy", ${per} "medium", and ${per} "hard". Spread them across the concepts as evenly as the concepts allow. The student will only see some of them: which ones depends on how they are doing, so every question at a given difficulty must genuinely belong at that difficulty.
${HOUSE_RULES}`;

  if (format === "choice") {
    return `${shared}

This is Round 1: four-option multiple choice. Exactly four options per question, exactly one correct. "answer" repeats the correct option's text.

Respond with JSON in exactly this shape:
{"questions": [{"concept": "...", "difficulty": "easy" | "medium" | "hard", "prompt": "...", "options": ["...", "...", "...", "..."], "answerIndex": 2, "answer": "...", "because": "...", "citation": "..."}]}`;
  }

  if (format === "blank") {
    return `${shared}

This is Round 2: fill in the blank. No options are shown, so the student must produce the term from memory.
- "prompt" is one sentence with exactly one gap, written as five underscores: _____ . At most 16 words including the gap, so it fits on one line.
- The gap must fall on a single term or short phrase carrying real meaning, never on a connective word like "the" or "is".
- "answer" is what goes in the gap, and nothing else. Keep it to 1 to 3 words.
- No two questions in this round may have the same answer. The answer IS the question here, so two sentences with the same word missing are one question asked twice.
- "accepted" lists other forms a student might reasonably type for the same answer: a common synonym, an abbreviation, the spelled-out version of an acronym. Do not list wrong or approximate answers here. Leave it empty if there is genuinely only one way to say it.
- The rest of the sentence must make the gap unambiguous. If two different terms could both honestly fill it, rewrite the sentence.

Respond with JSON in exactly this shape:
{"questions": [{"concept": "...", "difficulty": "easy" | "medium" | "hard", "prompt": "...", "answer": "...", "accepted": ["..."], "because": "...", "citation": "..."}]}`;
  }

  return `${shared}

This is Round 3: the student assembles a sentence from chips. Nothing is written for them; they are given the pieces of the explanation out of order and must put them in order.
- "chips" is the correct sentence, already split into 5 to 7 pieces, IN THE CORRECT ORDER. Each chip is a word or a short phrase, 1 to 4 words. Split at natural joints, so each chip is a meaningful unit rather than a fragment. They are shuffled before the student sees them, so give them in reading order and do not try to mix them yourself.
- "distractors" are chips that do NOT belong in the sentence but look like they might: a plausible wrong verb, a wrong quantity, a related but incorrect term. Give 0 for easy, 1 for medium, 2 for hard.
- "answer" is the assembled correct sentence as plain text.
- "accepted" may list one alternative full sentence that is equally correct with the same chips in a different valid order. Leave it empty if there is only one correct order, which is usually the case.
- The sentence must be a real explanation of the concept, not a definition template. It should read like something a student would be pleased to be able to say.

Respond with JSON in exactly this shape:
{"questions": [{"concept": "...", "difficulty": "easy" | "medium" | "hard", "prompt": "...", "chips": ["...", "..."], "distractors": ["..."], "answer": "...", "accepted": [], "because": "...", "citation": "..."}]}

"prompt" here is the instruction line, at most 10 words, for example "Build the sentence about what enzymes do to activation energy."`;
}

/* ── Shapes coming back ──────────────────────────────────────────────── */

type RawQuestion = {
  concept?: unknown;
  difficulty?: unknown;
  prompt?: unknown;
  options?: unknown;
  answerIndex?: unknown;
  accepted?: unknown;
  chips?: unknown;
  distractors?: unknown;
  answer?: unknown;
  because?: unknown;
  citation?: unknown;
};

const isStrings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");

function isRawQuestion(v: unknown): v is RawQuestion {
  if (typeof v !== "object" || v === null) return false;
  const q = v as RawQuestion;
  return typeof q.prompt === "string" && typeof q.answer === "string";
}

type OpenPayload = { concepts: unknown; questions: unknown };
function isOpenPayload(v: unknown): v is OpenPayload {
  if (typeof v !== "object" || v === null) return false;
  const p = v as OpenPayload;
  return isStrings(p.concepts) && Array.isArray(p.questions) && p.questions.every(isRawQuestion);
}

type RoundPayload = { questions: unknown };
function isRoundPayload(v: unknown): v is RoundPayload {
  if (typeof v !== "object" || v === null) return false;
  const p = v as RoundPayload;
  return Array.isArray(p.questions) && p.questions.every(isRawQuestion);
}

/** A question the session has already generated, as the client reports it
    back. Only the four fields that decide whether something is a repeat: the
    rest of a Question is presentation and would be pointless to ship back and
    forth. */
type Asked = { concept: string; answer: string; prompt: string; format: Format };

const FORMATS: Format[] = ["recognition", "choice", "blank", "assemble", "open"];

function readAsked(v: unknown): Asked[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const a = item as Record<string, unknown>;
    if (typeof a.prompt !== "string" || typeof a.answer !== "string") return [];
    return [
      {
        prompt: a.prompt,
        answer: a.answer,
        concept: typeof a.concept === "string" ? a.concept : "",
        format: FORMATS.includes(a.format as Format) ? (a.format as Format) : "choice",
      },
    ];
  });
}

/* ── Turning raw output into questions we will actually serve ─────────── */

function asDifficulty(v: unknown, fallback: Difficulty): Difficulty {
  return TIERS.includes(v as Difficulty) ? (v as Difficulty) : fallback;
}

/** Reject anything malformed rather than serving a broken question.

    A question that cannot be answered correctly is worse than a shorter
    round: the student loses a streak to our bug and has no way to know that
    is what happened. */
function usable(q: Question): boolean {
  if (!q.prompt.trim() || !q.answer.trim()) return false;

  if (q.format === "recognition" || q.format === "choice") {
    const want = q.format === "recognition" ? 2 : 4;
    if (!q.options || q.options.length !== want) return false;
    if (new Set(q.options.map((o) => o.trim().toLowerCase())).size !== want) return false;
    return (
      typeof q.answerIndex === "number" && q.answerIndex >= 0 && q.answerIndex < want
    );
  }

  if (q.format === "assemble") {
    const chips = q.chips ?? [];
    if (chips.length < 4 || chips.length > 8) return false;
    return chips.every((c) => c.trim().length > 0);
  }

  /* blank: the gap has to actually be in the sentence, or there is nothing
     to fill. Models occasionally return the completed sentence instead. */
  return q.prompt.includes("_");
}

function shape(
  raw: RawQuestion,
  format: Format,
  fallbackDifficulty: Difficulty,
  concepts: string[],
  index: number,
  idPrefix: string
): Question {
  const concept =
    typeof raw.concept === "string" && concepts.includes(raw.concept)
      ? raw.concept
      : /* A question tagged with a concept we did not ask for would break the
           ladder, which follows the same concepts the whole way down. Pin it
           to a real one rather than dropping a usable question. */
        concepts[index % Math.max(1, concepts.length)] ?? "this topic";

  return {
    id: `${idPrefix}-${index}`,
    concept,
    difficulty: asDifficulty(raw.difficulty, fallbackDifficulty),
    format,
    prompt: String(raw.prompt).trim(),
    options: isStrings(raw.options) ? raw.options.map((o) => o.trim()) : undefined,
    answerIndex: typeof raw.answerIndex === "number" ? raw.answerIndex : undefined,
    accepted: isStrings(raw.accepted) ? raw.accepted.filter(Boolean) : undefined,
    chips: isStrings(raw.chips) ? raw.chips.map((c) => c.trim()).filter(Boolean) : undefined,
    distractors: isStrings(raw.distractors)
      ? raw.distractors.map((c) => c.trim()).filter(Boolean)
      : undefined,
    answer: String(raw.answer).trim(),
    because: typeof raw.because === "string" ? raw.because.trim() : undefined,
    citation: typeof raw.citation === "string" ? raw.citation.trim() : undefined,
  };
}

/** Drop every question whose citation is not really in the student's notes.

    In a grounded session the citation is the whole guarantee: it is what
    makes this the student's own material rather than the model's impression
    of it. A question that cannot produce one is not downgraded to uncited,
    it is dropped. A short round is honest. A round quietly padded with
    invented material is not. */
function keepGrounded(questions: Question[], source: string): { kept: Question[]; dropped: number } {
  const kept = questions.filter((q) => q.citation && citationHolds(q.citation, source));
  return { kept, dropped: questions.length - kept.length };
}

/* ── The route ───────────────────────────────────────────────────────── */

export async function POST(req: Request) {
  let body: {
    stage?: unknown;
    round?: unknown;
    topic?: unknown;
    notes?: unknown;
    concepts?: unknown;
    asked?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  if (!topic) {
    return NextResponse.json({ error: "Name something to study first." }, { status: 400 });
  }

  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  const provenance: Provenance = notes ? "grounded" : "generated";
  const rules = provenance === "grounded" ? GROUNDED_RULES : GENERATED_RULES;

  const asked = readAsked(body.asked);
  const seen: Signature[] = asked.map(signature);

  const material =
    provenance === "grounded"
      ? `The student is studying: ${topic}\n\nTheir own material, which every question must come from:\n\n${notes}`
      : `The student is studying: ${topic}`;

  try {
    /* ── The warm up, and the concepts the whole session runs on ───── */
    if (body.stage === "open") {
      const payload = await chatJSON(
        `${OPEN_SYSTEM}\n${rules}${alreadyAsked(asked)}`,
        material,
        isOpenPayload
      );

      const concepts = (payload.concepts as string[])
        .map((c) => c.trim())
        .filter(Boolean)
        .slice(0, 5);

      if (concepts.length === 0) {
        return NextResponse.json(
          { error: "Nothing testable came back for that. Try naming the topic a little more fully." },
          { status: 422 }
        );
      }

      let questions = (payload.questions as RawQuestion[])
        .map((raw, i) => shape(raw, "recognition", "easy", concepts, i, "open"))
        .filter(usable);

      let dropped = 0;
      if (provenance === "grounded") {
        const checked = keepGrounded(questions, notes);
        questions = checked.kept;
        dropped = checked.dropped;
      }

      /* The warm up sifts against itself, and against anything a previous run
         in this tab already asked on the same topic. */
      const sifted = sift(questions, seen);
      questions = sifted.kept.slice(0, WARM_UP_COUNT);

      if (questions.length === 0) {
        return NextResponse.json(
          {
            error:
              provenance === "grounded"
                ? "None of the opening questions could be traced back to your notes, so none were kept. Try pasting a fuller passage."
                : "No usable questions came back for that topic. Try again.",
          },
          { status: 422 }
        );
      }

      if (dropped > 0) {
        console.warn(`Warm up: dropped ${dropped} question(s) with unverifiable citations.`);
      }
      if (sifted.repeats > 0) {
        console.warn(`Warm up: dropped ${sifted.repeats} repeated question(s).`);
      }

      return NextResponse.json({
        concepts,
        questions: placeAll(questions),
        provenance,
        dropped,
        repeats: sifted.repeats,
        exhausted: false,
      });
    }

    /* ── One round's bank ──────────────────────────────────────────── */
    const round = body.round;
    if (round !== 1 && round !== 2 && round !== 3) {
      return NextResponse.json({ error: "Unknown round." }, { status: 400 });
    }
    if (!isStrings(body.concepts) || body.concepts.length === 0) {
      return NextResponse.json({ error: "This round needs the session's concepts." }, { status: 400 });
    }

    const concepts = body.concepts.map((c) => c.trim()).filter(Boolean);
    const format = ROUND_FORMAT[round];
    const wanted = PER_TIER * 3;

    /** One generation, validated, cited, and sifted against everything the
        session has already used. */
    const draw = async (extra: string, idPrefix: string, against: Signature[]) => {
      const payload = await chatJSON(
        `${roundSystem(round, concepts)}\n${rules}${alreadyAsked(asked)}${extra}`,
        material,
        isRoundPayload
      );

      let questions = (payload.questions as RawQuestion[])
        .map((raw, i) => shape(raw, format, "medium", concepts, i, idPrefix))
        .filter(usable);

      let dropped = 0;
      if (provenance === "grounded") {
        const checked = keepGrounded(questions, notes);
        questions = checked.kept;
        dropped = checked.dropped;
      }

      const sifted = sift(questions, against);
      return { kept: sifted.kept, repeats: sifted.repeats, dropped };
    };

    const first = await draw("", `r${round}`, seen);
    let kept = first.kept;
    let repeats = first.repeats;
    let dropped = first.dropped;
    let exhausted = false;

    /* Running dry is detected, not predicted: it is the share of a freshly
       written bank that turned out to be something the student has already
       answered. One retry, and the retry is not a retry of the same request.
       It asks for harder questions and different angles, because a generator
       that has exhausted the plain version of a topic will produce the plain
       version again if asked the same way. */
    if (runningDry(kept.length, wanted)) {
      console.warn(
        `Round ${round}: only ${kept.length} of ${wanted} were new. Escalating rather than repeating.`
      );
      exhausted = true;

      const retry = await draw(ESCALATE, `r${round}b`, [...seen, ...kept.map(signature)]);
      kept = [...kept, ...retry.kept];
      repeats += retry.repeats;
      dropped += retry.dropped;
    }

    if (kept.length === 0) {
      return NextResponse.json(
        {
          error:
            provenance === "grounded"
              ? "No questions for this round could be traced back to your notes."
              : "No usable questions came back for this round.",
        },
        { status: 422 }
      );
    }

    if (dropped > 0) {
      console.warn(`Round ${round}: dropped ${dropped} question(s) with unverifiable citations.`);
    }
    if (repeats > 0) {
      console.warn(`Round ${round}: dropped ${repeats} question(s) already asked this session.`);
    }

    return NextResponse.json({
      questions: placeAll(kept),
      provenance,
      dropped,
      repeats,
      /* The session raises the floor on difficulty when this is true, rather
         than serving anything twice. */
      exhausted,
    });
  } catch (err) {
    if (err instanceof AIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Round generation failed:", err);
    return NextResponse.json({ error: "Could not build that round. Try again." }, { status: 500 });
  }
}
