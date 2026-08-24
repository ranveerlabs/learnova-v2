import type { Format, Question } from "../types";
import { wire } from "./choice/wire";
import { plain } from "./plain";
import type { Presentation } from "./types";

export const PRESENTATIONS: Presentation[] = [wire];

export function eligible(format: Format, question: Question): Presentation[] {
  return PRESENTATIONS.filter(
    (p) => p.presents.includes(format) && (p.supports?.(question) ?? true)
  );
}

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

export function pickPresentation({
  format,
  question,
  seed,
  round,
  plainOnly = false,
}: {
  format: Format;
  question: Question;
  seed: number;
  round: 0 | 1 | 2 | 3 | 4;
  plainOnly?: boolean;
}): Presentation {
  if (plainOnly || format === "open" || round === 4) return plain;

  const options = eligible(format, question);
  if (options.length === 0) return plain;
  if (options.length === 1) return options[0];

  const here = options[hash(seed, round) % options.length];

  if (round > 0) {
    const previous = options[hash(seed, round - 1) % options.length];
    if (previous.id === here.id) {
      return options[(hash(seed, round) + 1) % options.length];
    }
  }

  return here;
}

export function newSeed(): number {
  return Math.floor(Math.random() * 1_000_000);
}
