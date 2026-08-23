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

Both of those are real: they came back from the route on 15
August 2026, and the paragraph behind the grounded one is the
worked example the entry screen still offers under "I have
notes to paste". There used to be a `/proof` page showing them
side by side. It is gone, along with the strip on the landing
page that pointed at it.

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

**A room closes when the last person leaves it, not the
first.** If one side goes mid-debate — the Leave button, a
closed tab, a connection that dies — the seat empties and the
room carries on for whoever is still in it. A host is back to
their code and can be joined again; a guest is told the other
chair is empty. Nobody is thrown out of a room they did not
leave, which is what used to happen, and a dropped phone on a
train no longer reads as a decision.

What the round cannot do is continue with one person in it.
There is no ballot for a debate that stopped partway and no
winner, because a ballot weighs two finished cases and an
interrupted round has neither. The exception is a round where
all eight speeches were already given: that transcript is
complete, so it still goes to the judge.

Two consequences worth knowing before you use it. Nothing
about a live room is written down anywhere — not the room,
not the transcript, not the result. And a hard reload of a
room URL ends that room rather than rejoining it, because the
connection that was the room went down with the page. The
screen says so and offers a new one.

**Nobody presses "get the ballot".** The eighth speech lands
and the round goes to the judge, in both modes. There is still
a button for ending a round early, because that is a decision;
finishing one is not.

**Won and lost, and nothing kept.** A judged debate ends on a
verdict — you won it, a draw, you lost it — and that is the
whole of it. Nothing counts up across rounds. There is no
lifetime record, no rating, no rung, no ladder and no number
to climb, in either mode.

There have been two goes at one. First an elo: a single figure
covering both modes, moved by different arithmetic for each,
across seven rungs from Fresh to Legend, with study runs
capped below the upper half so the easier activity could not
out-climb the harder one. It was carefully built and it was
measuring nothing. An elo is a relative figure and only means
something against a field; there is no field here, just one
person on one device playing three declared difficulty tiers
of the same model, with nothing synced and nobody to be
relative to. So the number had the shape of a competitive
rating and the content of a private guess, which is the
failure this whole app is built to avoid.

Then a plain won-lost-drawn record, plus a count of how many
Round Mode runs landed in the strong band. Truer than the elo,
and still a running total sitting on two screens that had a
result of their own to show. It is gone as well. The ballot
says what happened in the round you just argued, the results
screen rates the run you just played, and neither of them
carries a scoreboard for everything before it.

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

One key in your browser's `localStorage`, on the device you
are using. There are no accounts and there is no server-side
database.

`learnova.record.v1` — per topic you have studied: the topic
as you typed it, a normalised key, how many runs you have
done on it, your best score out of ten on it, when you last
ran it, and for each concept its name, its standing, the
highest round you ever answered it correctly in, how many runs
asked about it, and when it was last seen.

The best used to be a raw weighted total in the thousands.
Anything above ten in that field was written by an older build
and is ignored rather than converted, because converting it
would need the denominator it was earned against and that was
never stored. Your concept standings survive; the bar resets
on the next run you finish.

That is the only key this build touches. Debates are not
stored at all: no result, no won-lost record, no count of
rounds played.

Two keys from older builds may still exist on your device:
`learnova.standing.v1` (a won-lost-drawn record and a count of
strong runs) and `learnova.debate.v1` (older still, two rating
pools). **This build neither reads nor writes them, and it
does not delete them.** If you used an earlier version, that
data is sitting in your browser until you clear site data —
nothing in the app shows it to you and nothing in the app
removes it.

**Live debate adds no key and writes nothing.** Not a room
list, not a transcript, not a result.

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
that topic's record. That is the only thing there is to
reset, and the only in-app way to reset anything; the two
orphaned keys above can be removed only by clearing site
data.

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
- **Live debate has now been played end to end, except for the
  judge.** With `ABLY_API_KEY` set, two separate browser
  sessions (one normal profile, one isolated context) opened a
  room, joined by typing the four characters, and argued a
  full eight speeches. The guest was shown the motion 1.6s
  after pressing Join, and each speech reached the other
  window in 423–1039ms. No "room full" and no "nobody is in
  that room" on a good join.
  The judge was stubbed on that run, because the shared key was
  out of credit at the time.
- **The judge has since been exercised against the real
  model,** on 22 August 2026, once the key had balance again.
  Two `POST /api/debate` judge calls on a full eight-speech
  transcript returned two different ballots — one addressed to
  each chair — with no `A`/`B` notation left in them, and two
  streaming `reply` calls came back in the second person with
  no third-person naming, no em dashes and no markdown. What
  that does *not* cover is a judge call made from inside a live
  room by the host and mirrored to the guest: the mirroring is
  verified against a stubbed ballot only.
- **The disconnect timing was measured, and the behaviour it
  was measured against has since changed.** Ably's presence
  `leave` took **15.2 seconds** to arrive, from a tab closing
  to the other screen reacting. That number should still hold,
  because it is Ably's and not ours. What it now causes is
  different: a room no longer ends when one side goes, so the
  15 seconds is the delay before the remaining person is told
  the other chair is empty rather than the delay before they
  are thrown out of the room. The endings themselves have not
  been re-triggered with two real browsers since that change,
  and should be before anyone leans on them.
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
