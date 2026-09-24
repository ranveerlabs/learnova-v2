# learnova

five-round study sessions from a topic or pasted notes, plus debate against a
model or a friend

[learnova.software](https://learnova.software)

## run it

```sh
npm install
npm run dev
```

`HACKCLUB_AI_KEY` goes in `.env.local`. live debate also needs `ABLY_API_KEY`.

checks:

```sh
node --experimental-strip-types scripts/spread.mjs
node --experimental-strip-types scripts/positions.mjs
```

`spread.mjs` has 32 chunking and citation assertions. `positions.mjs` checks
answer placement and needs the app running.

## study

a session starts with a topic. the five stages use two choices, four choices, a
missing term, shuffled sentence pieces, then an explanation with no hint on
screen.

topic-only sessions are not grounded. a model writes and marks the questions
from its own knowledge. the session is marked `AI / unchecked`.

when notes are pasted, every generated question includes a citation. the server
checks that citation against the full source and drops the question if the text
isnt there. long notes are sampled across the document instead of only using the
beginning. `app/api/round/route.ts` and `lib/chunk.ts` contain that path.

the chunker prefers paragraph, sentence and clause boundaries. citations are
still checked against the original material after splitting.

## debate

each side gives four speeches. the model returns a winner, margin, feedback and
five scores. open debate uses a general argument rubric. tournament mode also
uses the selected format. speaker points are calculated from the five scores.

friend debate uses a four-character room code. the host reads the code out and
the other person enters it under Debate -> Friend. there is no share link.

rooms use Ably presence. a room holds two people and closes after ten minutes
without activity. leaving empties that seat. a round that stops before all eight
speeches gets no ballot. a complete transcript can still be judged if one person
leaves. reloading a room URL does not rejoin it.

neither debate mode stores a result or rating across rounds.

## privacy

this describes the current code. any change that stores something new also
updates this section.

### browser storage

the current build uses one `localStorage` key:

`learnova.record.v1` stores, per topic:

- the topic as typed and its normalised key
- run count, best score out of ten and last run time
- each concept name and standing
- the highest round where that concept was answered correctly
- how many runs asked about it and when it was last seen

the key is local to one device. there are no accounts, sync or backups. another
device starts empty. clearing site data erases it with no recovery. the results
screen can forget one topic. there is no other in-app reset.

old builds used `learnova.standing.v1` and `learnova.debate.v1`. this build does
not read, write or delete them. they remain until site data is cleared, and the
app has no control for removing them.

old versions stored a weighted score in the current record. values above ten
are ignored because the denominator needed to convert them was never stored.
concept standings remain and the score resets after the next completed run.

debates are not stored. there is no saved transcript, result, rating or round
count.

live debate adds no browser storage. the motion used to open a room is held in a
plain JavaScript variable in `app/debate/live/handoff.ts` for the navigation into
the room. it is not in `localStorage`, `sessionStorage`, a cookie or the URL. a
reload or closed tab removes it.

### student text

answers, final explanations, debate speeches and pasted material are not written
to disk by Learnova.

topic names, pasted material, final explanations and model-debate speeches go to
Learnova's server. the server forwards them to the Hack Club AI proxy at
`ai.hackclub.com`, which sends them to the configured model. the default model is
DeepSeek. Hack Club and the model provider control their own retention. the API
key stays on the server.

live debate also sends the motion, room code and both sides' speeches through
Ably. Ably controls its own retention. during the round, Learnova's server is not
in that message path. after the eighth speech, the full transcript goes through
Learnova's server, Hack Club and the model provider for the ballot. the other
person in the room also receives the text.

each browser keeps its transcript in memory and messages travel through Ably.
Learnova has no room database, Redis record or route-level room map.

`/api/live/token` receives the room code and a random per-tab ID. it signs an
Ably token scoped to that room for twenty minutes. the ID is generated in memory
and is not stored. the route logs and remembers neither value.

### analytics

Vercel Analytics is loaded from the root layout. it counts page views and sees
the route, not topics, notes, answers, speeches or ballots. it sets no cookie and
does not build a cross-site profile. Vercel controls retention.

live-room URLs contain the room code. the installed analytics package resolves
`/debate/live/QBTR` to `/debate/live/[code]` before sending the path. this was
checked against the package's `computeRoute` code with a real four-character
code. a content blocker can stop analytics, and the app does not depend on it.

### room codes

the code is the only access control for a live room:

- anyone with the code can take an empty seat
- four characters from a 26-character alphabet gives 456,976 combinations
- the code is only checked against rooms open at that moment
- a third person is rejected once both seats are occupied
- codes use `crypto.getRandomValues`, not `Math.random`

the code is not a cryptographic secret.

### server memory and logs

generated question banks stay in server memory for up to 30 minutes. the cache
holds at most 120 entries and disappears on restart. each entry is keyed by a
hash of the source and is only returned when the request supplies the same
source.

if model output cannot be parsed, up to 2,000 characters are written to the
server log. grounded model output can contain text copied from pasted material.

## checked

- both modes have been played through on the deployed app. deployment can lag
  this repository
- live debate was played through in two separate browser sessions with a real
  Ably key. the motion arrived 1.6 seconds after join. speeches arrived in 423 to
  1,039 ms. that run used a stubbed judge because the shared model key had no
  credit
- the real judge was called twice on a complete eight-speech transcript on 22
  aug 2026. both calls returned ballots with no internal `A` or `B` labels. the
  in-room host request was not part of that check. guest ballot mirroring was
  checked with a stubbed ballot
- Ably presence leave took 15.2 seconds from closing one tab to the other screen
  reacting. room behavior changed afterward, so the current endings have not
  been rerun with two real browsers
- layout was checked in headless Chrome on one Windows machine with emulated
  mobile viewports down to 360 pt. it was not checked on a physical phone
- there is no authentication or per-user rate limit. the model key is shared by
  everyone using the deployment
- prompt injection hardening is still missing. pasted notes and topics enter
  prompts directly. the TODOs are at the top of `app/api/round/route.ts`

## stack

Next.js, TypeScript, Tailwind CSS and Ably.

## credits

I rebuilt Learnova v2 from scratch. an earlier version was built with a
co-founder.

music is "8bit Dungeon Level" by Kevin MacLeod, CC BY 4.0. other third-party
credits are in `CREDITS.md`.

Apache 2.0. see `LICENSE` and `NOTICE`.
