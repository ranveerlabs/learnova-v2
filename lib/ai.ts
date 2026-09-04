const URL_BASE = "https://ai.hackclub.com/proxy/v1";
const EP = `${URL_BASE}/chat/completions`;
const MODEL = process.env.HACKCLUB_AI_MODEL ?? "~deepseek/deepseek-v4-flash-latest";

export class AIError extends Error {
  constructor(msg: string, public status = 502) {
    super(msg);
  }
}

export const BUSY = "Everyone is studying at once! Give it a moment and try again.";
export const UNAVAILABLE = "Oops! We cannot reach our marker right now, this one is on us :(";

const dead = (s: number) => s === 401 || s === 402 || s === 403;

async function bad(res: Response, where: string): Promise<AIError> {
  const body = await res.text().catch(() => "");
  console.error(`ai:${where} ${res.status} [${MODEL}]`, body);

  if (dead(res.status)) {
    console.error("ai:key dead. check balance/key behind HACKCLUB_AI_KEY, no code fix for this");
    return new AIError(UNAVAILABLE, 503);
  }
  if (res.status === 429) return new AIError(BUSY, 429);
  return new AIError(`Oops! Something went wrong on our end (HTTP ${res.status}) :( Give it another go.`);
}

type Opts = { json: boolean; temperature?: number; stream?: boolean };

function hit(tok: string, sys: string, usr: string, o: Opts) {
  return fetch(EP, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: usr },
      ],
      ...(o.json ? { response_format: { type: "json_object" } } : {}),
      ...(o.stream ? { stream: true } : {}),
      temperature: o.temperature ?? 0.3,
      reasoning: { enabled: false },
    }),
  });
}

function key(): string {
  const t = process.env.HACKCLUB_AI_KEY;
  if (!t || t === "PLACEHOLDER")
    throw new AIError("HACKCLUB_AI_KEY is not set. Add your real key to .env.local and restart the dev server.", 500);
  return t;
}

async function ask(sys: string, usr: string, o: Opts): Promise<string> {
  const tok = key();

  for (let n = 1; n <= 2; n++) {
    const res = await hit(tok, sys, usr, o);
    if (!res.ok) throw await bad(res, "call");

    const d = await res.json();
    const c: unknown = d?.choices?.[0]?.message?.content;
    if (typeof c === "string" && c.trim()) return c;

    console.error(`ai:empty ${n}/2`, JSON.stringify(d).slice(0, 2000));
  }

  throw new AIError("Hmm, the AI drew a blank there. Give it another go?");
}

const unthink = (s: string) =>
  s
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^[\s\S]*?<\/think>/i, "")
    .trim();

function tries(raw: string): string[] {
  const t = unthink(raw);
  const out = [t];

  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) out.push(fence[1]);

  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a !== -1 && b > a) out.push(t.slice(a, b + 1));

  return out;
}

export function extractJSON(raw: string): { value: unknown } | null {
  for (const s of tries(raw)) {
    const t = s.trim();
    if (!t) continue;
    try {
      return { value: JSON.parse(t) };
    } catch {}
  }
  return null;
}

export async function chatJSON<T>(
  sys: string,
  usr: string,
  ok: (d: unknown) => d is T
): Promise<T> {
  const c = await ask(sys, usr, { json: true });

  const got = extractJSON(c);
  if (!got) {
    console.error("ai:unparseable", c.slice(0, 2000));
    throw new AIError("Hmm, the AI said something we could not read. Give it another go?");
  }
  if (!ok(got.value)) {
    console.error("ai:badshape", c.slice(0, 2000));
    throw new AIError("Hmm, the AI answered in a shape we did not expect. Give it another go?");
  }
  return got.value;
}

export async function* chatStream(sys: string, usr: string, temp = 0.4): AsyncGenerator<string> {
  const res = await hit(key(), sys, usr, { json: false, temperature: temp, stream: true });
  if (!res.ok || !res.body) throw await bad(res, "stream");

  const rd = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";

  try {
    for (;;) {
      const { done, value } = await rd.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });

      let i: number;
      while ((i = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);

        if (!line.startsWith("data:")) continue;
        const p = line.slice(5).trim();
        if (p === "[DONE]") return;

        try {
          const d = JSON.parse(p)?.choices?.[0]?.delta?.content;
          if (typeof d === "string" && d) yield d;
        } catch {}
      }
    }
  } finally {
    await rd.cancel().catch(() => {});
  }
}

export const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");
