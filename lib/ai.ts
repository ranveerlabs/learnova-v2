const BASE_URL = "https://ai.hackclub.com/proxy/v1";
const ENDPOINT = `${BASE_URL}/chat/completions`;
const MODEL = process.env.HACKCLUB_AI_MODEL ?? "~deepseek/deepseek-v4-flash-latest";

export class AIError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

export const BUSY =
  "Everyone is studying at once! Give it a moment and try again.";

export const UNAVAILABLE =
  "Oops! We cannot reach our marker right now, this one is on us :(";

function spent(status: number): boolean {
  return status === 401 || status === 402 || status === 403;
}

async function failed(res: Response, where: string): Promise<AIError> {
  const detail = await res.text().catch(() => "");
  console.error(`Hack Club AI API ${where} error ${res.status} (model ${MODEL}):`, detail);

  if (spent(res.status)) {
    console.error(
      `HTTP ${res.status} is a credit or credential fault and will not clear on its own. ` +
        `Check the balance and the key on the account behind HACKCLUB_AI_KEY; ` +
        `no change in this repository will fix it.`
    );
    return new AIError(UNAVAILABLE, 503);
  }

  if (res.status === 429) return new AIError(BUSY, 429);
  return new AIError(`Oops! Something went wrong on our end (HTTP ${res.status}) :( Give it another go.`);
}

const REASONING = { enabled: false } as const;

async function request(
  token: string,
  system: string,
  user: string,
  opts: { json: boolean; temperature?: number; stream?: boolean }
): Promise<Response> {
  return fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      ...(opts.stream ? { stream: true } : {}),
      temperature: opts.temperature ?? 0.3,
      reasoning: REASONING,
    }),
  });
}

function key(): string {
  const token = process.env.HACKCLUB_AI_KEY;
  if (!token || token === "PLACEHOLDER") {
    throw new AIError(
      "HACKCLUB_AI_KEY is not set. Add your real key to .env.local and restart the dev server.",
      500
    );
  }
  return token;
}

async function callModel(
  system: string,
  user: string,
  opts: { json: boolean; temperature?: number }
): Promise<string> {
  const token = key();

  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await request(token, system, user, opts);

    if (!res.ok) throw await failed(res, "call");

    const data = await res.json();
    const content: unknown = data?.choices?.[0]?.message?.content;
    if (typeof content === "string" && content.trim()) return content;

    console.error(
      `Hack Club AI API returned no message content (attempt ${attempt} of 2):`,
      JSON.stringify(data).slice(0, 2000)
    );
  }

  throw new AIError("Hmm, the AI drew a blank there. Give it another go?");
}

function withoutThinking(s: string): string {
  return (
    s
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .replace(/^[\s\S]*?<\/think>/i, "")
      .trim()
  );
}

function candidates(raw: string): string[] {
  const text = withoutThinking(raw);
  const spans = [text];

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) spans.push(fenced[1]);

  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last > first) spans.push(text.slice(first, last + 1));

  return spans;
}

export function extractJSON(raw: string): { value: unknown } | null {
  for (const span of candidates(raw)) {
    const text = span.trim();
    if (!text) continue;
    try {
      return { value: JSON.parse(text) };
    } catch {
    }
  }
  return null;
}

export async function chatJSON<T>(
  system: string,
  user: string,
  isValid: (data: unknown) => data is T
): Promise<T> {
  const content = await callModel(system, user, { json: true });

  const found = extractJSON(content);
  if (!found) {
    console.error("Failed to parse model output as JSON:", content.slice(0, 2000));
    throw new AIError("Hmm, the AI said something we could not read. Give it another go?");
  }
  const parsed = found.value;

  if (!isValid(parsed)) {
    console.error("Model output failed shape validation:", content.slice(0, 2000));
    throw new AIError("Hmm, the AI answered in a shape we did not expect. Give it another go?");
  }
  return parsed;
}

export async function* chatStream(
  system: string,
  user: string,
  temperature = 0.4
): AsyncGenerator<string> {
  const res = await request(key(), system, user, { json: false, temperature, stream: true });

  if (!res.ok || !res.body) throw await failed(res, "stream");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let cut: number;
      while ((cut = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, cut).trim();
        buffer = buffer.slice(cut + 1);

        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") return;

        try {
          const parsed = JSON.parse(payload);
          const delta: unknown = parsed?.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta) yield delta;
        } catch {
        }
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
}

export function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}
