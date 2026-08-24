import { NextResponse } from "next/server";
import { AIError, chatJSON } from "@/lib/ai";
import { bankKey, keep, recall } from "@/lib/bank-cache";
import { sampleForPrompt } from "@/lib/chunk";
import { MAX_SOURCE_CHARS } from "@/lib/source";
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

// TODO: topics and pasted notes go straight into prompts. untrusted, no hardening yet.
// TODO: rate limits before this is open to anyone but me.

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

function citationHolds(quote: string, source: string): boolean {
  if (!quote.trim()) return false;
  const q = flatten(quote);
  const tight = deflate(quote);
  return flatten(source).includes(q) || deflate(source).includes(tight);
}

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

const ESCALATE = `
IMPORTANT: your previous reply for this round was almost entirely questions the student has already answered, so it was discarded. The plain version of this topic is used up.

Do not write easier or more general questions to get around this. Go the other way:
- Ask for distinctions between two of the concepts rather than facts about one.
- Ask what follows from something, what would break if it were absent, or what a stated condition changes.
- Ask about the boundary of a rule: where it stops applying, and what happens then.
- Prefer "hard" and "medium" over "easy" throughout. If you cannot write a genuinely new easy question, write a medium one instead and label it honestly.`;

function openSystem(provenance: Provenance): string {
  const cite = provenance === "grounded" ? ',"citation":"..."' : "";

  return `Open a rapid study session on the topic given. Reply with JSON only, and keep it short.

"concepts": 3 to 5 distinct ideas worth testing, foundational first, 1 to 4 words each.

"questions": exactly ${WARM_UP_COUNT} snap questions, spread across those concepts. Each has exactly TWO options. The student answers on instinct, before studying, so these must be neither tricks nor giveaways.
- prompt: at most 12 words, fitting one line. Each option: at most 5 words. These are hard limits.
- Every question must ask for something different. No two may have the same answer.
- Write no explanation, reason or commentary anywhere. Only the fields shown below.
- No em dashes. Address the student as "you".

{"concepts":["..."],"questions":[{"concept":"...","prompt":"...","options":["...","..."],"answerIndex":1,"answer":"..."${cite}}]}`;
}

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
- Give ONLY the pieces of the correct sentence. Do not add extra, wrong or decoy pieces of any kind. Every chip you write must be used in the answer.
- "answer" is the assembled correct sentence as plain text.
- "accepted" may list one alternative full sentence that is equally correct with the same chips in a different valid order. Leave it empty if there is only one correct order, which is usually the case.
- The sentence must be a real explanation of the concept, not a definition template. It should read like something a student would be pleased to be able to say.

Respond with JSON in exactly this shape:
{"questions": [{"concept": "...", "difficulty": "easy" | "medium" | "hard", "prompt": "...", "chips": ["...", "..."], "answer": "...", "accepted": [], "because": "...", "citation": "..."}]}

"prompt" here is the instruction line, at most 10 words, for example "Build the sentence about what enzymes do to activation energy."`;
}

type RawQuestion = {
  concept?: unknown;
  difficulty?: unknown;
  prompt?: unknown;
  options?: unknown;
  answerIndex?: unknown;
  accepted?: unknown;
  chips?: unknown;
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

function asDifficulty(v: unknown, fallback: Difficulty): Difficulty {
  return TIERS.includes(v as Difficulty) ? (v as Difficulty) : fallback;
}

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
    answer: String(raw.answer).trim(),
    because: typeof raw.because === "string" ? raw.because.trim() : undefined,
    citation: typeof raw.citation === "string" ? raw.citation.trim() : undefined,
  };
}

function keepGrounded(questions: Question[], source: string): { kept: Question[]; dropped: number } {
  const kept = questions.filter((q) => q.citation && citationHolds(q.citation, source));
  return { kept, dropped: questions.length - kept.length };
}

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
  if (notes.length > MAX_SOURCE_CHARS) {
    return NextResponse.json(
      {
        error: `That is more material than one session can work through: ${notes.length.toLocaleString()} characters against a ceiling of ${MAX_SOURCE_CHARS.toLocaleString()}. Paste the chapter or section you are actually studying.`,
      },
      { status: 413 }
    );
  }

  const provenance: Provenance = notes ? "grounded" : "generated";
  const rules = provenance === "grounded" ? GROUNDED_RULES : GENERATED_RULES;

  const shown = sampleForPrompt(notes);

  const asked = readAsked(body.asked);
  const seen: Signature[] = asked.map(signature);

  const shareable = asked.length === 0;

  const material =
    provenance === "grounded"
      ? `The student is studying: ${topic}\n\nTheir own material, which every question must come from:\n\n${shown.text}${
          shown.sampled
            ? `\n\n(This is an even spread of a longer document. "[...]" marks material that was left out: do not write questions about what might be in a gap, and never quote across one.)`
            : ""
        }`
      : `The student is studying: ${topic}`;

  try {
    if (body.stage === "open") {
      const key = bankKey({ stage: "open", topic, notes });

      if (shareable) {
        const hit = recall(key);
        const questions =
          hit && provenance === "grounded" ? keepGrounded(hit.questions, notes).kept : hit?.questions;

        if (hit && questions && questions.length > 0) {
          return NextResponse.json({
            concepts: hit.concepts,
            questions: placeAll(questions),
            provenance,
            dropped: 0,
            repeats: 0,
            exhausted: false,
            sampled: provenance === "grounded" && shown.sampled,
            chunksKept: shown.kept,
            chunksTotal: shown.total,
          });
        }
      }

      const payload = await chatJSON(
        `${openSystem(provenance)}\n${rules}${alreadyAsked(asked)}`,
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

      const sifted = sift(questions, seen);
      questions = sifted.kept.slice(0, WARM_UP_COUNT);

      if (questions.length === 0) {
        return NextResponse.json(
          {
            error:
              provenance === "grounded"
                ? "None of the opening questions could be traced back to your notes, so none were kept. Try pasting a fuller passage."
                : "Hmm, nothing usable came back for that topic. Give it another go?",
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

      if (shareable) keep(key, { concepts, questions, exhausted: false });

      return NextResponse.json({
        concepts,
        questions: placeAll(questions),
        provenance,
        dropped,
        repeats: sifted.repeats,
        exhausted: false,
        sampled: provenance === "grounded" && shown.sampled,
        chunksKept: shown.kept,
        chunksTotal: shown.total,
      });
    }

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

    const key = bankKey({ stage: round, topic, notes, concepts });

    if (shareable) {
      const hit = recall(key);
      const questions =
        hit && provenance === "grounded" ? keepGrounded(hit.questions, notes).kept : hit?.questions;

      if (hit && questions && questions.length > 0) {
        return NextResponse.json({
          questions: placeAll(questions),
          provenance,
          dropped: 0,
          repeats: 0,
          exhausted: hit.exhausted,
        });
      }
    }

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

    if (shareable) keep(key, { concepts, questions: kept, exhausted });

    return NextResponse.json({
      questions: placeAll(kept),
      provenance,
      dropped,
      repeats,
      exhausted,
    });
  } catch (err) {
    if (err instanceof AIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Round generation failed:", err);
    return NextResponse.json({ error: "Oops! We could not build that round :( Give it another go." }, { status: 500 });
  }
}
