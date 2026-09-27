# presentations

Each round uses a presentation to draw the question. There isn't a separate
"game" and "study tool" mode, so students don't have to choose how it looks.

`plain.tsx` is the fallback. It shows up in two cases:

1. A presentation throws during a question and `boundary.tsx` catches it.
2. Nothing in the registry can draw the question, usually because the options are
   too long.

Round 4 has no presentation. `registry.ts` enforces that because adding one would
put something on screen in a round designed to show nothing.

## adding one

Add one file here, import it, then add one line to `PRESENTATIONS` in
`registry.ts`. Nothing else in `app/round/` needs to change.

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
            <Mark mood={mood} />
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

Use the kit. `useOptions` tracks picks and refuses a second
answer. `Pick` is a button with its accessible name built in. `Mark` gives the
answer a shape as well as a shade. Replacing these can break keyboard play in a
way that isn't obvious. `useBlank`, `Gap` and `Commit` do the same job for round 2.

## rules

These rules affect what the session measures, so keep them in place.

1. Difficulty comes from the question, not dexterity. No precision dragging,
   reflex requirement or target that can move out of reach. Motion is scenery or
   waits until the answer is committed. The two exceptions are documented where
   they live: a two-pixel idle bob and fishing's pond, which stops when anything
   reaches for it.
2. Don't leak the answer through the target's shape, slot length or option size.
   Blank presentations size slots from what has been typed.
3. Keep keyboard input working with left and right arrows, then Enter.
4. Show right and wrong with a glyph and word as well as colour. The validated
   pair is `--solid-mark` and `--broken-mark`.
5. A presentation only draws the question and options. It doesn't add narration,
   instructions or encouragement.
6. Honor `prefers-reduced-motion`. The round must still work with animation off.
   Motion lives in `presentations.css`, which disables it in one block at the end.
