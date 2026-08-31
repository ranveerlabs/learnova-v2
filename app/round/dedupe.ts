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

// crude on purpose, just enough that "enzymes" and "enzyme" collide
function stem(w: string): string {
  if (w.length <= 4) return w;
  if (w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.endsWith("ing") && w.length > 6) return w.slice(0, -3);
  if (w.endsWith("ed") && w.length > 5) return w.slice(0, -2);
  if (w.endsWith("es") && w.length > 5) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

const flat = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[-–—_/]+/g, " ")
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const terms = (s: string) =>
  new Set(
    flat(s)
      .split(" ")
      .filter((w) => w.length > 1 && !EMPTY.has(w))
      .map(stem)
  );

export type Signature = {
  concept: string;
  answer: string;
  prompt: Set<string>;
  answerIsTheQuestion: boolean;
};

export const signature = (q: {
  concept: string;
  answer: string;
  prompt: string;
  format: Question["format"];
}): Signature => ({
  concept: flat(q.concept),
  answer: flat(q.answer).replace(/^(?:the|a|an)\s+/, ""),
  prompt: terms(q.prompt),
  // blank and open: the answer IS the question, so same answer = same question
  answerIsTheQuestion: q.format === "blank" || q.format === "open",
});

// jaccard
function overlap(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 1;
  if (!a.size || !b.size) return 0;
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n / (a.size + b.size - n);
}

export function sameQuestion(a: Signature, b: Signature): boolean {
  if (a.answerIsTheQuestion && b.answerIsTheQuestion && a.answer === b.answer && a.concept === b.concept)
    return true;

  const o = overlap(a.prompt, b.prompt);
  if (a.answer === b.answer && o >= 0.34) return true;
  return o >= 0.6;
}

export type Sifted = { kept: Question[]; repeats: number };

export function sift(cands: Question[], seen: Signature[]): Sifted {
  const known = [...seen];
  const kept: Question[] = [];

  for (const q of cands) {
    const s = signature(q);
    if (known.some((k) => sameQuestion(s, k))) continue;
    known.push(s);
    kept.push(q);
  }

  return { kept, repeats: cands.length - kept.length };
}

const DRY = 2 / 3;

// under two thirds new = topic is used up
export const runningDry = (kept: number, want: number) => want > 0 && kept < Math.ceil(want * DRY);
