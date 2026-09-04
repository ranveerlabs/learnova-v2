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

const flat = (s: string) =>
  s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim().toLowerCase();

const tight = (s: string) => flat(s).replace(/\s+/g, "");

function citationHolds(q: string, src: string): boolean {
  if (!q.trim()) return false;
  return flat(src).includes(flat(q)) || tight(src).includes(tight(q));
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
  if (!asked.length) return "";
  const lines = asked.slice(-40).map((a) => `- ${a.prompt} (answer: ${a.answer})`);
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

function openSys(prov: Provenance): string {
  const cite = prov === "grounded" ? ',"citation":"..."' : "";

  return `Open a rapid study session on the topic given. Reply with JSON only, and keep it short.

"concepts": 3 to 5 distinct ideas worth testing, foundational first, 1 to 4 words each.

"questions": exactly ${WARM_UP_COUNT} snap questions, spread across those concepts. Each has exactly TWO options. The student answers on instinct, before studying, so these must be neither tricks nor giveaways.
- prompt: at most 12 words, fitting one line. Each option: at most 5 words. These are hard limits.
- Every question must ask for something different. No two may have the same answer.
- Write no explanation, reason or commentary anywhere. Only the fields shown below.
- No em dashes. Address the student as "you".

{"concepts":["..."],"questions":[{"concept":"...","prompt":"...","options":["...","..."],"answerIndex":1,"answer":"..."${cite}}]}`;
}

function roundSys(round: Round, concepts: string[]): string {
  const fmt = ROUND_FORMAT[round];
  const list = concepts.map((c) => `"${c}"`).join(", ");
  const per = PER_TIER;

  const shared = `You are writing one round of a rapid study session. The session escalates: each round asks the student to retrieve the SAME concepts with less help than the round before.

The concepts, which every question must be tagged with one of: ${list}

Write exactly ${per * 3} questions: ${per} "easy", ${per} "medium", and ${per} "hard". Spread them across the concepts as evenly as the concepts allow. The student will only see some of them: which ones depends on how they are doing, so every question at a given difficulty must genuinely belong at that difficulty.
${HOUSE_RULES}`;

  if (fmt === "choice") {
    return `${shared}

This is Round 1: four-option multiple choice. Exactly four options per question, exactly one correct. "answer" repeats the correct option's text.

Respond with JSON in exactly this shape:
{"questions": [{"concept": "...", "difficulty": "easy" | "medium" | "hard", "prompt": "...", "options": ["...", "...", "...", "..."], "answerIndex": 2, "answer": "...", "because": "...", "citation": "..."}]}`;
  }

  if (fmt === "blank") {
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

const strs = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");

function okRaw(v: unknown): v is RawQuestion {
  if (typeof v !== "object" || v === null) return false;
  const q = v as RawQuestion;
  return typeof q.prompt === "string" && typeof q.answer === "string";
}

type OpenPayload = { concepts: unknown; questions: unknown };
function okOpen(v: unknown): v is OpenPayload {
  if (typeof v !== "object" || v === null) return false;
  const p = v as OpenPayload;
  return strs(p.concepts) && Array.isArray(p.questions) && p.questions.every(okRaw);
}

type RoundPayload = { questions: unknown };
function okRound(v: unknown): v is RoundPayload {
  if (typeof v !== "object" || v === null) return false;
  const p = v as RoundPayload;
  return Array.isArray(p.questions) && p.questions.every(okRaw);
}

type Asked = { concept: string; answer: string; prompt: string; format: Format };

const FORMATS: Format[] = ["recognition", "choice", "blank", "assemble", "open"];

function readAsked(v: unknown): Asked[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((x) => {
    if (typeof x !== "object" || x === null) return [];
    const a = x as Record<string, unknown>;
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

const diff = (v: unknown, fb: Difficulty): Difficulty =>
  TIERS.includes(v as Difficulty) ? (v as Difficulty) : fb;

function usable(q: Question): boolean {
  if (!q.prompt.trim() || !q.answer.trim()) return false;

  if (q.format === "recognition" || q.format === "choice") {
    const n = q.format === "recognition" ? 2 : 4;
    if (q.options?.length !== n) return false;
    if (new Set(q.options.map((o) => o.trim().toLowerCase())).size !== n) return false;
    return typeof q.answerIndex === "number" && q.answerIndex >= 0 && q.answerIndex < n;
  }

  if (q.format === "assemble") {
    const c = q.chips ?? [];
    return c.length >= 4 && c.length <= 8 && c.every((x) => x.trim().length > 0);
  }

  return q.prompt.includes("_");
}

function shape(
  raw: RawQuestion,
  fmt: Format,
  fb: Difficulty,
  concepts: string[],
  i: number,
  pre: string
): Question {
  const concept =
    typeof raw.concept === "string" && concepts.includes(raw.concept)
      ? raw.concept
      : concepts[i % Math.max(1, concepts.length)] ?? "this topic";

  return {
    id: `${pre}-${i}`,
    concept,
    difficulty: diff(raw.difficulty, fb),
    format: fmt,
    prompt: String(raw.prompt).trim(),
    options: strs(raw.options) ? raw.options.map((o) => o.trim()) : undefined,
    answerIndex: typeof raw.answerIndex === "number" ? raw.answerIndex : undefined,
    accepted: strs(raw.accepted) ? raw.accepted.filter(Boolean) : undefined,
    chips: strs(raw.chips) ? raw.chips.map((c) => c.trim()).filter(Boolean) : undefined,
    answer: String(raw.answer).trim(),
    because: typeof raw.because === "string" ? raw.because.trim() : undefined,
    citation: typeof raw.citation === "string" ? raw.citation.trim() : undefined,
  };
}

function keepGrounded(qs: Question[], src: string): { kept: Question[]; dropped: number } {
  const kept = qs.filter((q) => q.citation && citationHolds(q.citation, src));
  return { kept, dropped: qs.length - kept.length };
}

const err = (msg: string, status: number) => NextResponse.json({ error: msg }, { status });

export async function POST(req: Request) {
  let b: {
    stage?: unknown;
    round?: unknown;
    topic?: unknown;
    notes?: unknown;
    concepts?: unknown;
    asked?: unknown;
  };
  try {
    b = await req.json();
  } catch {
    return err("Invalid request body.", 400);
  }

  const topic = typeof b.topic === "string" ? b.topic.trim() : "";
  if (!topic) return err("Name something to study first.", 400);

  const notes = typeof b.notes === "string" ? b.notes.trim() : "";
  if (notes.length > MAX_SOURCE_CHARS)
    return err(
      `More material than one session can work through: ${notes.length.toLocaleString()} characters against a ceiling of ${MAX_SOURCE_CHARS.toLocaleString()}. Paste the chapter or section you are actually studying.`,
      413
    );

  const prov: Provenance = notes ? "grounded" : "generated";
  const rules = prov === "grounded" ? GROUNDED_RULES : GENERATED_RULES;

  const shown = sampleForPrompt(notes);
  const asked = readAsked(b.asked);
  const seen: Signature[] = asked.map(signature);

  const cacheable = !asked.length;

  const material =
    prov === "grounded"
      ? `The student is studying: ${topic}\n\nTheir own material, which every question must come from:\n\n${shown.text}${
          shown.sampled
            ? `\n\n(This is an even spread of a longer document. "[...]" marks material that was left out: do not write questions about what might be in a gap, and never quote across one.)`
            : ""
        }`
      : `The student is studying: ${topic}`;

  try {
    if (b.stage === "open") {
      const k = bankKey({ stage: "open", topic, notes });

      if (cacheable) {
        const hit = recall(k);
        const qs = hit && prov === "grounded" ? keepGrounded(hit.questions, notes).kept : hit?.questions;

        if (hit && qs?.length) {
          return NextResponse.json({
            concepts: hit.concepts,
            questions: placeAll(qs),
            provenance: prov,
            dropped: 0,
            repeats: 0,
            exhausted: false,
            sampled: prov === "grounded" && shown.sampled,
            chunksKept: shown.kept,
            chunksTotal: shown.total,
          });
        }
      }

      const p = await chatJSON(`${openSys(prov)}\n${rules}${alreadyAsked(asked)}`, material, okOpen);

      const concepts = (p.concepts as string[]).map((c) => c.trim()).filter(Boolean).slice(0, 5);
      if (!concepts.length)
        return err("Nothing testable came back for that. Try naming the topic a little more fully.", 422);

      let qs = (p.questions as RawQuestion[])
        .map((raw, i) => shape(raw, "recognition", "easy", concepts, i, "open"))
        .filter(usable);

      let dropped = 0;
      if (prov === "grounded") {
        const chk = keepGrounded(qs, notes);
        qs = chk.kept;
        dropped = chk.dropped;
      }

      const sifted = sift(qs, seen);
      qs = sifted.kept.slice(0, WARM_UP_COUNT);

      if (!qs.length)
        return err(
          prov === "grounded"
            ? "None of the opening questions could be traced back to your notes, so none were kept. Try pasting a fuller passage."
            : "Hmm, nothing usable came back for that topic. Give it another go?",
          422
        );

      if (dropped) console.warn(`warm:dropped ${dropped} bad cite(s)`);
      if (sifted.repeats) console.warn(`warm:dropped ${sifted.repeats} repeat(s)`);

      if (cacheable) keep(k, { concepts, questions: qs, exhausted: false });

      return NextResponse.json({
        concepts,
        questions: placeAll(qs),
        provenance: prov,
        dropped,
        repeats: sifted.repeats,
        exhausted: false,
        sampled: prov === "grounded" && shown.sampled,
        chunksKept: shown.kept,
        chunksTotal: shown.total,
      });
    }

    const round = b.round;
    if (round !== 1 && round !== 2 && round !== 3) return err("Unknown round.", 400);
    if (!strs(b.concepts) || !b.concepts.length)
      return err("This round needs the session's concepts.", 400);

    const concepts = b.concepts.map((c) => c.trim()).filter(Boolean);
    const fmt = ROUND_FORMAT[round];
    const want = PER_TIER * 3;

    const k = bankKey({ stage: round, topic, notes, concepts });

    if (cacheable) {
      const hit = recall(k);
      const qs = hit && prov === "grounded" ? keepGrounded(hit.questions, notes).kept : hit?.questions;

      if (hit && qs?.length)
        return NextResponse.json({
          questions: placeAll(qs),
          provenance: prov,
          dropped: 0,
          repeats: 0,
          exhausted: hit.exhausted,
        });
    }

    const draw = async (extra: string, pre: string, against: Signature[]) => {
      const p = await chatJSON(
        `${roundSys(round, concepts)}\n${rules}${alreadyAsked(asked)}${extra}`,
        material,
        okRound
      );

      let qs = (p.questions as RawQuestion[])
        .map((raw, i) => shape(raw, fmt, "medium", concepts, i, pre))
        .filter(usable);

      let dropped = 0;
      if (prov === "grounded") {
        const chk = keepGrounded(qs, notes);
        qs = chk.kept;
        dropped = chk.dropped;
      }

      const s = sift(qs, against);
      return { kept: s.kept, repeats: s.repeats, dropped };
    };

    const first = await draw("", `r${round}`, seen);
    let kept = first.kept;
    let repeats = first.repeats;
    let dropped = first.dropped;
    let exhausted = false;

    if (runningDry(kept.length, want)) {
      console.warn(`r${round}:dry ${kept.length}/${want} new, escalating`);
      exhausted = true;

      const again = await draw(ESCALATE, `r${round}b`, [...seen, ...kept.map(signature)]);
      kept = [...kept, ...again.kept];
      repeats += again.repeats;
      dropped += again.dropped;
    }

    if (!kept.length)
      return err(
        prov === "grounded"
          ? "No questions for this round could be traced back to your notes."
          : "No usable questions came back for this round.",
        422
      );

    if (dropped) console.warn(`r${round}:dropped ${dropped} bad cite(s)`);
    if (repeats) console.warn(`r${round}:dropped ${repeats} repeat(s)`);

    if (cacheable) keep(k, { concepts, questions: kept, exhausted });

    return NextResponse.json({ questions: placeAll(kept), provenance: prov, dropped, repeats, exhausted });
  } catch (e) {
    if (e instanceof AIError) return err(e.message, e.status);
    console.error("round:rip", e);
    return err("Oops! We could not build that round :( Give it another go.", 500);
  }
}
