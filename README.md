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

The first question `/debate` asks is **against the model or
against a friend**, and it is two buttons above the motion
field rather than a second route. Everything else on the
screen is the same either way; all the toggle changes is where
"Argue for" sends you.

**Live debate.** Choosing "a friend" mints a **four-character
code**. You read it out, they open Learnova, press Debate,
choose "a friend", and type it in. Same four speeches, same
judge, same ballot; the opponent is a person instead of a
model. There is deliberately **no shareable link** — a link
needs a chat app between two devices, and the case this is
actually for is two people at one table, where the fastest
path between their screens is somebody's voice.

It is the thinnest thing that works: no account, no database,
and no room object anywhere on a server. The room *is* an Ably
channel named after the code, the two people attached to it
are its entire state, and it stops existing when they both
close the tab. An idle room lets go after ten minutes.

**A round only survives while both of you do.** If one side
goes mid-debate — the Leave button, a closed tab, a connection
that dies — the round ends for the other person there and
then. What they get is not a dead end: it is a screen showing
how far it got, which speech never came, every word either of
you wrote, and who left and when. There is no ballot for it
and no winner, because a ballot weighs two finished cases and
an interrupted round has neither. There is also no rejoining,
because there is nothing left to rejoin. The one exception is
a round where all eight speeches were already given — that
transcript is complete, so whoever opened the room can still
send it to the judge after the other person has gone.

Two consequences worth knowing before you use it. A live round
**is not counted** — nothing about a live room is written
down anywhere, and a record is a thing written down. And a hard
reload of a room URL ends that room rather than rejoining it,
because the connection that was the room went down with the
page. The screen says so and offers a new one.

**Won and lost, and nothing cleverer.** A judged debate goes
on a record: how many you have won, lost and drawn on this
device. That is the whole of it. There is no rating, no rung,
no ladder and no number to climb.

There used to be. A single elo covered both modes, moved by
different arithmetic for each, across seven rungs from Fresh
to Legend, with study runs capped below the upper half so the
easier activity could not out-climb the harder one. It was
carefully built and it was measuring nothing. An elo is a
relative figure and only means something against a field;
there is no field here, just one person on one device playing
three declared difficulty tiers of the same model, with
nothing synced and nobody to be relative to. So the number had
the shape of a competitive rating and the content of a private
guess, which is the failure this whole app is built to avoid.

A record cannot drift away from what happened, needs no scale
to read, and can be checked against your own memory of the
rounds you played. It is a smaller claim and it is true.

**Round Mode runs are counted, and not as wins.** A study run
has no opponent, so it cannot be won, and picking a threshold
to call one a win would put back exactly what was taken out.
Round Mode already has its own three words for how a run went
— a strong run, some of it landed, worth another run — and
the results screen keeps a count of how many of your finished
runs landed in the strong band. Same threshold as the figure
at the top of that screen, so the two can never disagree.

The judge still never returns a number about you. It returns a
winner, a margin and per-dimension scores, and the winner is
counted verbatim. Speaker points, on a tournament ballot, are
arithmetic on the five dimension scores the judge already
gave: a model asked directly for speaker points returns 28.5
almost every time, and a figure that never moves is not a
measurement.

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

Three keys in your browser's `localStorage`, on the device you
are using. There are no accounts and there is no server-side
database.

`learnova.record.v1` — per topic you have studied: the topic
as you typed it, a normalised key, how many runs you have
done on it, your best rating on it, when you last ran it, and
for each concept its name, its standing, the highest round you
ever answered it correctly in, how many runs asked about it,
and when it was last seen.

`learnova.standing.v1` — six counts and nothing else: debates
judged, won, lost, drawn, Round Mode runs finished, and how
many of those runs were strong ones. No rating, because there
is no longer one. A book written by an older build is read for
these counts and rewritten without its rating the first time
you open the app; the old figure is dropped rather than
converted, because there is no honest scale to convert it to.

`learnova.debate.v1` — a legacy key from when debate kept two
separate rating pools. Read once for its win counts and left
alone; nothing writes it any more.

**Live debate adds no key and writes nothing.** Not a room
list, not a transcript, not a result. A live round does not
touch `learnova.standing.v1` either: it produces a ballot and
is counted nowhere, so there is nothing about it to write
down. It does not appear in your won-lost record.

The motion you type when opening a room is held in a plain
JavaScript variable (`app/debate/live/handoff.ts`) for the one
navigation between the create screen and the room. That is
memory, not storage: it is not in `localStorage`, not in
`sessionStorage`, not in a cookie and not in the URL, and it
is gone the moment the tab is closed or reloaded.

### What is not stored

Your answers, the explanations you type in Round 4, your
debate speeches, and any material you paste. Those are sent to be graded or to generate
questions and are not written to disk at either end.

The same is true of a live room, and it is worth being precise
about what "the room" even is, because there is less there
than you would expect. There is no room record on any server —
no database row, no Redis entry, not even an in-memory `Map`
in a route handler. A room is an Ably channel named after the
code plus the one or two browsers attached to it. Both
transcripts live in those browsers' memory and nowhere else,
and when the last person detaches there is nothing left to
delete.

### It is per device, and that is a limitation

Nothing is synced, backed up, or attached to you. Open the app
on your phone instead of your laptop and it starts empty.
Clearing site data for this domain erases all of it and there
is no way to get it back.

The results screen offers **Forget this topic**, which removes
that topic's record. There is currently **no in-app way to
reset your won-lost record** — clearing site data is the only
route.

### What leaves your device

The topic you name, any material you paste, your Round 4
explanations and your debate speeches are sent to Learnova's
server, which forwards them to the Hack Club AI proxy
(`ai.hackclub.com`), which routes them to a DeepSeek model.
Two third parties, whose own retention policies are theirs and
not described here. The API key stays on the server and is
never exposed to the browser.

**Live debate adds a third: Ably** (`ably.com`). Every speech
either person writes in a live room travels through an Ably
channel to reach the other browser. Ably therefore sees the
full text of both sides of a live round, along with the motion
and the room code. Its retention is Ably's own and is not
described here. Learnova's server never sees those speeches at
all while the round is running — it is not in the path — right
up until the ballot, at which point the whole transcript takes
the ordinary route above to Hack Club and DeepSeek to be
judged. So a live round is read by three third parties rather
than two, and the person opposite is reading it too, which is
the point of the feature.

`/api/live/token` receives the room code and a random
per-tab id, signs a token with `ABLY_API_KEY`, and returns it.
It logs nothing and remembers nothing. The token is scoped to
that one channel and expires in twenty minutes, so a token for
one room cannot be used on another. The per-tab id is
generated in memory, is not an identity, and is not stored
anywhere at either end.

### A room code is the only lock on a live room

There are no accounts here, so the four-character code is the
whole of the access control, and it is worth saying plainly
what that means rather than leaving it to be inferred:

- Anyone holding the code can take the empty chair. If you
  read it out where a stranger can hear it, they can take your
  debate.
- The code is **four** characters from a 26-character
  alphabet: 456,976 combinations. It went from six to four
  when the link was removed, because every guest now types it
  rather than tapping a URL, and four is the difference
  between saying a word and reading out a serial number. That
  is a real reduction, and what makes it acceptable is that a
  code only ever collides with rooms that are open *right
  now*, which is a very small number. It is **not** a
  cryptographic secret and never was.
- Once two people are in, a third is turned away — the room
  holds two — so a guessed code costs you the room, not the
  transcript of a round already under way.
- Codes are generated with `crypto.getRandomValues`, not
  `Math.random`.

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
- **Live debate has not been played end to end.** It builds,
  it typechecks, and its room logic is covered by 29
  assertions run against the compiled helpers — codes, turn
  order, both transcripts and the ballot flip. The screens
  reachable without a connection have been looked at in
  headless Chrome. What has *not* happened is two browsers in
  one room passing real speeches, because that needs an
  `ABLY_API_KEY` and there is not one on this machine. Set the
  key and the first thing to check is the join: whether the
  second tab is offered the motion, and whether the ballot
  reads correctly in *both* chairs rather than only the
  host's.
- **The disconnect endings have been read, not triggered.**
  Every end-of-room screen — dropped out, left, idle timeout,
  and the round that finished before the host went — has been
  rendered against fabricated state and checked in headless
  Chrome at 1100pt and 360pt. What has not been exercised is
  the part that fires them: whether Ably's presence `leave`
  actually arrives when a tab is closed, and how long it takes
  to. Once there is a key, close one of the two tabs
  mid-round and time it.
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
