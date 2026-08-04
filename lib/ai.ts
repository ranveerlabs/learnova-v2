// Server-side only. GITHUB_MODELS_TOKEN must never be imported into client code.
// TODO: add auth and per-user abuse/rate limits before exposing this beyond local use.
// TODO: prompt-injection hardening: source material is untrusted input fed straight into prompts.
const ENDPOINT = "https://models.github.ai/inference/chat/completions";
const MODEL = process.env.GITHUB_MODELS_MODEL ?? "openai/gpt-4o-mini";

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
  const token = process.env.GITHUB_MODELS_TOKEN;
  if (!token || token === "PLACEHOLDER") {
    throw new AIError(
      "GITHUB_MODELS_TOKEN is not set. Add your real token to .env.local and restart the dev server.",
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
    console.error(`GitHub Models API error ${res.status} (model ${MODEL}):`, detail);

    if (res.status === 429) {
      throw new AIError("The AI service is rate-limited right now, try again in a moment.", 429);
    }
    /* 410 is the provider telling us it is going away. Saying "try again" to
       that sends people round a loop that cannot succeed, and hides a
       configuration problem behind what looks like a transient blip. */
    if (res.status === 410 || /retirement|brownout|deprecat/i.test(detail)) {
      throw new AIError(
        "The configured AI provider (GitHub Models) is being retired and is refusing requests. This is not a problem with your notes, and retrying will not help: the app needs to be pointed at a different provider.",
        503
      );
    }
    throw new AIError(`The AI service returned an error (HTTP ${res.status}). Try again.`);
  }

  const data = await res.json();
  const content: unknown = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    console.error("GitHub Models API returned no message content:", JSON.stringify(data).slice(0, 2000));
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
