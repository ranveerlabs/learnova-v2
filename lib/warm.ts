import { STARTERS } from "@/app/round/starters";

/* Generating the starter topics before anybody asks for them.

   The cold open is the only call a student ever waits on, and most of that
   wait is not ours: a trivial five token request to the proxy measured
   anywhere between 1.7 and 11 seconds on the same afternoon, so there is no
   amount of prompt trimming that makes the first question arrive reliably
   fast. What can be done is not be waiting when the moment comes.

   The four starter chips are the most-taken path into the app and the only
   topics knowable in advance, so their banks are generated once per process,
   into the same cache a second student on the same topic already hits. A
   student who lands on the entry screen, reads it, and taps "Photosynthesis"
   gets a bank that was written while they were reading.

   Deliberately narrow. It does not warm rounds 1 to 3, which are already
   fetched a round ahead of the student and land inside time they were
   spending anyway. It does not warm anything a student typed, because there
   is no such thing as knowing that in advance. Four requests per process is
   the whole cost.

   Production only. The key is shared and has a daily spending cap on it, and
   a dev server restarts often enough that warming on every boot would spend
   that cap on nobody. */

let started = false;

/** Slightly under the cache's own half hour, so a starter is replaced while
    it is still live rather than after a window in which it had expired and
    the next student paid full price for it. */
const REWARM_MS = 25 * 60 * 1000;

async function warmOnce(): Promise<void> {
  /* Imported here rather than at the top of the file so that a module which
     reaches into a route handler is only loaded when it is going to be used. */
  const { POST } = await import("@/app/api/round/route");

  for (const topic of STARTERS) {
    try {
      /* The route handler is a function that takes a Request, so it can be
         called directly. Going through it rather than around it means the
         warmed bank is generated, validated, sifted and cached by exactly the
         code that serves a real request, and cannot drift from it.

         One at a time on purpose. Four at once is a burst against a shared key
         at the moment the process starts, which is the least helpful time to
         spend a rate limit. */
      const res = await POST(
        new Request("http://warm.local/api/round", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage: "open", topic, notes: "", asked: [] }),
        })
      );
      console.log(`Warmed "${topic}": HTTP ${res.status}`);
    } catch (err) {
      console.warn(`Could not warm "${topic}":`, err);
    }
  }
}

/** Fire the starter generations once per process, and keep them alive.
    Returns immediately: this is never on the path of a request, and a failure
    is not worth telling anybody about, since the only consequence is that a
    chip costs what it used to cost. */
export function warmStarters(): void {
  if (started) return;
  started = true;

  if (process.env.NODE_ENV !== "production") return;
  const token = process.env.HACKCLUB_AI_KEY;
  if (!token || token === "PLACEHOLDER") return;

  void warmOnce();

  /* Only does anything in a long-lived server. On a platform that spins a
     process up per request there is nothing to keep warm and the interval
     never fires, which is the correct outcome rather than a broken one.
     Unref'd so it is never the reason the process refuses to exit. */
  const timer = setInterval(() => void warmOnce(), REWARM_MS);
  timer.unref?.();
}
