import type { Format, Question } from "../types";

/* The skin contract.

   A skin changes how a question is PRESENTED and how an answer is SELECTED.
   It changes nothing else. The question, the answer checking, the difficulty
   ladder, the timer and the grading are identical whichever skin is on, and a
   skin has no way to reach any of them: it is handed a question and a way to
   report an answer, and that is the entire surface.

   This is deliberate. Variety is worth having, but a game that makes the
   retrieval itself harder has stopped being a study tool and become a test of
   dexterity, and the moment a skin could reach the ladder it could quietly
   break the 70 to 80 percent success target the whole design rests on.

   ── Adding a skin ────────────────────────────────────────────────────────
   One file in this directory, and one line in registry.ts. Nothing in
   app/round/ needs to change. See README.md.

   ── Rules a skin must keep ───────────────────────────────────────────────
   1. Never make the retrieval harder to perform. Difficulty is the question's
      job. No precision dragging, no reflex tests, no answer that can move out
      of reach before it is chosen.
   2. Keyboard accessible. Number keys 1 to n must select, always.
   3. Colourblind safe. Correct and incorrect carry a shape and a word, never
      colour alone. The validated pair is --solid-mark and --broken-mark.
   4. No text of its own beyond the question and the options. A skin is a
      presentation, not a narrator.
   5. Honour prefers-reduced-motion. Any skin whose motion cannot be removed
      without breaking it is a skin that should not exist.
------------------------------------------------------------------------- */

/** What a skin hands back when the student commits.

    The same shapes `isCorrect` in engine.ts already accepts, so a skin cannot
    invent a new kind of answer that checking does not understand:
    - number    an option index, for recognition and choice
    - string    typed text, for blank
    - string[]  assembled chips, for assemble */
export type SkinAnswer = string | number | string[];

export type SkinProps = {
  question: Question;
  /** The answer has been committed and the outcome is now on screen. A skin
      must stop accepting input when this is true. */
  revealed: boolean;
  /** Whether the committed answer was right. Only meaningful once revealed. */
  correct: boolean;
  /** The option index the student picked, for skins presenting options. */
  chosen: number | null;
  /** Current text, for skins presenting a typed answer. */
  value: string;
  onChange: (v: string) => void;
  /** Chips placed so far, for skins presenting an assembly. Its own channel
      rather than an encoding of `value`: chips are phrases and contain
      spaces, so any string encoding of them loses where one chip ends. */
  built: string[];
  onBuild: (chips: string[]) => void;
  /** Commit an answer. Calling this is the only thing a skin can do to the
      session, and it may only be called once per question. */
  onAnswer: (given: SkinAnswer) => void;
};

export type Skin = {
  /** Stable identifier. Used for rotation and for the "skins off" setting, so
      it must not change once a skin has shipped. */
  id: string;
  /** Shown in the skin picker. Two words at most. */
  name: string;
  /** Which question formats this skin is able to present. A skin is never
      offered a format outside this list. */
  presents: Format[];
  /** An optional veto for a specific question, for skins that need more than
      the format guarantees. A wire board needs four options to be worth
      drawing, for instance. Returning false falls back to Plain. */
  supports?: (q: Question) => boolean;
  Component: React.ComponentType<SkinProps>;
};

/** The format families a skin can belong to, as the round formats map onto
    them. Kept as a helper rather than a second taxonomy: `presents` is the
    single source of truth, and this only exists to describe skins in prose. */
export const FAMILY: Record<Format, "choice" | "blank" | "assemble" | "open"> = {
  recognition: "choice",
  choice: "choice",
  blank: "blank",
  assemble: "assemble",
  open: "open",
};
