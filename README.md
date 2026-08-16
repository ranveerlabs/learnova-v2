# Learnova

**A study app that knows the difference between what it read and what it made up.**

Live at [learnova.software](https://learnova.software).

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

`/proof` shows both side by side.

## The two modes

**Round Mode.** Name a topic and start guessing. Five stages
take the scaffolding away one rung at a time: two options,
then four, then a sentence with the term missing, then the
sentence in pieces, then nothing on screen at all and you
explain it in your own words. The gap between what you can
recognise and what you can say is the entire product.

**Debate.** Pick a side and hold it for four speeches against
an opponent trying to take it off you, then read a judged
ballot. Two tabs that never mix: open debate is judged on
whether the argument holds up, tournament prep by the
conventions of a named format against a tournament bar. The
format is required rather than defaulted, because a Public
Forum ballot handed to somebody practising Lincoln-Douglas is
worse than no ballot.

**One rating across both.** Both modes move a single elo, by
different arithmetic for different activities: a debate is
rated against the opponent tier's declared strength, a study
run against the material it served. Seven rungs, from Fresh
through Steady, Sharp, Dangerous, Feared and Untouchable to
Legend.

Study runs are capped: they **top out just below Dangerous**,
so the upper half of the ladder is only reachable against an
opponent. Without the cap a strong study run out-climbed
somebody beating Varsity nine times in ten, which rewarded
the easier activity for being easier.

The judge never returns a rating. It returns a winner, a
margin and per-dimension scores, and `lib/elo.ts` does the
arithmetic. A model asked to update an elo returns a number
that looks like arithmetic and is not, and the failure is
invisible because every value it produces is plausible.

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

32 assertions, and they were checked by breaking the code to
watch them fail. That mattered: two of them originally passed
against the exact bugs they were written for.

`scripts/positions.mjs` does the same job for answer
placement, against the running app: it asks for real banks and
counts where the correct option actually lands, because an
unbiased shuffle is easy to claim and hard to believe without
numbers.

## Privacy

This section describes what the code does today. It has been
wrong twice, both times because the product started storing
something and the prose stayed reassuring, so it is written to
be checkable rather than comforting. **Any change that stores
something new requires updating this section in the same
commit.**

### What is stored, and where

Two keys in your browser's `localStorage`, on the device you
are using. There are no accounts and there is no server-side
database.

`learnova.record.v1` — per topic you have studied: the topic
as you typed it, a normalised key, how many runs you have
done on it, your best rating on it, when you last ran it, and
for each concept its name, its standing, the highest round you
ever answered it correctly in, how many runs asked about it,
and when it was last seen.

`learnova.standing.v1` — one elo: the rating, debates played,
won, lost and drawn, study runs finished, and the rating after
each of the last few results.

`learnova.debate.v1` — a legacy key from when debate kept its
own ratings. Read once and merged; nothing writes it any more.

### What is not stored

Your answers, the explanations you type in Round 4, your
debate speeches, and any material you paste. Those are sent to
be graded or to generate questions and are not written to disk
at either end.

### It is per device, and that is a limitation

Nothing is synced, backed up, or attached to you. Open the app
on your phone instead of your laptop and it starts empty.
Clearing site data for this domain erases all of it and there
is no way to get it back.

The results screen offers **Forget this topic**, which removes
that topic's record. There is currently **no in-app way to
reset your elo** — clearing site data is the only route.

### What leaves your device

The topic you name, any material you paste, your Round 4
explanations and your debate speeches are sent to Learnova's
server, which forwards them to the Hack Club AI proxy
(`ai.hackclub.com`), which routes them to a DeepSeek model.
Two third parties, whose own retention policies are theirs and
not described here. The API key stays on the server and is
never exposed to the browser.

Learnova's server keeps generated question banks in memory for
up to 30 minutes, capped at 120 entries and gone when the
process restarts. A bank is keyed on a hash of the material
that produced it, so it is only ever served back to a request
supplying the same material. Nothing is written to disk.

One honest caveat: if the model returns output that cannot be
parsed, up to 2000 characters of that output are written to
the server log. In a grounded session that output can quote
the material you pasted.

## Status

Deployed at [learnova.software](https://learnova.software) and
working. Both modes are playable end to end.

Some things are worth stating precisely rather than
generously:

- The deployed build can lag this repository. If the app does
  not match what is described here, it has not been
  redeployed yet.
- Browser testing has been done on one machine: headless
  Chrome on Windows, with mobile viewports emulated rather
  than run on a physical phone. Layout has been checked down
  to 360pt, but "works on a phone" means emulated Chrome, not
  a device lab.
- There is no authentication and no per-user rate limiting.
  The AI key is shared across everyone using the deployment,
  and a busy period is surfaced to the student as a queue
  rather than an error.
- Prompt-injection hardening is outstanding. Pasted material
  and typed topics are untrusted input that reaches prompts
  directly.

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
