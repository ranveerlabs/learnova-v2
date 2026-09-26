plz stop accusing my readmes of being ai. they are not and im happy to provide timelapses of me writing them or anything else you want. thanks

# learnova

Learnova turns a topic or pasted notes into five rounds with fewer hints each time. Then you can debate a model or a friend and get a ballot.

[Try it](https://learnova.software)

## run

```sh
npm install
npm run dev
```

Put `HACKCLUB_AI_KEY` in `.env.local`. Friend rooms also need `ABLY_API_KEY`.

## features

- Start from a topic or your notes
- Notes get checked citations. Topic-only questions dont have a source to check.
- Debate a model or a friend, then get a ballot

I split notes into passages and sample across long ones. Before a question appears, its citation gets checked against the original text.

## privacy

- `learnova.record.v1` lives on this device and stores per-topic names and keys, run counts, best scores, last-run times, concepts and standings, highest correct round, appearances and last-seen time. Clear site data and it's gone for good. There's no full reset in the app.
- Old keys `learnova.standing.v1` and `learnova.debate.v1` are untouched and stay until site data is cleared.
- Topics, notes, explanations and model-debate text go through Learnova's server to Hack Club's proxy, then DeepSeek by default or the configured model. Friend codes, motions and speeches go through Ably and to the other player. Those services set their own retention.
- Vercel Analytics gets page views and routes, not study or debate text. It sets no cookie.
- Live handoff data stays in memory. Room tokens last 20 minutes. Question banks use the source hash, so they are only reused for the same source. They stay in memory for 30 minutes, with a 120-entry cap, and are cleared on restart.
- If model output cannot be parsed, up to 2,000 characters go in server logs. That output can quote pasted notes.
- There are no accounts, sync, backups, authentication, or per-user rate limit.

## checks

```sh
node --experimental-strip-types scripts/spread.mjs
node --experimental-strip-types scripts/positions.mjs
```

The second command needs the app running.

## credits

An earlier version was built with a co-founder. The background track is “8bit Dungeon Level” by Kevin MacLeod, CC BY 4.0. [Other credits](CREDITS.md). Apache 2.0, see [LICENSE](LICENSE) and [NOTICE](NOTICE).

There's no Claude-written code in the current tree. GitHub still shows Claude from the old commits.

bruhhhhhh (._.)
