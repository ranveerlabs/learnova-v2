import type { Format, Question } from "../types";
import { balloons } from "./choice/balloons";
import { circuit } from "./choice/circuit";
import { constellation } from "./choice/constellation";
import { crane } from "./choice/crane";
import { darts } from "./choice/darts";
import { doors } from "./choice/doors";
import { elevator } from "./choice/elevator";
import { fishing } from "./choice/fishing";
import { hoops } from "./choice/hoops";
import { lanes } from "./choice/lanes";
import { magnets } from "./choice/magnets";
import { match3 } from "./choice/match3";
import { moles } from "./choice/moles";
import { parachute } from "./choice/parachute";
import { pipes } from "./choice/pipes";
import { vending } from "./choice/vending";
import { wire } from "./choice/wire";
import { crossword } from "./blank/crossword";
import { keylock } from "./blank/keylock";
import { reels } from "./blank/reels";
import { tetris } from "./blank/tetris";
import { plain } from "./plain";
import type { Presentation } from "./types";

/* The library.

   Adding one is an import and a line in this array. Nothing else in
   app/round/ knows presentations exist: the session hands a question to
   whatever this file returns, and gets an answer back in the shape checking
   already understands.

   Plain is deliberately NOT in this list. It is the floor rather than an
   option, and putting it in the rotation would mean a student sometimes drew
   the absence of a presentation the way they might draw doors, which is not a
   thing that should be possible to draw. It is reached in exactly three ways,
   all of them below or in boundary.tsx: nothing here supports the question,
   the presentation threw, or the student asked for it. */

export const PRESENTATIONS: Presentation[] = [
  /* Choice and recognition. */
  doors,
  elevator,
  balloons,
  vending,
  crane,
  darts,
  parachute,
  lanes,
  moles,
  hoops,
  wire,
  fishing,
  constellation,
  pipes,
  magnets,
  circuit,
  match3,
  /* Fill in the blank. Typed, every one of them. */
  tetris,
  crossword,
  keylock,
  reels,
];

/** Every presentation that could draw this question. */
export function eligible(format: Format, question: Question): Presentation[] {
  return PRESENTATIONS.filter(
    (p) => p.presents.includes(format) && (p.supports?.(question) ?? true)
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

/** Which presentation draws this question.

    Rotation is by session seed and round, so a round has one presentation
    throughout rather than changing under the student mid-round, and two
    sessions on the same topic do not play identically. Consecutive rounds
    never draw the same one: the warm up and Round 1 are both option formats
    and would otherwise collide often enough to look like a bug.

    Round 4 is excluded here rather than by convention. Open production is the
    one stage that has to be unscaffolded, and a presentation is exactly the
    kind of thing that would quietly scaffold it, so the exclusion lives in
    code where it cannot be forgotten. */
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
  /** Set for the whole session by the control that only assistive technology
      and the keyboard reach. Not a preference and not in the chrome. */
  plainOnly?: boolean;
}): Presentation {
  if (plainOnly || format === "open" || round === 4) return plain;

  const options = eligible(format, question);
  if (options.length === 0) return plain;
  if (options.length === 1) return options[0];

  const here = options[hash(seed, round) % options.length];

  /* What the round before drew, computed the same way rather than remembered,
     so this stays a pure function of the seed and the round. */
  if (round > 0) {
    const previous = options[hash(seed, round - 1) % options.length];
    if (previous.id === here.id) {
      return options[(hash(seed, round) + 1) % options.length];
    }
  }

  return here;
}

/** A fresh rotation seed. Called once per session and kept in memory. */
export function newSeed(): number {
  return Math.floor(Math.random() * 1_000_000);
}
