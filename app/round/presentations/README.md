# Presentations

How a round looks. Not a layer, not a theme, and not a setting: there is no
toggle, and there is no mode in which a round is drawn without one. A student
never chooses between "the game" and "the study tool", because they are the
same thing.

`plain.tsx` is the exception that proves it. It is the floor the others stand
on, reached three ways and never by preference:

1. a presentation threw, and `boundary.tsx` caught it mid-question;
2. nothing in the registry can honestly draw this question, usually because the
   options are too long to fit the shape;
3. the student asked for it, through the control in `app/round/ui.tsx` that only
   the keyboard and assistive technology ever reach.

Round 4 is unpresented, and that is enforced in `registry.ts` rather than left
to convention. Open production is the one rung with nothing on screen; a
presentation is exactly the kind of thing that would quietly put something
back.

## Adding one

One file here, one import and one line in `PRESENTATIONS` in `registry.ts`.
Nothing in `app/round/` changes.

```tsx
"use client";

import { Mark, Pick, Say, Stage, tone, useOptions } from "../kit";
import type { Presentation, PresentationProps } from "../types";

function Surface(props: PresentationProps) {
  const { options, pick, moodOf, revealed } = useOptions(props);

  return (
    <Stage revealed={revealed} className="…">
      {options.map((option, i) => {
        const mood = moodOf(i);
        return (
          <Pick key={i} index={i} option={option} mood={mood} revealed={revealed} onPick={pick}>
            <Mark index={i} mood={mood} />
            <Say mood={mood}>{option}</Say>
          </Pick>
        );
      })}
    </Stage>
  );
}

export const thing: Presentation = {
  id: "thing",
  name: "Thing",
  presents: ["recognition", "choice"],
  Component: Surface,
};
```

Use the kit. `useOptions` binds the number keys, tracks what has been picked,
and refuses a second answer; `Pick` is a real button with the accessible name
already built; `Mark` is the shape channel. Hand-rolling any of those is how a
presentation ends up unplayable on a keyboard without anybody noticing.

`useBlank`, `Gap` and `Commit` are the same idea for Round 2.

## Rules

These are not style preferences. A presentation that breaks one of them changes
what the session measures, which makes every number it reports wrong.

1. **Difficulty comes from the question, never from dexterity.** No precision
   dragging, no reflex requirement, no target that can move out of reach. If
   something is in flight, it is scenery, or it moves only after the answer is
   committed. Two exceptions exist and both are documented where they live: a
   two pixel idle bob, and Fishing's pond, which stops the moment anything
   reaches for it.
2. **Never leak the answer.** Not through the shape of the target, not through
   the number of cells in a slot, not through which option is drawn largest.
   The blank presentations size their slots from what has been typed rather
   than from the answer for exactly this reason.
3. **Keyboard, always.** 1 to n selects. The kit does it; do not reimplement it.
4. **Colourblind safe.** Right and wrong carry a glyph and a word as well as a
   colour. `--solid-mark` and `--broken-mark` are the validated pair.
5. **No text of its own.** The question, the options, and nothing else. A
   presentation draws; it does not narrate, instruct, or encourage.
6. **`prefers-reduced-motion` is honoured**, and the presentation is fully
   playable with every animation off. All motion lives in
   `presentations.css`, which switches off in one block at the bottom.
