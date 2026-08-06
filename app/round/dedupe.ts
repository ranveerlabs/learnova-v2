/* Asking the same thing twice.

   A generator handed a narrow topic will circle it. Ask for fifteen fill in
   the blank questions about photosynthesis and two of the first five will
   answer "stroma"; ask for a second round on the same topic and it will
   rewrite the first round in different words. Neither is a bug in the model.
   It is what happens when nothing tells it what has already been asked.

   Repetition is worse here than it would be in most quizzes. The whole ladder
   rests on the same concepts being retrieved with less help each time, so a
   student who meets a question they have already answered is not being tested
   on retrieval at all, they are being tested on short term memory of the last
   two minutes, and the score says the same thing either way.

   Matching on the exact string catches almost none of this. "Where does the
   Calvin cycle happen?" and "The Calvin cycle takes place in the _____." are
   different strings and the same question. So questions are compared on what
   they are asking for rather than on how they are worded.

   Pure, and deliberately conservative: it would rather drop a question that
   was only nearly a repeat than serve one that was. */

import type { Question } from "./types";

/* ── Reducing a question to what it asks ─────────────────────────────────── */

/** Words that carry no subject matter. Dropped before comparing, so two
    questions are compared on their nouns and verbs rather than on their
    grammar. */
const EMPTY = new Set([
  "a", "an", "the", "of", "in", "on", "at", "to", "for", "from", "by", "with",
  "into", "onto", "within", "during", "and", "or", "but", "if", "than", "then",
  "that", "this", "these", "those", "it", "its", "is", "are", "was", "were",
  "be", "been", "being", "do", "does", "did", "has", "have", "had", "can",
  "could", "will", "would", "may", "might", "must", "shall", "should",
  "what", "which", "who", "whom", "whose", "when", "where", "why", "how",
  "you", "your", "yours", "one", "two", "not", "no", "as", "so", "up", "out",
  "about", "over", "under", "between", "through", "because", "while", "each",
  "most", "more", "less", "least", "much", "many", "some", "any", "all",
  "part", "type", "kind", "term", "word", "name", "called", "known",
]);

/** Crude suffix stripping, so "reflects", "reflecting" and "reflect" are one
    word. Not a real stemmer and not trying to be: it only has to make two
    phrasings of the same question collide, and over-stemming here costs a
    dropped duplicate rather than a wrong answer. */
function stem(word: string): string {
  if (word.length <= 4) return word;
  if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.endsWith("ing") && word.length > 6) return word.slice(0, -3);
  if (word.endsWith("ed") && word.length > 5) return word.slice(0, -2);
  if (word.endsWith("es") && word.length > 5) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

function flatten(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[-–—_/]+/g, " ")
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The content words of a piece of text, stemmed and deduplicated. */
function terms(s: string): Set<string> {
  return new Set(
    flatten(s)
      .split(" ")
      .filter((w) => w.length > 1 && !EMPTY.has(w))
      .map(stem)
  );
}

/** Everything needed to tell whether two questions are the same question.

    The answer is kept whole rather than as terms: what a blank is asking for
    IS its answer, and "stroma" and "the stroma" have to collide. */
export type Signature = {
  concept: string;
  answer: string;
  prompt: Set<string>;
  /** Whether the answer alone settles it. True for the formats where the
      student produces the answer from nothing, because there the answer is the
      entire exercise: two sentences with a gap where "stroma" goes are the
      same retrieval whatever the sentences say. */
  answerIsTheQuestion: boolean;
};

export function signature(q: {
  concept: string;
  answer: string;
  prompt: string;
  format: Question["format"];
}): Signature {
  return {
    concept: flatten(q.concept),
    answer: flatten(q.answer).replace(/^(?:the|a|an)\s+/, ""),
    prompt: terms(q.prompt),
    answerIsTheQuestion: q.format === "blank" || q.format === "open",
  };
}

/* ── Whether two questions are one question ──────────────────────────────── */

function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const term of a) if (b.has(term)) shared++;
  return shared / (a.size + b.size - shared);
}

/** Two questions asking for the same thing, however differently they are
    worded.

    The thresholds are set where they are because the two failure modes are not
    symmetric. Dropping a question that was merely similar costs a shorter
    bank, and the banks are generated with six spare. Serving a repeat costs
    the student a question that measures nothing and a score that says it did.
    So this leans hard towards dropping. */
export function sameQuestion(a: Signature, b: Signature): boolean {
  /* Same answer, same concept, and the answer was the whole exercise. */
  if (
    a.answerIsTheQuestion &&
    b.answerIsTheQuestion &&
    a.answer === b.answer &&
    a.concept === b.concept
  ) {
    return true;
  }

  const shared = overlap(a.prompt, b.prompt);

  /* Same answer and a prompt built from broadly the same material. This is the
     rule that catches a rephrasing: the words move around, the thing being
     asked for does not. */
  if (a.answer === b.answer && shared >= 0.34) return true;

  /* No common answer, but the prompts are largely the same words. Catches the
     case where a generator reuses a question and swaps which option is
     correct, which reads as new and is not. */
  return shared >= 0.6;
}

/* ── Filtering a bank ────────────────────────────────────────────────────── */

export type Sifted = {
  kept: Question[];
  /** Dropped for repeating something already asked or already generated. */
  repeats: number;
};

/** Everything in `candidates` that is not already in `seen` and not a repeat
    of something earlier in `candidates` itself.

    Order matters and is respected: the first of a pair survives. Banks arrive
    with the easy questions first, so the survivor of a near collision is the
    one nearer the tier the student is likely to be at. */
export function sift(candidates: Question[], seen: Signature[]): Sifted {
  const known = [...seen];
  const kept: Question[] = [];

  for (const q of candidates) {
    const sig = signature(q);
    if (known.some((other) => sameQuestion(sig, other))) continue;
    known.push(sig);
    kept.push(q);
  }

  return { kept, repeats: candidates.length - kept.length };
}

/* ── When a topic has been used up ───────────────────────────────────────── */

/** Below this share of what was asked for, a bank is treated as the generator
    running out of distinct things to say rather than as a bad batch.

    Two thirds, because banks are generated with a third to spare: fifteen
    questions for a round that serves nine. Losing more than a third of a bank
    to repetition means the questions that survived will not carry the round
    on their own. */
const DRY = 2 / 3;

/** Whether the generator has run out of new questions on this topic.

    Detected rather than guessed at: it is the share of a freshly generated
    bank that turned out to be something the student has already been asked.
    A narrow topic answers this on its own, without anyone having to decide in
    advance which topics are narrow.

    What happens next is escalation, not repetition. The retry asks for a
    harder tier and a different angle, naming everything already asked, and if
    that comes back thin too the round runs short at a raised difficulty. A
    short round is honest. A round padded with questions the student answered
    four minutes ago is not. */
export function runningDry(kept: number, wanted: number): boolean {
  return wanted > 0 && kept < Math.ceil(wanted * DRY);
}
