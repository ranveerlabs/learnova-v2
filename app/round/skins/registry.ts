import type { Format, Question } from "../types";
import { fishing } from "./fishing";
import { plain } from "./plain";
import type { Skin } from "./types";
import { wire } from "./wire";

/* The library.

   Adding a skin is one import and one entry in this array. Nothing else in
   app/round/ knows skins exist: the session hands a question to whatever this
   file returns, and gets an answer back in the shape checking already
   understands. */

export const SKINS: Skin[] = [plain, wire, fishing];

/** Every skin that could present this question. Plain is always in the list,
    which is what makes the fallback total. */
export function eligible(format: Format, question: Question): Skin[] {
  return SKINS.filter(
    (skin) => skin.presents.includes(format) && (skin.supports?.(question) ?? true)
  );
}

/** A small deterministic hash, so rotation is stable for a given session and
    round rather than reshuffling on every render. */
function hash(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const part of parts) {
    const s = String(part);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  }
  return Math.abs(h);
}

/** Which skin presents this question.

    Rotation is by session seed and round, so a round has one skin throughout
    rather than changing under the student mid-round, and two sessions on the
    same topic do not play identically.

    Round 4 is excluded here rather than by convention. Open production is the
    one stage that has to be unscaffolded, and a presentation layer is exactly
    the kind of thing that would quietly scaffold it, so the exclusion lives
    in code where it cannot be forgotten. */
export function pickSkin({
  format,
  question,
  seed,
  round,
  enabled,
}: {
  format: Format;
  question: Question;
  seed: number;
  round: 0 | 1 | 2 | 3 | 4;
  /** The student can turn skins off and play plain throughout. */
  enabled: boolean;
}): Skin {
  if (!enabled || format === "open" || round === 4) return plain;

  const options = eligible(format, question);
  if (options.length <= 1) return plain;

  return options[hash(seed, round) % options.length];
}

/** A fresh rotation seed. Called once per session and kept in memory. */
export function newSeed(): number {
  return Math.floor(Math.random() * 1_000_000);
}
