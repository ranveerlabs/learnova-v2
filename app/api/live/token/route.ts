import { NextResponse } from "next/server";
import { Rest } from "ably";
import { channelFor, readCode } from "@/app/debate/live/room";

/* The only server-side thing a live room has.

   ── What this route is, and what it deliberately is not ───────────────────
   It signs a short-lived Ably token and hands it back. That is the whole
   job. It does not know which rooms exist, who is in them, or what is being
   argued, because there is nothing here that could remember any of that
   between two requests — see the long note at the top of
   `app/debate/live/room.ts` for why a server-side room register was the
   first thing cut rather than the last.

   It exists for one reason: `ABLY_API_KEY` is a credential that can read and
   write every channel in the app, and a browser that holds it can do the
   same. The key stays here, exactly as `HACKCLUB_AI_KEY` does, and what
   reaches the page is a token that can do one thing in one room. */

/* Signing a token reads the key and the clock. Neither is a thing to cache,
   and a cached token request is a token request handed to two people. */
export const dynamic = "force-dynamic";

/** Twenty minutes.

    Long enough that a whole debate never has to renew, which matters because
    a renewal mid-round is a reconnect and a reconnect is a moment where a
    speech could be missed. Short enough that a token copied out of a
    network tab is worthless by the time anybody could use it, given the room
    it names will not exist either. */
const TTL_MS = 20 * 60 * 1000;

/** A client id from the page, or nothing.

    Ably needs one to put somebody in the presence set, and presence is what
    this whole feature uses instead of a database. It is generated per tab
    rather than per person: it is not an identity, nothing is stored against
    it, and it stops existing when the tab does. Length-capped and character-
    checked because it is a string from a request that ends up in a signed
    token. */
function readClientId(v: string | null): string | null {
  if (!v) return null;
  const id = v.trim();
  if (id.length < 8 || id.length > 64) return null;
  return /^[A-Za-z0-9_-]+$/.test(id) ? id : null;
}

export async function GET(req: Request) {
  const key = process.env.ABLY_API_KEY;
  if (!key || key === "PLACEHOLDER") {
    /* Said the way `lib/ai.ts` says the same thing about its own key: the
       person who sees this is running the app, not using it, and what they
       need is the name of the variable and where to put it. */
    return NextResponse.json(
      {
        error:
          "ABLY_API_KEY is not set. Add it to .env.local and restart the dev server. Live debate needs it; the rest of the app does not.",
      },
      { status: 500 }
    );
  }

  const url = new URL(req.url);
  const code = readCode(url.searchParams.get("code"));
  const clientId = readClientId(url.searchParams.get("clientId"));

  if (!code || !clientId) {
    return NextResponse.json({ error: "A room code and a client id are required." }, { status: 400 });
  }

  try {
    /* Scoped to the one channel, and to the three things a debater does in
       it: say something, hear it, and be visibly in the room.

       Anybody who has the code can get one of these, which is not a hole so
       much as the design: there are no accounts here, so the code IS the
       secret and a six-character code is a weak one. What the scoping buys
       is that a token for room ACDEFG cannot be turned on room HJKLMN, so a
       guessed code costs one room rather than the app. The README says this
       out loud rather than leaving somebody to infer it. */
    const token = await new Rest(key).auth.createTokenRequest({
      clientId,
      ttl: TTL_MS,
      capability: { [channelFor(code)]: ["publish", "subscribe", "presence"] },
    });

    return NextResponse.json(token, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    console.error("Ably token request failed:", err);
    return NextResponse.json(
      { error: "Could not open a live connection. Try again." },
      { status: 502 }
    );
  }
}
