# learnova
topic/notes → five study rounds; debate model/friend
run: `npm install && npm run dev`; `.env.local`: `HACKCLUB_AI_KEY`; friend rooms: `ABLY_API_KEY`
`learnova.record.v1`: topic/key, runs, best score, last-run time, concepts/standings, highest correct round, appearances/last seen. per-device; clear site data = gone; no full reset. old keys `learnova.standing.v1`/`learnova.debate.v1` untouched
topics, notes, explanations, debate text: Learnova server → Hack Club (`ai.hackclub.com`) → DeepSeek/default or configured model. friend codes/motions/speeches: Ably + other player. retention theirs
Vercel Analytics: page views/routes only, no study/debate text. no accounts/sync/backups
live handoff: memory only. question cache: source hash, same-source only, max 120 banks/30m, cleared on restart
bad model output: up to 2,000 chars logged, may quote notes. no per-user rate limit
checks: `node --experimental-strip-types scripts/spread.mjs`; same command for `scripts/positions.mjs` (app running)
(._.)
