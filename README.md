# learnova

learnova makes five-round quizzes from a topic or your notes, because reading
isn't the same as remembering. then you can debate a model or a friend.

## run it

```sh
npm install
npm run dev
```

put `HACKCLUB_AI_KEY` in `.env.local`. friend debates need `ABLY_API_KEY` too.

## privacy, quick version

The browser stores `learnova.record.v1` on this device: topic names, run counts,
best score, last run time, concept names and standings, highest correct round,
and concept appearances. Clearing site data deletes it for good. You can forget
one topic in the results screen. There is no full reset. Old keys
`learnova.standing.v1` and `learnova.debate.v1` may remain on your device; this
build does not touch them. Old scores above ten are ignored.

Topics, pasted notes, final explanations and model-debate speeches go through
Learnova's server to Hack Club's AI proxy and the configured model (DeepSeek by
default). Friend debates send room codes, motions and speeches through Ably; the
full transcript also goes to the model for judging. Those services set their own
retention. The other person in the room sees the text.
Room handoff data stays in memory; closing or reloading clears it.

Vercel Analytics gets page views and routes, not study or debate text. It sets no
cookie. Live room routes hide the code. Live tokens last 20 minutes. Question
banks stay in server memory for up to 30 minutes, up to 120 entries, keyed by
source hash and reused only for that source. Restart clears them. If model output
cannot be parsed, up to 2,000 characters may go in server logs, including text
from your notes.

No accounts, sync, backups, room database, or per-user rate limit. Room codes
have four letters; anyone with a code can take an empty seat.

## run the checks

```sh
node --experimental-strip-types scripts/spread.mjs
node --experimental-strip-types scripts/positions.mjs
```

`positions.mjs` needs the app running.

Next.js, TypeScript, Tailwind, Ably. Music by Kevin MacLeod. See `CREDITS.md`,
`LICENSE`, and `NOTICE`.

```
  (._.)
  <)  )╯
   /  \\
```
