import { NextResponse } from "next/server";
import { feed } from "@/lib/feed";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { tickets, at, stale } = await feed();
    return NextResponse.json({ tickets, at, stale });
  } catch {
    console.error("feed:rip");
    return NextResponse.json(
      { error: "GitHub is not answering right now." },
      { status: 503 },
    );
  }
}
