# learnova

a study app that knows the difference between what it read and what it made up.

live at [learnova.software](https://learnova.software).

## what this does

ask most ai study tools abt something obscure and they just invent it, fluently,
and you only catch it if you already knew the answer. thats the failure that
matters for a study tool, since youre using it on stuff you dont know yet.

heres learnova asked abt Tritoflex (a spray-applied rubber roofing compound) with
nothing but the name:

> **What is Tritoflex primarily classified as?** A protein.
> **Which structural motif is common in Tritoflex?** Alpha helix.
> **What is the main role of Tritoflex?** Signal transduction.

its roofing material. the model had never heard of it and confidently produced
biochemistry. a student meeting the word for the first time has no way to tell.

learnova doesnt pretend thats solved, it makes the difference visible:

- **topic only** and every screen says `AI · unchecked`. nothing verified. the
  marks on your explanation are one model's opinion and they say so.
- **your own material** and every question has to quote it word for word. the
  quote gets checked on the server before you see the question, anything the model
  couldnt find in your notes gets binned.

same question with the real spec sheet pasted in:

> **How is Tritoflex applied to the substrate?** Cold with airless spray.
> *cited:* "applied cold with airless spray equipment"

Both real output from the route, 15 aug 2026. the grounded one is the worked
example still sitting on the entry screen under "I have notes to paste".

## how to start

```
npm i
npm run dev
```

needs `HACKCLUB_AI_KEY` in `.env.local` or nothing works. `ABLY_API_KEY` too if
you want live debate, everything else runs without it.

tests, such as they are:

```
node --experimental-strip-types scripts/spread.mjs      # 32 assertions on the chunker
node --experimental-strip-types scripts/positions.mjs   # answer placement, needs the app running
```

## the two modes

**round mode.** name a topic, start guessing. five stages pull the scaffolding
away a rung at a time: two options, four options, sentence with the term missing,
sentence in pieces, then nothing on screen at all and you explain it yourself.
what it measures is the gap between what you can recognise and what you can say.

**debate.** pick a side, hold it for four speeches against an opponent trying to
take it off you, read the ballot. two tabs that never mix: open debate is judged
on whether the argument holds up, tournament prep by the conventions of a named
format against a tournament bar. format is required, not defaulted, cuz a Public
Forum ballot handed to somebody practising Lincoln-Douglas is worse than no
ballot.

first thing `/debate` asks is **model or friend**, two buttons above the motion
field. same screen either way, the toggle only changes where "Argue for" sends
you.

## live debate

picking "a friend" mints a **four character code**. read it out, they open
learnova, hit debate, pick "a friend", type it in. same four speeches, same judge,
same ballot, opponent is a person.

no shareable link, on purpose. a link needs a chat app between two devices, and
the case this is for is two people at one table where the fastest path between
their screens is somebody's voice.

thinnest thing that works: no account, no db, no room object on any server. the
room *is* an ably channel named after the code, the two people attached to it are
its entire state, and it stops existing when they both close the tab. idle rooms
let go after ten minutes.

- **a room closes when the last person leaves, not the first.** somebody goes mid
  debate (leave button, closed tab, dead connection) and the seat just empties.
  host is back to their code and can be joined again, guest gets told the other
  chair is empty. nobody gets thrown out of a room they didnt leave, which is what
  used to happen.
- cant continue with one person though. no ballot for a round that stopped partway
  and no winner either, a ballot weighs two finished cases. exception: all eight
  speeches given, transcript is complete, still goes to the judge.
- hard reload of a room url ends that room instead of rejoining. the connection
  *was* the room and it went down with the page. screen says so, offers a new one.
- **nobody presses "get the ballot"**, the eighth speech lands and it goes. both
  modes. theres still a button for ending early bcuz thats a decision, finishing
  isnt.

**won, lost, nothing kept.** a judged debate ends on a verdict and thats it.
nothing counts up across rounds. no lifetime record, no rating, no rung, no
ladder, no number to climb, either mode.

two goes at one before this, for the record. First an elo: one figure across both
modes, seven rungs, study runs capped below the upper half so the easier activity
couldnt out-climb the harder one. carefully built, measuring nothing. an elo is
relative and only means something against a field, and theres no field here, just
one person on one device playing three declared difficulty tiers of the same model
with nothing synced. then a plain won-lost-drawn record plus a count of strong
round mode runs, truer, and still a running total parked on two screens that
already had a result of their own to show. also gone.

the judge never returns a number abt you. it returns a winner, a margin and
per-dimension scores, and the winner is counted verbatim. speaker points on a
tournament ballot are arithmetic on the five dimension scores it already gave. ask
a model for speaker points directly and it says 28.5 nearly every time.

## how the grounding actually works

the bits worth reading are `app/api/round/route.ts` and `lib/chunk.ts`.

every question generated from pasted material carries a `citation`, a span the
model claims it copied out of the source. `citationHolds` checks its genuinely
there, character for character, and `keepGrounded` drops any question whose
citation isnt. a short round is the honest outcome. the number dropped gets shown
to the student, cuz a check nobody can see is only a claim.

long material gets thinned to an even spread of itself before it hits the model,
so a run covers a whole chapter instead of its first two pages. two properties
make that safe and both are measured, not asserted:

- everything shown to the model is a **literal substring** of what got pasted.
  citations are still checked against the *full* source, so thinning the prompt
  can only make the check stricter.
- passages break on **paragraph and sentence boundaries**. a span can be
  substring-true and still mislead if its cut before the "not" that governs it, so
  the one case that has to cut inside a sentence cuts at a clause joint and
  rejoins the halves.

`spread.mjs` is 32 assertions on that, checked by breaking the code to watch them
fail. mattered: two of them originally passed against the exact bugs they were
written for.

## privacy

what the code does today. this section has been wrong twice, both times bcuz the
product started storing something and the prose stayed reassuring, so its written
to be checkable instead of comforting. **anything that stores something new
updates this section in the same commit.**

### whats stored

one key in `localStorage`, on the device youre on. no accounts, no server side db.

`learnova.record.v1`, per topic youve studied: the topic as you typed it, a
normalised key, how many runs, your best score out of ten, when you last ran it,
and per concept its name, standing, highest round you ever answered it correctly
in, how many runs asked abt it, when it was last seen.

that best used to be a raw weighted total in the thousands. anything over ten in
that field was written by an older build and gets ignored rather than converted,
cuz converting needs the denominator it was earned against and that was never
stored. concept standings survive, the bar resets on your next finished run.

only key this build touches. debates arent stored at all: no result, no won-lost
record, no count of rounds played.

two keys from older builds may still be sitting on your device:
`learnova.standing.v1` (won-lost-drawn plus a count of strong runs) and
`learnova.debate.v1` (older, two rating pools). **this build neither reads nor
writes them, and doesnt delete them either.** if you used an earlier version that
data is in your browser until you clear site data. nothing in the app shows it to
you and nothing in the app removes it.

**live debate adds no key and writes nothing.** not a room list, not a transcript,
not a result. the motion you type when opening a room lives in a plain js variable
(`app/debate/live/handoff.ts`) for the one navigation into the room. thats memory
rather than storage: not localStorage, not sessionStorage, not a cookie, not in
the url, gone the moment the tab closes or reloads.

### what isnt stored

your answers, your round 4 explanations, your debate speeches, anything you paste.
sent off to be graded or to generate questions, not written to disk at either end.

same for a live room, and its worth being exact abt what "the room" even is bcuz
theres less there than youd expect. no room record on any server: no db row, no
redis entry, not even an in-memory `Map` in a route handler. a room is an ably
channel named after the code plus the one or two browsers attached to it. both
transcripts live in those browsers' memory and nowhere else, and when the last
person detaches theres nothing left to delete.

### per device, which is a real limitation

nothing synced, backed up or attached to you. open it on your phone instead of
your laptop and it starts empty. clearing site data for this domain erases all of
it with no way back.

the results screen has **forget this topic**, which drops that topic's record.
only thing there is to reset and the only in-app way to reset anything. the two
orphaned keys above come off by clearing site data, thats it.

### what leaves your device

topic you name, anything you paste, round 4 explanations, debate speeches: all go
to learnova's server, which forwards to the hack club ai proxy
(`ai.hackclub.com`), which routes to a deepseek model. two third parties, their
retention is theirs and not described here. api key stays on the server, never
reaches the browser.

**live debate adds a third, ably** (`ably.com`). every speech either person writes
travels thru an ably channel to reach the other browser, so ably sees the full
text of both sides plus the motion and the room code. retention is ably's own.
learnova's server isnt in that path at all while the round runs, right up until
the ballot, at which point the whole transcript takes the ordinary route above to
hack club and deepseek to get judged. so a live round is read by three third
parties instead of two, plus the person opposite.

`/api/live/token` takes the room code and a random per-tab id, signs a token with
`ABLY_API_KEY`, returns it. logs nothing, remembers nothing. token is scoped to
that one channel and expires in twenty minutes, so a token for one room is useless
on another. the per-tab id is generated in memory, isnt an identity, isnt stored
anywhere at either end.

### the code is the only lock on a live room

no accounts, so the four characters are the access control:

- anyone holding the code can take the empty chair. read it out where a stranger
  can hear it and they can take your debate.
- **four** characters from a 26 letter alphabet, 456,976 combinations. went from
  six to four when the link was removed, bcuz every guest types it now instead of
  tapping a url, and four is the difference between saying a word and reading out
  a serial number. thats a real reduction. what makes it ok is that a code only
  ever collides with rooms open *right now*, which is a very small number. it is
  **not** a cryptographic secret and never was.
- once two people are in, a third gets turned away (room holds two), so a guessed
  code costs you the room and not the transcript of a round already running.
- codes come from `crypto.getRandomValues`, not `Math.random`.

server keeps generated question banks in memory for up to 30 min, capped at 120
entries, gone on restart. a bank is keyed on a hash of the material that produced
it, so its only ever served back to a request supplying the same material. nothing
written to disk.

one honest caveat: if the model returns output that cant be parsed, up to 2000
chars of it go to the server log. in a grounded session that output can quote
material you pasted.

## whats actually been checked

deployed and working, both modes playable end to end. stated precisely rather than
generously:

- deployed build can lag this repo. if the app doesnt match whats here, it hasnt
  been redeployed.
- **live debate played end to end, except the judge.** with `ABLY_API_KEY` set,
  two separate browser sessions (one normal profile, one isolated context) opened
  a room, joined by typing the four characters, argued a full eight speeches.
  guest saw the motion 1.6s after pressing join, each speech reached the other
  window in 423 to 1039ms. no "room full", no "nobody is in that room" on a good
  join. judge was stubbed on that run, shared key was out of credit.
- **judge has since been run against the real model**, 22 aug 2026, once the key
  had balance. two `POST /api/debate` judge calls on a full eight speech
  transcript returned two different ballots (one per chair) with no `A`/`B`
  notation left in them, and two streaming `reply` calls came back in second
  person with no third-person naming, no em dashes, no markdown. what that does
  *not* cover: a judge call made from inside a live room by the host and mirrored
  to the guest. mirroring is verified against a stubbed ballot only.
- **disconnect timing was measured and the behaviour it was measured against has
  since changed.** ably's presence `leave` took **15.2 seconds**, tab closing to
  other screen reacting. number should still hold, its ably's and not ours. what
  it causes is different now: a room no longer ends when one side goes, so those
  15 seconds are the delay before the remaining person is told the other chair is
  empty, rather than the delay before they get thrown out. the endings themselves
  havent been re-triggered with two real browsers since that change and should be
  before anyone leans on them.
- browser testing is one machine: headless chrome on windows, mobile viewports
  emulated, not a physical phone. layout checked down to 360pt, but "works on a
  phone" means emulated chrome and not a device lab.
- no auth, no per-user rate limiting. the ai key is shared across everyone using
  the deployment, and a busy period surfaces to the student as a queue rather than
  an error.
- prompt injection hardening is outstanding. pasted material and typed topics are
  untrusted input reaching prompts directly. see the TODOs at the top of
  `app/api/round/route.ts`.

## stack

next.js, typescript, tailwind. ably for the live rooms.

## credits

learnova v2 is a solo rebuild from scratch, an earlier version was built with a
co-founder.

background music is "8bit Dungeon Level" by Kevin MacLeod, CC BY 4.0. full
attribution and anything else third-party is in CREDITS.md.

apache 2.0, see LICENSE and NOTICE. third-party assets under their own terms.
