import { NextResponse } from "next/server";
import { Rest } from "ably";
import { channelFor, readCode } from "@/app/debate/live/room";

export const dynamic = "force-dynamic";

const TTL = 20 * 60 * 1000; // one round, and useless after

const err = (msg: string, status: number) => NextResponse.json({ error: msg }, { status });

function readId(v: string | null): string | null {
  if (!v) return null;
  const id = v.trim();
  if (id.length < 8 || id.length > 64) return null;
  return /^[A-Za-z0-9_-]+$/.test(id) ? id : null;
}

export async function GET(req: Request) {
  const k = process.env.ABLY_API_KEY;
  if (!k || k === "PLACEHOLDER")
    return err(
      "ABLY_API_KEY is not set. Add it to .env.local and restart the dev server. Live debate needs it; the rest of the app does not.",
      500
    );

  const q = new URL(req.url).searchParams;
  const code = readCode(q.get("code"));
  const id = readId(q.get("clientId"));
  if (!code || !id) return err("A room code and a client id are required.", 400);

  try {
    // scoped to this one channel. a token for one room is useless on another
    const tok = await new Rest(k).auth.createTokenRequest({
      clientId: id,
      ttl: TTL,
      capability: { [channelFor(code)]: ["publish", "subscribe", "presence"] },
    });
    return NextResponse.json(tok, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("ably:token rip", e);
    return err("Could not open a live connection. Try again.", 502);
  }
}
