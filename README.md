# learnova

five-round study sessions and debates.

[learnova.software](https://learnova.software)

## run

```sh
npm install
npm run dev
```

put `HACKCLUB_AI_KEY` in `.env.local`. friend debate also needs
`ABLY_API_KEY`.

```sh
node --experimental-strip-types scripts/spread.mjs
node --experimental-strip-types scripts/positions.mjs
```

the second check needs the app running.

## stuff it does

- study from a topic or pasted notes
- five question rounds
- citations when notes are pasted
- debate a model or one friend
- no accounts

## privacy

the browser uses one `localStorage` key: `learnova.record.v1`.

it stores this for each topic:

- the typed topic and its normalised key
- run count, best score and last run time
- concept names and standings
- the highest round each concept was answered correctly
- how often each concept appeared and when it was last seen

it stays on that device. there are no accounts, sync or backups. clearing site
data deletes it for good. the results screen can forget one topic. there is no
full reset in the app.

old builds used `learnova.standing.v1` and `learnova.debate.v1`. this build does
not touch them. they stay until site data is cleared. old weighted scores above
ten are ignored because the old denominator was never stored.

debates are not saved. live debate keeps its handoff motion and random tab ID in
memory only. reloading or closing the tab removes them.

topics, pasted notes, final explanations and model-debate speeches go through
Learnova's server to the Hack Club AI proxy at `ai.hackclub.com`, then to the
configured model. the default is DeepSeek. those services control their own
retention. the API key stays on the server.

friend debate sends the room code, motion and speeches through Ably. after the
eighth speech, the transcript also goes through Learnova, Hack Club and the model
provider for judging. the other person in the room receives the text too. Ably
controls its own retention.

Learnova has no room database, Redis record or server room map. `/api/live/token`
gets the room code and random tab ID, returns a room-scoped Ably token lasting 20
minutes, and does not log or remember either value.

Vercel Analytics counts page views. it gets the route, not topics, notes,
answers, speeches or ballots. it sets no cookie. Vercel controls retention. live
room paths are reported as `/debate/live/[code]`, not with the real code.

room codes are four random letters. anyone with one can take an empty seat. two
seats fill the room. there are 456,976 possible codes, so a code is not a proper
secret.

generated question banks stay in server memory for up to 30 minutes. the cache
holds 120 entries, uses a hash of the source, and disappears on restart.

if model output cannot be parsed, the server log gets up to 2,000 characters of
it. that output can quote pasted notes.

## known rough bits

- no authentication or per-user rate limit
- pasted notes and topics go into prompts without prompt-injection protection
- mobile layout was checked in emulated Chrome on one Windows machine, not a
  physical phone
- live debate was tested with two browser sessions, but some room ending changes
  have not been rerun that way

## stack

Next.js, TypeScript, Tailwind CSS and Ably.

## credits

an older version was built with a co-founder.

music: "8bit Dungeon Level" by Kevin MacLeod, CC BY 4.0. more in `CREDITS.md`.

Apache 2.0. see `LICENSE` and `NOTICE`.
