import type { Format, Question } from "../types";
import { wire } from "./choice/wire";
import { plain } from "./plain";
import type { Presentation } from "./types";

// add one here, nothing in app/round/ changes
export const PRESENTATIONS: Presentation[] = [wire];

export function eligible(format: Format, question: Question): Presentation[] {
  return PRESENTATIONS.filter(
    (p) => p.presents.includes(format) && (p.supports?.(question) ?? true)
  );
}

// fnv-1a. same seed and round always picks the same one, so a redraw is not a reshuffle
function hash(...parts: (string | number)[]) {
  let h = 2166136261;
  for (const p of parts) {
    const s = String(p);
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
  // round 4 is unpresented, enforced here rather than left to convention
  if (plainOnly || format === "open" || round === 4) return plain;

  const ok = eligible(format, question);
  if (!ok.length) return plain;
  if (ok.length === 1) return ok[0];

  const here = ok[hash(seed, round) % ok.length];

  // nudge it along if last round drew the same one
  if (round > 0) {
    const last = ok[hash(seed, round - 1) % ok.length];
    if (last.id === here.id) return ok[(hash(seed, round) + 1) % ok.length];
  }

  return here;
}

export const newSeed = () => Math.floor(Math.random() * 1_000_000);
