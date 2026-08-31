# presentations

how a round looks. not a layer, not a theme, not a setting. no toggle, and no mode
where a round gets drawn without one. a student never picks between "the game" and
"the study tool" cuz theyre the same thing.

`plain.tsx` is the exception, the floor the others stand on. reached three ways,
never by preference:

1. a presentation threw and `boundary.tsx` caught it mid-question
2. nothing in the registry can honestly draw this question, usually options too
   long for the shape
3. the student asked for it, via the control in `app/round/ui.tsx` that only the
   keyboard and assistive tech ever reach

round 4 is unpresented, enforced in `registry.ts` and not left to convention. open
production is the one rung with nothing on screen, and a presentation is exactly
the thing that would quietly put something back.

## adding one

one file here, one import, one line in `PRESENTATIONS` in `registry.ts`. nothing
in `app/round/` changes.

```tsx
"use client";

import { Mark, Pick, Say, Stage, tone, useOptions } from "../kit";
import type { Presentation, PresentationProps } from "../types";

function Surface(props: PresentationProps) {
  const { options, pick, moodOf, revealed } = useOptions(props);

  return (
    <Stage revealed={revealed} className="…">
      {options.map((o, i) => {
        const mood = moodOf(i);
        return (
          <Pick key={i} index={i} option={o} mood={mood} revealed={revealed} onPick={pick}>
            <Mark index={i} mood={mood} />
            <Say mood={mood}>{o}</Say>
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

use the kit. `useOptions` binds the number keys, tracks whats been picked and
refuses a second answer. `Pick` is a real button with the accessible name already
built. `Mark` is the shape channel. hand-roll any of them and the presentation
ends up unplayable on a keyboard without anybody noticing. `useBlank`, `Gap` and
`Commit` are the same idea for round 2.

## rules

not style preferences. break one and you change what the session measures.

1. **difficulty comes from the question, never from dexterity.** no precision
   dragging, no reflex requirement, no target that can move out of reach. anything
   in flight is scenery, or it only moves after the answer is committed. two
   exceptions, both documented where they live: a two pixel idle bob, and
   fishing's pond, which stops the moment anything reaches for it.
2. **never leak the answer.** not thru the shape of the target, not thru the
   number of cells in a slot, not thru which option is drawn largest. the blank
   presentations size their slots from whats been typed for this reason.
3. **keyboard, always.** 1 to n selects. the kit does it, dont reimplement it.
4. **colourblind safe.** right and wrong carry a glyph and a word as well as a
   colour. `--solid-mark` and `--broken-mark` are the validated pair.
5. **no text of its own.** the question, the options, nothing else. a presentation
   draws, it doesnt narrate or instruct or encourage.
6. **`prefers-reduced-motion` is honoured** and the thing is fully playable with
   every animation off. all motion lives in `presentations.css`, which switches
   off in one block at the bottom.
