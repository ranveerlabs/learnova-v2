/* Where the correct answer sits.

   Models do not place answers uniformly. Asked for four options with one
   correct, they put the correct one first far more often than a quarter of the
   time, and asked for two they will happily put it first every time. Measured
   against the live generator on one topic: five of five warm up answers at
   index 0, and a fifteen question multiple choice bank at 7 / 5 / 3 / 0.

   That is not a cosmetic problem. A student who notices, even without knowing
   they have noticed, starts scoring on position instead of on recall, and
   every number the session reports is inflated by an unknown amount. The
   ladder reads those inflated scores and hands out difficulty on the strength
   of them, so the damage does not stay in the score.

   So the order options are generated in is never the order they are shown in.
   Placement is decided here, after generation and before the question is
   served, and the model gets no say in it.

   Everything in this file is pure and takes its randomness as an argument, so
   the distribution it produces can be measured rather than assumed. */

import type { Question } from "./types";

/** A random source. `Math.random` in production, a seeded one in the proof. */
export type Rand = () => number;

/** mulberry32. Small, fast, and good enough for shuffling a four item list;
    the point of having it at all is that a seed makes a run reproducible. */
export function seeded(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates, returning the permutation rather than the items.

    The indices are what the caller actually needs: an option list has an
    answer index pointing into it, and permuting the list without carrying that
    index along is exactly the bug this file exists to prevent. */
export function permutation(n: number, rand: Rand): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** Reorder items by a permutation of their indices. */
export function applyOrder<T>(items: T[], order: number[]): T[] {
  return order.map((i) => items[i]);
}

export function shuffled<T>(items: T[], rand: Rand): T[] {
  return applyOrder(items, permutation(items.length, rand));
}

/* ── Per format ───────────────────────────────────────────────────────────
   Every format that has an ordered list of things to look at is handled here.
   Which ones those are, and what "the correct position" means in each:

   recognition  two options, one correct. answerIndex moves with them.
   choice       four options, one correct. Same.
   assemble     the chips ARE the answer, in order, so they cannot be
                reordered. What the student sees is the tray, and the tray is
                shuffled here rather than in the browser, so the order they
                are offered in is decided once and can be measured.
   blank        typed from memory with nothing on screen to pick from. There
                is no ordered list, so there is nothing to place and nothing
                to bias. `accepted` is a set of spellings the checker will
                take, never shown, and shuffling it would change nothing.
   open         same, more so.

   The exhaustive switch is deliberate: a new format cannot be added without
   this file failing to compile until someone has decided what placement means
   for it. */

/** One question, with everything the student will look at placed. */
export function placeQuestion(q: Question, rand: Rand): Question {
  switch (q.format) {
    case "recognition":
    case "choice": {
      const options = q.options ?? [];
      /* Nothing to place, and remapping an index into a list this short would
         be the only way to get it wrong. */
      if (options.length < 2 || typeof q.answerIndex !== "number") return q;

      const order = permutation(options.length, rand);
      return {
        ...q,
        options: applyOrder(options, order),
        /* Where the old answer ended up, not where it was. */
        answerIndex: order.indexOf(q.answerIndex),
      };
    }

    case "assemble": {
      const chips = q.chips ?? [];
      if (chips.length === 0) return q;
      /* Distractors go in with the real chips: a tray that keeps them in their
         own group tells the student which pieces belong before they have
         thought about the sentence at all. */
      return { ...q, tray: shuffled([...chips, ...(q.distractors ?? [])], rand) };
    }

    case "blank":
    case "open":
      return q;
  }
}

export function placeAll(questions: Question[], rand: Rand = Math.random): Question[] {
  return questions.map((q) => placeQuestion(q, rand));
}

/* ── Reading the result back ──────────────────────────────────────────────
   The measurement side of the same idea, used by the proof script. Kept here
   rather than in the script so what is measured is defined next to what does
   the placing. */

/** Where the correct answer landed, and how many places it could have landed
    in. `null` for formats with nothing to place. */
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
    /* The chip the sentence starts with. It is the one piece a student
       scanning the tray is looking for first, so it is the one whose position
       would be worth learning if it had one. */
    const index = tray.indexOf(first);
    return index < 0 ? null : { index, of: tray.length };
  }

  return null;
}
