import type { Question } from "./types";

export type Rand = () => number;

export function seeded(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function permutation(n: number, rand: Rand): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export function applyOrder<T>(items: T[], order: number[]): T[] {
  return order.map((i) => items[i]);
}

export function shuffled<T>(items: T[], rand: Rand): T[] {
  return applyOrder(items, permutation(items.length, rand));
}

export function placeQuestion(q: Question, rand: Rand): Question {
  switch (q.format) {
    case "recognition":
    case "choice": {
      const options = q.options ?? [];
      if (options.length < 2 || typeof q.answerIndex !== "number") return q;

      const order = permutation(options.length, rand);
      return {
        ...q,
        options: applyOrder(options, order),
        answerIndex: order.indexOf(q.answerIndex),
      };
    }

    case "assemble": {
      const chips = q.chips ?? [];
      if (chips.length === 0) return q;
      return { ...q, tray: shuffled(chips, rand) };
    }

    case "blank":
    case "open":
      return q;
  }
}

export function placeAll(questions: Question[], rand: Rand = Math.random): Question[] {
  return questions.map((q) => placeQuestion(q, rand));
}

export function answerPosition(q: Question): { index: number; of: number } | null {
  if (q.format === "recognition" || q.format === "choice") {
    const of = q.options?.length ?? 0;
    if (of < 2 || typeof q.answerIndex !== "number") return null;
    return { index: q.answerIndex, of };
  }

  if (q.format === "assemble") {
    const tray = q.tray ?? [];
    const first = q.chips?.[0];
    if (tray.length === 0 || first === undefined) return null;
    const index = tray.indexOf(first);
    return index < 0 ? null : { index, of: tray.length };
  }

  return null;
}
