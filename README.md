# Learnova

**A study app that knows the difference between what it read and what it made up.**

Ask most AI study tools about something obscure and they will
invent it, fluently and with total confidence, and you will
only notice if you already knew the answer. That is the worst
failure a study tool can have, because the whole point of one
is to be used on material you do not know yet.

Here is Learnova asked about Tritoflex, a spray-applied
rubber roofing compound, with nothing but the name to go on:

> **What is Tritoflex primarily classified as?** A protein.
> **Which structural motif is common in Tritoflex?** Alpha helix.
> **What is the main role of Tritoflex?** Signal transduction.

It is not a protein. It is roofing material. The model has
never heard of it and produced a confident biochemistry
instead, and a student studying it for the first time has no
way to tell.

Learnova's answer is not to pretend this is solved. It is to
make the difference visible and let the student choose:

- **Give it a topic** and every screen says `AI · unchecked`.
  Nothing was verified. The marks on your explanation are one
  model's opinion and say so.
- **Give it your own material** and every question has to
  quote it word for word. The quote is checked on the server
  before you ever see the question, and anything the model
  could not find in your notes is thrown away rather than
  shown to you.

Asked the same question with the real spec sheet pasted in,
it gets it right and shows its working:

> **How is Tritoflex applied to the substrate?** Cold with airless spray.
> *cited:* "applied cold with airless spray equipment"

Run `/proof` in the app to watch both happen side by side.

## The two modes

**Round Mode.** Name a topic and start guessing. Five stages
take the scaffolding away one rung at a time: two options,
then four, then a sentence with the term missing, then the
sentence in pieces, then nothing on screen at all and you
explain it in your own words. The gap between what you can
recognise and what you can say is the entire product.

**Debate.** Pick a side and hold it for four speeches against
an opponent trying to take it off you. Judged ballot,
tournament formats, and a rating shared with Round Mode, so
one number answers "am I getting better at this".

## How the grounding actually works

The part worth reading the code for is `app/api/round/route.ts`
and `lib/chunk.ts`.

Every question generated from pasted material carries a
`citation`: a span the model claims to have copied out of the
source. `citationHolds` checks it is genuinely there,
character for character, and `keepGrounded` drops any question
whose citation cannot be found. A short round is honest; a
full one padded with invented questions is not. The count of
what was dropped is shown to the student, because a check
nobody can see is a claim rather than a guarantee.

Long material is thinned to an even spread of itself before it
reaches the model, so a run covers a whole chapter rather than
its first two pages. Two properties make that safe, and both
are measured rather than asserted:

- Everything shown to the model is a **literal substring** of
  what the student pasted. Citations are still checked against
  the *full* source, so thinning the prompt can only make the
  check stricter, never looser.
- Passages break on **paragraph and sentence boundaries**. A
  span can be substring-true and still mislead if it is cut
  before the "not" that governs it, so the one case that must
  cut inside a sentence cuts at a clause joint, and the halves
  are rejoined rather than presented as separate paragraphs.

```
node --experimental-strip-types scripts/spread.mjs
```

`scripts/positions.mjs` does the same job for answer
placement, against the running app: it asks for real banks and
counts where the correct option actually lands, because an
unbiased shuffle is easy to claim and hard to believe without
numbers.

## Honest note on the research

Practice testing and spaced practice are the most strongly
supported study methods in the literature. Self-explanation
has moderate support. Learnova's contribution is not the
method itself, it is knowing what to drill, whether
understanding is real, and whether the material it is drilling
you on is real either.

## Status

Working. No accounts, no backend beyond the model calls.

## Privacy

Explanations and any pasted material are sent to a
server-side AI model. The model call happens on the server,
never in the browser, and API credentials are never exposed to
the client.

There are no user accounts and nothing you write is stored.
Pasted material lives in the tab and is gone when you close
it. One thing does outlive the tab, in this browser's local
storage and nowhere else: the names of the concepts you have
studied, how each went, and your rating, so the next run can
open on what you could not explain last time. No answers, no
explanations, and no text you wrote. The results screen says
this too, and offers to forget a topic.

## Stack

Next.js, TypeScript, Tailwind CSS.

## Authorship

Learnova v2 is a solo rebuild from scratch. An earlier
version was built with a co-founder.



## Credits

The background music is "8bit Dungeon Level" by Kevin MacLeod, used under
Creative Commons BY 4.0. See CREDITS.md for the full attribution and for
anything else third-party.

## License

Apache License 2.0. See LICENSE and NOTICE. Third-party assets are under
their own terms, listed in CREDITS.md.
