# learnova

study rounds from a topic or your notes, plus debate against a model or a friend

live at [learnova.software](https://learnova.software).

## what this does

I asked it abt Tritoflex (a spray-applied rubber roofing compound) with
nothing but the name:

> **What is Tritoflex primarily classified as?** A protein.
> **Which structural motif is common in Tritoflex?** Alpha helix.
> **What is the main role of Tritoflex?** Signal transduction.

its roofing material. topic-only rounds say `AI · unchecked` on every screen,
and the marks on your explanation are labelled as one model's opinion

paste your own material and each question has to quote it word for word. the
server checks the quote and drops questions whose citations arent in your notes

same question with the real spec sheet pasted in:

> **How is Tritoflex applied to the substrate?** Cold with airless spray.
> cited: "applied cold with airless spray equipment"

Both real output from the route, 15 aug 2026. the grounded one is the worked
example still sitting on the entry screen under "I have notes to paste".

## how to start

```
npm i
npm run dev
```

needs `HACKCLUB_AI_KEY` in `.env.local` or nothing works. `ABLY_API_KEY` too if
you want live debate, everything else runs without it.

tests:

```
node --experimental-strip-types scripts/spread.mjs      # 32 assertions on the chunker
node --experimental-strip-types scripts/positions.mjs   # answer placement, needs the app running
```

## the two modes

round mode starts with a topic. over five stages you answer with two options,
four options, a missing term, a sentence in pieces, then an explanation of your
own. by round 5 there are no options left to recognise

debate gives each side four speeches, then a ballot. open debate judges the
argument. tournament prep also uses the rules and standards of the format you
pick. i left the format blank until you choose one, a Public Forum ballot isnt
much use for practising Lincoln-Douglas

## live debate

picking "a friend" mints a four character code. read it out, they open learnova,
hit debate, pick "a friend", type it in. each person gets four speeches and the
model judges the transcript

i left the shareable link out because i built this for two people at one table.
you can read the code out without opening a chat app to send a link

rooms use ably presence, no account or server-side room record. they close when
both people leave. idle rooms let go after ten minutes

- somebody leaves mid-debate and the seat empties. host returns to their code
  and can be joined again, guest sees that the other chair is empty. i used to
  throw both people out
- a round that stops partway gets no ballot or winner. once all eight speeches
  are in, the transcript can still go to the judge even if someone leaves
- reloading a room url doesnt rejoin it. the page tells you the connection ended
  and offers a new room
- both modes send the transcript for judging after the eighth speech. theres
  also a button to end early

neither debate mode keeps a result or rating across rounds

i tried an elo first, one figure across both modes, seven rungs, study runs
capped below the upper half. it measured one person playing three declared
difficulty tiers of the same model, no field and nothing synced. i replaced it
with won-lost-drawn and a count of strong study runs, then removed that too.
both screens already had a result to show

the ballot has a winner, a margin and per-dimension scores. the winner is used
as returned. tournament speaker points are calculated from the five dimension
scores because asking the model for them directly gave 28.5 nearly every time

## how the grounding actually works

`app/api/round/route.ts` and `lib/chunk.ts` are where this lives, both short
enough to just read.

every question generated from pasted material carries a `citation`, a span the
model claims it copied out of the source. `citationHolds` checks its genuinely
there, character for character, and `keepGrounded` drops any question whose
citation isnt. so a grounded round can come out short, and the number dropped gets
shown to the student rather than swallowed.

for long notes, the chunker takes passages from across the material instead of
stopping after the first two pages. every passage is copied from the source,
and citations are still checked against the full text

it cuts at paragraph and sentence boundaries. cutting just before a "not" can
change what a passage says, even when the words all came from the source. when
it has to split a sentence, it cuts at a clause joint and rejoins the halves

`spread.mjs` is 32 assertions on that, i checked them by breaking the code to
watch them fail and two of them originally passed against the exact bugs i had
written them for

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
converting needs the denominator it was earned against and that was never stored.
concept standings survive, the bar resets on your next finished run.

only key this build touches. debates arent stored at all, no result, no won-lost
record, no count of rounds played.

two keys from older builds may still be sitting on your device:
`learnova.standing.v1` (won-lost-drawn plus a count of strong runs) and
`learnova.debate.v1` (older, two rating pools). this build neither reads nor
writes them, and doesnt delete them either. if you used an earlier version that
data is in your browser until you clear site data. nothing in the app shows it to
you and nothing in the app removes it.

live debate adds no key and writes nothing. not a room list, not a transcript, not
a result. the motion you type when opening a room lives in a plain js variable
(`app/debate/live/handoff.ts`) for the one navigation into the room. thats memory
rather than storage: not localStorage, not sessionStorage, not a cookie, not in
the url, gone the moment the tab closes or reloads.

### what isnt stored

your answers, your round 4 explanations, your debate speeches, anything you paste.
sent off to be graded or to generate questions, not written to disk at either end.

same for a live room, and "the room" is less than youd expect. no room record on
any server: no db row, no redis entry, not even an in-memory `Map` in a route
handler. a room is an ably channel named after the code plus the one or two
browsers attached to it. both transcripts live in those browsers' memory and
nowhere else, and when the last person detaches theres nothing left to delete.

### per device

nothing synced, backed up or attached to you. open it on your phone instead of
your laptop and it starts empty. clearing site data for this domain erases all of
it with no way back.

the results screen has forget this topic, which drops that topic's record. thats
the only in-app way to reset anything. the two orphaned keys above come off by
clearing site data, thats it.

### what leaves your device

topic you name, anything you paste, round 4 explanations, debate speeches: all go
to learnova's server, which forwards to the hack club ai proxy
(`ai.hackclub.com`), which routes to a deepseek model. two third parties, their
retention is theirs and not described here. api key stays on the server, never
reaches the browser.

live debate adds a third, ably (`ably.com`). every speech either person writes
travels thru an ably channel to reach the other browser, so ably sees the full
text of both sides plus the motion and the room code, retention is ably's own.
learnova's server isnt in that path at all while the round runs, right up until
the ballot, at which point the whole transcript takes the ordinary route above to
hack club and deepseek to get judged. so three third parties read a live round
instead of two, plus the person opposite.

`/api/live/token` takes the room code and a random per-tab id, signs a token with
`ABLY_API_KEY`, returns it. logs nothing, remembers nothing. token is scoped to
that one channel and expires in twenty minutes, so a token for one room is useless
on another. the per-tab id is generated in memory, isnt an identity, isnt stored
anywhere at either end.

### vercel analytics counts page views

`@vercel/analytics` is in the root layout, so every page you open is counted by
vercel, a fourth third party. it records which route was opened and not what you
did on it: no topic, no notes, no answers, no speeches, no ballot. it sets no
cookie and doesnt build a profile across sites, and their retention is theirs.

the path to be careful abt is a live room, bcuz the url has the room code in it
and that code is the whole of the access control. the next build of the package
resolves the path thru `useParams` before it sends it, so `/debate/live/QBTR`
leaves as `/debate/live/[code]`. i checked that against the packaged
`computeRoute` rather than taking it on trust, with a real four character code.

a content blocker will stop it, and nothing in the app depends on it loading.

### the code is the only lock on a live room

no accounts, so the four characters are the access control:

- anyone holding the code can take the empty chair. read it out where a stranger
  can hear it and they can take your debate
- four characters from a 26 letter alphabet, 456,976 combinations. went from six
  to four when the link was removed, bcuz every guest types it now instead of
  tapping a url and four characters is short enough to just say out loud. thats a
  real reduction, what makes it ok is that a code only ever collides with rooms
  open right now, which is a very small number. it is **not** a cryptographic
  secret and never was
- once two people are in, a third gets turned away (room holds two), so a guessed
  code costs you the room and not the transcript of a round already running
- codes come from `crypto.getRandomValues`, not `Math.random`

server keeps generated question banks in memory for up to 30 min, capped at 120
entries, gone on restart. a bank is keyed on a hash of the material that produced
it, so its only ever served back to a request supplying the same material. nothing
written to disk.

one honest caveat: if the model returns output that cant be parsed, up to 2000
chars of it go to the server log. in a grounded session that output can quote
material you pasted.

### the feed page and github

`/feed` lists the repo's own commits and whether each one deployed. the server
asks `api.github.com` for them, unauthenticated, and holds the answer in memory
for 60 seconds so every visitor in that minute is served the same copy rather than
spending the 60 requests an hour that an unauthenticated ip gets. nothing abt you
goes into that request and nothing abt you comes back, its commit messages, shas,
author names off the commits, and deployment states. no student text, no topic, no
notes, no answers. the cache is one object, it holds public repo data only, and it
is gone on restart.

the known limitations and chaos lists on that page are static, written in
`app/feed/limits.ts`, not fetched from anywhere.

## whats actually been checked

deployed and working, both modes playable end to end. the exact state of it:

- deployed build can lag this repo. if the app doesnt match whats here, it hasnt
  been redeployed
- live debate played end to end, except the judge. with `ABLY_API_KEY` set, two
  separate browser sessions (one normal profile, one isolated context) opened a
  room, joined by typing the four characters, argued a full eight speeches. guest
  saw the motion 1.6s after pressing join, each speech reached the other window in
  423 to 1039ms. no "room full", no "nobody is in that room" on a good join. i had
  the judge stubbed on that run, shared key was out of credit
- i have since run the judge against the real model, 22 aug 2026, once the key had
  balance. two `POST /api/debate` judge calls on a full eight speech transcript
  returned two different ballots (one per chair) with no `A`/`B` notation left in
  them, and two streaming `reply` calls came back in second person with no
  third-person naming, no em dashes, no markdown. what that doesnt cover: a judge
  call made from inside a live room by the host and mirrored to the guest,
  mirroring is verified against a stubbed ballot only
- disconnect timing was measured and the behaviour it was measured against has
  since changed. ably's presence `leave` took 15.2 seconds, tab closing to other
  screen reacting. number should still hold, its ably's and not ours. what it
  causes is different now, a room no longer ends when one side goes, so those 15
  seconds are the delay before the remaining person is told the other chair is
  empty rather than the delay before they get thrown out. the endings themselves
  havent been re-triggered with two real browsers since that change and should be
  before anyone leans on them
- browser testing is one machine, headless chrome on windows, mobile viewports
  emulated, not a physical phone. layout checked down to 360pt, so "works on a
  phone" here means emulated chrome and not a device lab
- no auth, no per-user rate limiting. the ai key is shared across everyone using
  the deployment, and a busy period surfaces to the student as a queue rather than
  an error
- prompt injection hardening is outstanding. pasted material and typed topics are
  untrusted input reaching prompts directly, see the TODOs at the top of
  `app/api/round/route.ts`

## stack

next.js, typescript, tailwind. ably for the live rooms.

## credits

I rebuilt learnova v2 from scratch on my own. an earlier version was built with a
co-founder.

background music is "8bit Dungeon Level" by Kevin MacLeod, CC BY 4.0. full
attribution and anything else third-party is in CREDITS.md.

apache 2.0, see LICENSE and NOTICE. third-party assets under their own terms.
