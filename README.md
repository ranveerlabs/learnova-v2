# learnova

Five study rounds from a topic or your notes, followed by a debate with a model or a friend.

[Try Learnova](https://learnova.software)

## run locally

```sh
npm install
npm run dev
```

Add `HACKCLUB_AI_KEY` to `.env.local`. Friend rooms also need `ABLY_API_KEY`.

## features

- Five rounds, with fewer hints each time
- Study from a topic or paste notes
- Questions from notes include checked citations
- Debate a model or a friend, then get a ballot

## how it works

Notes are split into passages. Long notes are sampled across the text, and each question's citation is checked against the original before it appears. Topic-only questions aren't checked against a source.

## privacy

- `learnova.record.v1` stores per-topic names and keys, run counts, best scores, last-run times, concepts and standings, highest correct round, appearances and last-seen time. It stays on this device. Clearing site data erases it. There is no full reset.
- Old keys `learnova.standing.v1` and `learnova.debate.v1` are untouched and stay until site data is cleared.
- Topics, notes, explanations and model-debate text go through Learnova's server to Hack Club's proxy, then DeepSeek by default or the configured model. Friend codes, motions and speeches also go through Ably and the other player. These services set their own retention.
- Vercel Analytics gets page views and routes, not study or debate text. It sets no cookie.
- Live handoff data stays in memory. Room tokens last 20 minutes. Question banks are cached by source hash, reused only for the same source, up to 120 entries for 30 minutes; a restart clears them.
- If model output cannot be parsed, up to 2,000 characters go in server logs. It may quote pasted notes.
- No accounts, sync, backups, authentication or per-user rate limit.

## checks

```sh
node --experimental-strip-types scripts/spread.mjs
node --experimental-strip-types scripts/positions.mjs
```

The second check needs the app running.

## credits

An earlier version was built with a co-founder. Music: “8bit Dungeon Level” by Kevin MacLeod, CC BY 4.0. More in [CREDITS.md](CREDITS.md). Apache 2.0, see [LICENSE](LICENSE) and [NOTICE](NOTICE).

No Claude-written code remains; GitHub may still show old contributor history.

bruhhhhhh (._.)
