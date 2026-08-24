# Learnova

**A study app that knows the difference between what it read and what it made up.**

Live at [learnova.software](https://learnova.software).

Ask most AI study tools about something obscure and they'll invent it, fluently,
and you'll only catch it if you already knew the answer. Which is the worst
possible failure for a study tool, since the whole point is to use it on stuff
you don't know yet.

Here's Learnova asked about Tritoflex — a spray-applied rubber roofing compound
— with nothing but the name:

> **What is Tritoflex primarily classified as?** A protein.
> **Which structural motif is common in Tritoflex?** Alpha helix.
> **What is the main role of Tritoflex?** Signal transduction.

It's roofing material. The model had never heard of it and confidently produced
biochemistry, and a student meeting the word for the first time has no way to
tell.

Learnova doesn't pretend that's solved. It just makes the difference visible:

- **Give it a topic** and every screen says `AI · unchecked`. Nothing was
  verified. The marks on your explanation are one model's opinion, and they say
  so.
- **Give it your own material** and every question has to quote it word for
  word. The quote gets checked on the server before you see the question, and
  anything the model couldn't find in your notes is binned instead of shown.

Same question with the real spec sheet pasted in:

> **How is Tritoflex applied to the substrate?** Cold with airless spray.
> *cited:* "applied cold with airless spray equipment"

Both of those are real output from the route, 15 August 2026. The grounded one
is the worked example the entry screen still offers under "I have notes to
paste".

## The two modes

**Round Mode.** Name a topic and start guessing. Five stages pull the
scaffolding away a rung at a time: two options, then four, then a sentence with
the term missing, then the sentence in pieces, then nothing on screen at all and
you explain it yourself. The gap between what you can recognise and what you can
say is the entire product.

**Debate.** Pick a side, hold it for four speeches against an opponent trying to
take it off you, read the ballot. Two tabs that never mix: open debate is judged
on whether the argument holds up, tournament prep by the conventions of a named
format against a tournament bar. The format is required, not defaulted — a
Public Forum ballot handed to someone practising Lincoln-Douglas is worse than
no ballot.

The first thing `/debate` asks is **model or friend**, as two buttons above the
motion field rather than a whole second route. Everything else is identical
either way; the toggle only changes where "Argue for" sends you.

**Live debate.** Picking "a friend" mints a **four-character code**. Read it
out, they open Learnova, hit Debate, pick "a friend", type it in. Same four
speeches, same judge, same ballot, except the opponent is a person.

There's deliberately **no shareable link**. A link needs a chat app sitting
between two devices, and the case this is for is two people at one table, where
the fastest path between their screens is somebody's voice.

It's the thinnest thing that works — no account, no database, no room object on
any server. The room *is* an Ably channel named after the code, the two people
attached to it are its entire state, and it stops existing when they both close
the tab. Idle rooms let go after ten minutes.

**A room closes when the last person leaves, not the first.** If someone goes
mid-debate — Leave button, closed tab, dead connection — the seat empties and
the room carries on for whoever's left. A host is back to their code and can be
joined again; a guest gets told the other chair is empty. Nobody gets thrown out
of a room they didn't leave, which is what used to happen, and a dropped phone
on a train no longer reads as a decision.

What it can't do is continue with one person. No ballot for a round that stopped
partway and no winner either, because a ballot weighs two finished cases.
Exception: if all eight speeches were given, that transcript is complete, so it
still goes to the judge.

Two things worth knowing before you use it. Nothing about a live room is written
down anywhere. And a hard reload of a room URL ends that room rather than
rejoining — the connection *was* the room, and it went down with the page. The
screen says so and offers you a new one.

**Nobody presses "get the ballot".** The eighth speech lands and the round goes
to the judge, both modes. There's still a button for ending early, because
that's a decision. Finishing isn't.

**Won, lost, and nothing kept.** A judged debate ends on a verdict and that's
the whole of it. Nothing counts up across rounds — no lifetime record, no
rating, no rung, no ladder, no number to climb, in either mode.

There were two goes at one, for the record. First an elo: one figure across both
modes, seven rungs, study runs capped below the upper half so the easier
activity couldn't out-climb the harder one. Carefully built, measuring nothing.
An elo is relative and only means something against a field, and there's no
field here — one person, one device, three declared difficulty tiers of the same
model, nothing synced, nobody to be relative to. So it had the shape of a
competitive rating and the content of a private guess, which is exactly the
failure this app exists to avoid. Then a plain won-lost-drawn record plus a
count of strong Round Mode runs. Truer, and still a running total parked on two
screens that already had a result of their own to show. Gone too.

The judge still never returns a number about you. It returns a winner, a margin
and per-dimension scores, and the winner is counted verbatim. Speaker points on
a tournament ballot are arithmetic on the five dimension scores it already gave
— ask a model for speaker points directly and it says 28.5 nearly every time,
and a figure that never moves isn't a measurement.

## how the grounding actually works

The bits worth reading are `app/api/round/route.ts` and `lib/chunk.ts`.

Every question generated from pasted material carries a `citation`: a span the
model claims it copied out of the source. `citationHolds` checks it's genuinely
there, character for character, and `keepGrounded` drops any question whose
citation can't be found. A short round is honest; a full one padded with
invented questions isn't. The number dropped is shown to the student, because a
check nobody can see is a claim, not a guarantee.

Long material gets thinned to an even spread of itself before it reaches the
model, so a run covers a whole chapter instead of its first two pages. Two
properties make that safe, and both are measured rather than asserted:

- Everything shown to the model is a **literal substring** of what was pasted.
  Citations are still checked against the *full* source, so thinning the prompt
  can only make the check stricter.
- Passages break on **paragraph and sentence boundaries**. A span can be
  substring-true and still mislead if it's cut before the "not" that governs it,
  so the one case that has to cut inside a sentence cuts at a clause joint and
  rejoins the halves.

```
node --experimental-strip-types scripts/spread.mjs
```

32 assertions, checked by breaking the code to watch them fail. That mattered:
two of them originally passed against the exact bugs they were written for.

`scripts/positions.mjs` does the same for answer placement, against the running
app — it asks for real banks and counts where the correct option lands, because
an unbiased shuffle is easy to claim and hard to believe without numbers.

## Privacy

This describes what the code does today. It's been wrong twice, both times
because the product started storing something and the prose stayed reassuring,
so it's written to be checkable rather than comforting. **Anything that stores
something new updates this section in the same commit.**

### What's stored, and where

One key in your browser's `localStorage`, on the device you're on. No accounts,
no server-side database.

`learnova.record.v1` — per topic you've studied: the topic as you typed it, a
normalised key, how many runs you've done, your best score out of ten, when you
last ran it, and for each concept its name, its standing, the highest round you
ever answered it correctly in, how many runs asked about it, and when it was
last seen.

That best used to be a raw weighted total in the thousands. Anything above ten
in that field was written by an older build and is ignored rather than
converted, because converting it needs the denominator it was earned against and
that was never stored. Concept standings survive; the bar resets on your next
finished run.

That's the only key this build touches. Debates aren't stored at all — no
result, no won-lost record, no count of rounds played.

Two keys from older builds may still be on your device: `learnova.standing.v1`
(a won-lost-drawn record and a count of strong runs) and `learnova.debate.v1`
(older still, two rating pools). **This build neither reads nor writes them, and
it doesn't delete them either.** If you used an earlier version that data is
sitting in your browser until you clear site data — nothing in the app shows it
to you and nothing in the app removes it.

**Live debate adds no key and writes nothing.** Not a room list, not a
transcript, not a result.

The motion you type when opening a room lives in a plain JavaScript variable
(`app/debate/live/handoff.ts`) for the one navigation between the create screen
and the room. That's memory, not storage: not `localStorage`, not
`sessionStorage`, not a cookie, not in the URL, and gone the moment the tab
closes or reloads.

### What isn't stored

Your answers, the explanations you type in Round 4, your debate speeches, and
anything you paste. Those are sent off to be graded or to generate questions and
aren't written to disk at either end.

Same for a live room, and it's worth being precise about what "the room" even
is, because there's less there than you'd expect. No room record on any server —
no database row, no Redis entry, not even an in-memory `Map` in a route handler.
A room is an Ably channel named after the code plus the one or two browsers
attached to it. Both transcripts live in those browsers' memory and nowhere
else, and when the last person detaches there's nothing left to delete.

### it's per device, and yeah, that's a limitation

Nothing is synced, backed up, or attached to you. Open the app on your phone
instead of your laptop and it starts empty. Clearing site data for this domain
erases all of it with no way back.

The results screen offers **Forget this topic**, which removes that topic's
record. That's the only thing there is to reset and the only in-app way to reset
anything; the two orphaned keys above come off only by clearing site data.

### What leaves your device

The topic you name, anything you paste, your Round 4 explanations and your
debate speeches go to Learnova's server, which forwards them to the Hack Club AI
proxy (`ai.hackclub.com`), which routes them to a DeepSeek model. Two third
parties, whose retention policies are theirs and not described here. The API key
stays on the server and never reaches the browser.

**Live debate adds a third: Ably** (`ably.com`). Every speech either person
writes in a live room travels through an Ably channel to reach the other
browser, so Ably sees the full text of both sides, plus the motion and the room
code. Its retention is Ably's own. Learnova's server isn't in that path at all
while the round runs — right up until the ballot, at which point the whole
transcript takes the ordinary route above to Hack Club and DeepSeek to be
judged. So a live round is read by three third parties instead of two, and by
the person opposite, which is the point of the feature.

`/api/live/token` takes the room code and a random per-tab id, signs a token
with `ABLY_API_KEY`, returns it. Logs nothing, remembers nothing. The token is
scoped to that one channel and expires in twenty minutes, so a token for one
room can't be used on another. The per-tab id is generated in memory, isn't an
identity, and isn't stored anywhere at either end.

### A room code is the only lock on a live room

No accounts here, so the four-character code is the whole of the access control.
Plainly, what that means:

- Anyone holding the code can take the empty chair. Read it out where a stranger
  can hear it and they can take your debate.
- It's **four** characters from a 26-letter alphabet: 456,976 combinations. It
  went from six to four when the link was removed, because every guest types it
  now instead of tapping a URL, and four is the difference between saying a word
  and reading out a serial number. That's a real reduction. What makes it
  acceptable is that a code only ever collides with rooms open *right now*,
  which is a very small number. It is **not** a cryptographic secret and never
  was.
- Once two people are in, a third is turned away — the room holds two — so a
  guessed code costs you the room, not the transcript of a round already
  running.
- Codes come from `crypto.getRandomValues`, not `Math.random`.

Learnova's server keeps generated question banks in memory for up to 30 minutes,
capped at 120 entries, gone when the process restarts. A bank is keyed on a hash
of the material that produced it, so it's only ever served back to a request
supplying the same material. Nothing is written to disk.

One honest caveat: if the model returns output that can't be parsed, up to 2000
characters of that output go to the server log. In a grounded session that
output can quote the material you pasted.

## Status

Deployed and working, both modes playable end to end. Some things stated
precisely rather than generously:

- The deployed build can lag this repo. If the app doesn't match what's
  described here, it hasn't been redeployed yet.
- **Live debate has been played end to end, except for the judge.** With
  `ABLY_API_KEY` set, two separate browser sessions (one normal profile, one
  isolated context) opened a room, joined by typing the four characters, and
  argued a full eight speeches. The guest saw the motion 1.6s after pressing
  Join; each speech reached the other window in 423–1039ms. No "room full", no
  "nobody is in that room" on a good join. The judge was stubbed on that run,
  because the shared key was out of credit at the time.
- **The judge has since been exercised against the real model**, 22 August 2026,
  once the key had balance. Two `POST /api/debate` judge calls on a full
  eight-speech transcript returned two different ballots — one per chair — with
  no `A`/`B` notation left in them, and two streaming `reply` calls came back in
  the second person with no third-person naming, no em dashes, no markdown. What
  that does *not* cover: a judge call made from inside a live room by the host
  and mirrored to the guest. The mirroring is verified against a stubbed ballot
  only.
- **The disconnect timing was measured, and the behaviour it was measured
  against has since changed.** Ably's presence `leave` took **15.2 seconds** to
  arrive, tab closing to other screen reacting. That number should still hold —
  it's Ably's, not ours. What it causes is different now: a room no longer ends
  when one side goes, so those 15 seconds are the delay before the remaining
  person is told the other chair is empty, rather than the delay before they get
  thrown out. The endings themselves haven't been re-triggered with two real
  browsers since that change, and should be before anyone leans on them.
- Browser testing is one machine: headless Chrome on Windows, mobile viewports
  emulated rather than run on a physical phone. Layout checked down to 360pt,
  but "works on a phone" means emulated Chrome, not a device lab.
- No authentication and no per-user rate limiting. The AI key is shared across
  everyone using the deployment, and a busy period surfaces to the student as a
  queue rather than an error.
- Prompt-injection hardening is outstanding. Pasted material and typed topics
  are untrusted input that reaches prompts directly.

## Stack

Next.js, TypeScript, Tailwind.

## Authorship

Learnova v2 is a solo rebuild from scratch. An earlier version was built with a
co-founder. 

## Credits

Background music is "8bit Dungeon Level" by Kevin MacLeod, under CC BY 4.0. Full
attribution and anything else third-party is in CREDITS.md.

## License

Apache 2.0. See LICENSE and NOTICE. Third-party assets are under their own
terms, listed in CREDITS.md.
