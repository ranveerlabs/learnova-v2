// Server-side only. HACKCLUB_AI_KEY must never be imported into client code.
// TODO: add auth and per-user abuse/rate limits before exposing this beyond local use.
// TODO: prompt-injection hardening: source material is untrusted input fed straight into prompts.
const BASE_URL = "https://ai.hackclub.com/proxy/v1";
const ENDPOINT = `${BASE_URL}/chat/completions`;
const MODEL = process.env.HACKCLUB_AI_MODEL ?? "google/gemini-3.6-flash";

/** Error whose message is safe to show the user; details stay in server logs. */
export class AIError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

async function callModel(
  system: string,
  user: string,
  opts: { json: boolean; temperature?: number }
): Promise<string> {
  const token = process.env.HACKCLUB_AI_KEY;
  if (!token || token === "PLACEHOLDER") {
    throw new AIError(
      "HACKCLUB_AI_KEY is not set. Add your real key to .env.local and restart the dev server.",
      500
    );
  }

  const res = await fetch(ENDPOINT, {
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
      temperature: opts.temperature ?? 0.3,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error(`Hack Club AI API error ${res.status} (model ${MODEL}):`, detail);

    if (res.status === 429) {
      throw new AIError("The AI service is rate-limited right now, try again in a moment.", 429);
    }
    throw new AIError(`The AI service returned an error (HTTP ${res.status}). Try again.`);
  }

  const data = await res.json();
  const content: unknown = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    console.error("Hack Club AI API returned no message content:", JSON.stringify(data).slice(0, 2000));
    throw new AIError("The AI returned an empty response. Try again.");
  }
  return content;
}

export async function chatJSON<T>(
  system: string,
  user: string,
  isValid: (data: unknown) => data is T
): Promise<T> {
  const content = await callModel(system, user, { json: true });

  let parsed: unknown;
  try {
    // Models occasionally wrap JSON in a markdown code fence despite json_object mode.
    parsed = JSON.parse(content.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    console.error("Failed to parse model output as JSON:", content.slice(0, 2000));
    throw new AIError("The AI returned an unreadable response. Try again.");
  }

  if (!isValid(parsed)) {
    console.error("Model output failed shape validation:", content.slice(0, 2000));
    throw new AIError("The AI returned an unexpected response format. Try again.");
  }
  return parsed;
}

/** Plain-text completion, for prose answers that aren't structured data. */
export async function chatText(system: string, user: string): Promise<string> {
  const content = await callModel(system, user, { json: false, temperature: 0.4 });
  return content.trim();
}

export function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}
