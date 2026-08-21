import type { Format, Question } from "../types";

/* The presentation contract.

   A presentation is how a round LOOKS and how an answer is SELECTED. It is not
   a layer over the round and it is not a setting: rounds do not have a
   presentationless state to fall back to, in the same way a page of a book
   does not have a typeface-less state. There was a toggle here once, and a
   "Plain" entry in the picker sitting alongside the real ones as though it
   were a choice a student might reasonably make. Both are gone. Plain still
   exists below, and it exists for machines and for assistive technology, not
   as a taste.

   What a presentation may change is exhaustively: what is drawn, and what the
   student touches to choose. The question, the answer checking, the difficulty
   ladder, the timer and the grading are identical whichever one is on, and a
   presentation has no way to reach any of them: it is handed a question and a
   way to report an answer, and that is the entire surface.

   ── Adding one ───────────────────────────────────────────────────────────
   One file in this directory, and one line in registry.ts. Nothing in
   app/round/ needs to change. See README.md.

   ── Rules a presentation must keep ───────────────────────────────────────
   1. Never make the retrieval harder to perform. Difficulty is the question's
      job. No precision dragging, no reflex tests, no answer that can move out
      of reach before it is chosen.
   2. Keyboard accessible. Number keys 1 to n must select, always. The kit
      does this for you; do not hand-roll it.
   3. Colourblind safe. Correct and incorrect carry a shape and a word, never
      colour alone. The validated pair is --solid-mark and --broken-mark.
   4. No text of its own beyond the question and the options. A presentation
      draws; it does not narrate, instruct or encourage.
   5. Honour prefers-reduced-motion. Any presentation whose motion cannot be
      removed without breaking it is one that should not exist.
------------------------------------------------------------------------- */

/** What a presentation hands back when the student commits.

    The same shapes `isCorrect` in engine.ts already accepts, so a presentation
    cannot invent a new kind of answer that checking does not understand:
    - number    an option index, for recognition and choice
    - string    typed text, for blank
    - string[]  assembled chips, for assemble */
export type Answer = string | number | string[];

export type PresentationProps = {
  question: Question;
  /** The answer has been committed and the outcome is now on screen. A
      presentation must stop accepting input when this is true. */
  revealed: boolean;
  /** Whether the committed answer was right. Only meaningful once revealed. */
  correct: boolean;
  /** The option index the student picked, for presentations showing options. */
  chosen: number | null;
  /** Current text, for presentations taking a typed answer. */
  value: string;
  onChange: (v: string) => void;
  /** Chips placed so far, for presentations showing an assembly. Its own
      channel rather than an encoding of `value`: chips are phrases and contain
      spaces, so any string encoding of them loses where one chip ends. */
  built: string[];
  onBuild: (chips: string[]) => void;
  /** Commit an answer. Calling this is the only thing a presentation can do to
      the session, and it may only be called once per question. */
  onAnswer: (given: Answer) => void;
};

export type Presentation = {
  /** Stable identifier. Used for rotation, so it must not change once a
      presentation has shipped. */
  id: string;
  /** Human name, for the registry and for logs. Never rendered to a student:
      naming the presentation on screen would be text the round does not need. */
  name: string;
  /** Which question formats this can present. It is never offered a format
      outside this list. */
  presents: Format[];
  /** An optional veto for a specific question, for presentations that need
      more than the format guarantees. A patch board needs three or more
      options to be worth drawing, for instance. Returning false falls back to
      Plain. */
  supports?: (q: Question) => boolean;
  Component: React.ComponentType<PresentationProps>;
};

