import { STARTERS } from "@/app/round/starters";

let on = false;

const EVERY = 25 * 60 * 1000;

async function warm(): Promise<void> {
  const { POST } = await import("@/app/api/round/route");

  for (const t of STARTERS) {
    try {
      const res = await POST(
        new Request("http://warm.local/api/round", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage: "open", topic: t, notes: "", asked: [] }),
        })
      );
      console.log(`warm:${t} ${res.status}`);
    } catch (e) {
      console.warn(`warm:dead ${t}`, e);
    }
  }
}

export function warmStarters(): void {
  if (on) return;
  on = true;

  if (process.env.NODE_ENV !== "production") return;
  const k = process.env.HACKCLUB_AI_KEY;
  if (!k || k === "PLACEHOLDER") return;

  void warm();
  const t = setInterval(() => void warm(), EVERY);
  t.unref?.();
}
