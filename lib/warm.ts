import { STARTERS } from "@/app/round/starters";

let started = false;

const REWARM_MS = 25 * 60 * 1000;

async function warmOnce(): Promise<void> {
  const { POST } = await import("@/app/api/round/route");

  for (const topic of STARTERS) {
    try {
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

export function warmStarters(): void {
  if (started) return;
  started = true;

  if (process.env.NODE_ENV !== "production") return;
  const token = process.env.HACKCLUB_AI_KEY;
  if (!token || token === "PLACEHOLDER") return;

  void warmOnce();

  const timer = setInterval(() => void warmOnce(), REWARM_MS);
  timer.unref?.();
}
