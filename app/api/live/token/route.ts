import { NextResponse } from "next/server";
import { Rest } from "ably";
import { channelFor, readCode } from "@/app/debate/live/room";

export const dynamic = "force-dynamic";

const TTL_MS = 20 * 60 * 1000; // long enough for a round, short enough to not matter if it leaks

function readClientId(v: string | null): string | null {
  if (!v) return null;
  const id = v.trim();
  if (id.length < 8 || id.length > 64) return null;
  return /^[A-Za-z0-9_-]+$/.test(id) ? id : null;
}

export async function GET(req: Request) {
  const key = process.env.ABLY_API_KEY;
  if (!key || key === "PLACEHOLDER") {
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
