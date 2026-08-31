import type { Question } from "./types";

export type Rand = () => number;

// mulberry32. good enough for a four item list, and seedable so a round redraws the same
export function seeded(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// fisher-yates
export function permutation(n: number, rand: Rand): number[] {
  const o = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [o[i], o[j]] = [o[j], o[i]];
  }
  return o;
}

export const applyOrder = <T,>(xs: T[], order: number[]): T[] => order.map((i) => xs[i]);

export const shuffled = <T,>(xs: T[], rand: Rand): T[] =>
  applyOrder(xs, permutation(xs.length, rand));

export function placeQuestion(q: Question, rand: Rand): Question {
  switch (q.format) {
    case "recognition":
    case "choice": {
      const opts = q.options ?? [];
      if (opts.length < 2 || typeof q.answerIndex !== "number") return q;

      const o = permutation(opts.length, rand);
      return { ...q, options: applyOrder(opts, o), answerIndex: o.indexOf(q.answerIndex) };
    }

    case "assemble": {
      const chips = q.chips ?? [];
      return chips.length ? { ...q, tray: shuffled(chips, rand) } : q;
    }

    case "blank":
    case "open":
      return q;
  }
}

export const placeAll = (qs: Question[], rand: Rand = Math.random): Question[] =>
  qs.map((q) => placeQuestion(q, rand));

// where the right answer actually landed. scripts/positions.mjs counts these
export function answerPosition(q: Question): { index: number; of: number } | null {
  if (q.format === "recognition" || q.format === "choice") {
    const of = q.options?.length ?? 0;
    if (of < 2 || typeof q.answerIndex !== "number") return null;
    return { index: q.answerIndex, of };
  }

  if (q.format === "assemble") {
    const tray = q.tray ?? [];
    const first = q.chips?.[0];
    if (!tray.length || first === undefined) return null;
    const i = tray.indexOf(first);
    return i < 0 ? null : { index: i, of: tray.length };
  }

  return null;
}
