# Skins

A skin changes how a question is **presented** and how an answer is
**selected**. It changes nothing else.

The question, the answer checking, the difficulty ladder, the timer and the
grading are identical whichever skin is running. A skin cannot reach any of
them: it is handed a question and a callback, and that is the whole surface.
This is what makes skins safe to add casually. Variety is worth having, and a
presentation layer that could touch the 70 to 80 percent success target would
not be worth the risk.

## Adding one

Two steps.

1. Write `app/round/skins/yourskin.tsx`, exporting a `Skin`.
2. Add it to the `SKINS` array in `registry.ts`.

Nothing in `app/round/` changes. Nothing else imports your file.

```tsx
"use client";

import type { Skin, SkinProps } from "./types";

function YourSurface({ question, revealed, chosen, onAnswer }: SkinProps) {
  // Present question.prompt and question.options however you like.
  // Call onAnswer(index) when the student commits.
}

export const yourskin: Skin = {
  id: "yourskin",              // stable forever once shipped
  name: "Your skin",           // two words at most
  presents: ["choice"],        // formats it can render
  supports: (q) => (q.options?.length ?? 0) >= 4,  // optional per-question veto
  Component: YourSurface,
};
```

## What `onAnswer` takes

The same shapes `isCorrect` in `../engine.ts` already accepts, so a skin cannot
invent an answer that checking does not understand.

| Format | Commit |
| --- | --- |
| `recognition`, `choice` | `onAnswer(optionIndex)` |
| `blank` | `onAnswer(text)` |
| `assemble` | `onAnswer(chips)` |

## Rules

These are not style preferences. A skin that breaks one is worse than no skin.

1. **Never make the retrieval harder to perform.** Difficulty is the
   question's job. No precision dragging, no reflex tests, no answer that can
   move out of reach before it is chosen. If your skin moves things, they must
   move slowly, never leave, and stop when anyone reaches for them.
2. **Keyboard accessible.** Number keys `1` to `n` must select. Always. A skin
   must be completely playable without a pointer.
3. **Colourblind safe.** Correct and incorrect carry a shape and a word, never
   colour alone. Use `--solid-mark` and `--broken-mark`, the pair already
   validated for deuteranopia in `globals.css`.
4. **No text of its own** beyond the question and the options. A skin is a
   presentation, not a narrator.
5. **Honour `prefers-reduced-motion`.** The reduced version must be a complete,
   playable presentation, not a broken one. If your skin cannot survive having
   its motion removed, it should not exist.

## What the system does for you

- **Fallback.** `SkinBoundary` catches a throw and re-renders the question in
  Plain, in place, with the answer still to give. A bad skin costs a student
  their decoration, never their round.
- **Eligibility.** A skin is never handed a format outside its `presents`, or a
  question its `supports` vetoed.
- **Rotation.** By session seed and round, so a round keeps one skin the whole
  way through and two sessions on the same topic do not play identically.
- **Round 4 is excluded** in `registry.ts`, not by convention. Open production
  has to be unscaffolded, and a presentation layer is exactly the thing that
  would quietly scaffold it.
- **Off switch.** The student can turn skins off and play Plain throughout.

## Current library

| Skin | Presents | Notes |
| --- | --- | --- |
| Plain | everything | Always available. The fallback. |
| Wire connect | `choice` | Needs 3+ options. Click, drag or number keys. |
| Fishing | `recognition`, `choice` | Options under 28 characters, so a pill fits its lane. |
