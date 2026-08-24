import type { Question } from "./types";

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

function terms(s: string): Set<string> {
  return new Set(
    flatten(s)
      .split(" ")
      .filter((w) => w.length > 1 && !EMPTY.has(w))
      .map(stem)
  );
}

export type Signature = {
  concept: string;
  answer: string;
  prompt: Set<string>;
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

function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const term of a) if (b.has(term)) shared++;
  return shared / (a.size + b.size - shared);
}

export function sameQuestion(a: Signature, b: Signature): boolean {
  if (
    a.answerIsTheQuestion &&
    b.answerIsTheQuestion &&
    a.answer === b.answer &&
    a.concept === b.concept
  ) {
    return true;
  }

  const shared = overlap(a.prompt, b.prompt);

  if (a.answer === b.answer && shared >= 0.34) return true;

  return shared >= 0.6;
}

export type Sifted = {
  kept: Question[];
  repeats: number;
};

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

const DRY = 2 / 3;

export function runningDry(kept: number, wanted: number): boolean {
  return wanted > 0 && kept < Math.ceil(wanted * DRY);
}
