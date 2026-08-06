// Server-side only. HACKCLUB_AI_KEY must never be imported into client code.
// TODO: add auth and per-user abuse/rate limits before exposing this beyond local use.
// TODO: prompt-injection hardening: source material is untrusted input fed straight into prompts.
const BASE_URL = "https://ai.hackclub.com/proxy/v1";
const ENDPOINT = `${BASE_URL}/chat/completions`;
/* The tilde is the proxy's own marker for a moving alias, not a typo: it
   resolves to deepseek/deepseek-v4-flash-0731 today and to whatever succeeds
   it later. Without it the id is rejected outright as invalid. */
const MODEL = process.env.HACKCLUB_AI_MODEL ?? "~deepseek/deepseek-v4-flash-latest";

/** Error whose message is safe to show the user; details stay in server logs. */
export class AIError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

/* One key serves everyone on the deployment, at 450 requests per thirty
   minutes between them. So being rate limited is not an error in the sense
   that something is broken: it is a busy afternoon, and the student who runs
   into it did nothing wrong and needs no diagnosis. It is said in those terms
   wherever it surfaces, and it is said in one place so it cannot drift into
   four slightly different apologies. */
export const BUSY =
  "Learnova is busy right now. Give it a moment and try again.";

/* Reasoning off, deliberately.

   The model reasons by default, at "high" effort, and it is the single
   biggest thing standing between a student and their first question.
   Measured on the real Round 1 prompt: 7992 completion tokens with it on
   against 1837 with it off, and on the cold open 349 to 3398 tokens depending
   on nothing more than which topic was named. That variance is the problem as
   much as the size is. The cold open is the one call a student actually waits
   on, and the whole mode is built on them answering something within about
   ten seconds of naming a topic.

   What is being given up is small. These prompts do not ask the model to work
   anything out: they hand it a topic, a format, a shape and about twenty
   hard rules, and ask it to write. The thinking a study question needs was
   done in the prompt.

   Not the same as asking for less reasoning. Measured, "low" effort produced
   MORE reasoning than the default and took longer, which is its own reason
   not to trust the dial. Off is off. */
const REASONING = { enabled: false } as const;

async function request(
  token: string,
  system: string,
  user: string,
  opts: { json: boolean; temperature?: number }
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
      temperature: opts.temperature ?? 0.3,
      reasoning: REASONING,
    }),
  });
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

  /* Two attempts, and only ever for one reason: a reply that arrived fine and
     had nothing in it. That happens occasionally and is not a state anything
     downstream can do anything with, so it is worth one more ask before it
     becomes an error on a student's screen.

     Deliberately not a retry for anything else. An HTTP error is not retried
     here, and a rate limit least of all: asking again immediately is the one
     response to a busy shared key that makes it busier. */
  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await request(token, system, user, opts);

    if (!res.ok) {
      const detail = await res.text();
      console.error(`Hack Club AI API error ${res.status} (model ${MODEL}):`, detail);

      if (res.status === 429) {
        throw new AIError(BUSY, 429);
      }
      throw new AIError(`The AI service returned an error (HTTP ${res.status}). Try again.`);
    }

    const data = await res.json();
    const content: unknown = data?.choices?.[0]?.message?.content;
    if (typeof content === "string" && content.trim()) return content;

    console.error(
      `Hack Club AI API returned no message content (attempt ${attempt} of 2):`,
      JSON.stringify(data).slice(0, 2000)
    );
  }

  throw new AIError("The AI returned an empty response. Try again.");
}

/* ── Getting the JSON back out of a reply ─────────────────────────────────

   `response_format: json_object` is asked for on every structured call above,
   and it is a request rather than a guarantee: whether it is honoured is a
   property of whichever model is behind the proxy, and that is one line of
   this file away from being a different model with different manners. So a
   reply is treated as text that probably contains JSON, not as JSON.

   Three shapes turn up when it is not honoured, in rising order of nuisance:
   a fenced block, a fenced block with a sentence of preamble in front of it,
   and a reasoning trace before either. Each attempt below is a strictly wider
   net than the one before it, and every one of them ends at JSON.parse, so a
   reply that is not JSON at all still fails. Nothing here coerces, repairs or
   guesses at malformed JSON: it only decides which span of the reply to hand
   to the parser. Shape validation downstream is unaffected and still the
   thing that decides whether a parsed payload is usable. */

/** Reasoning traces, which some models emit ahead of the answer whatever the
    response format says.

    Stripped before anything else looks at the text, because a trace is prose
    about the answer and will happily contain braces and fences of its own.
    Left in, it would be the span the wider nets below picked up. */
function withoutThinking(s: string): string {
  return (
    s
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      /* A closing tag with nothing opening it means the opening tag was never
         emitted or was trimmed upstream. Everything ahead of it is still the
         model thinking rather than answering. */
      .replace(/^[\s\S]*?<\/think>/i, "")
      .trim()
  );
}

/** The spans of a reply that might be the JSON, widest net last. */
function candidates(raw: string): string[] {
  const text = withoutThinking(raw);
  const spans = [text];

  /* A fenced block anywhere in the reply, rather than only one occupying the
     whole of it. This is what a leading "Here is the JSON:" costs. */
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) spans.push(fenced[1]);

  /* Last resort: the widest span that could be a JSON object. Every payload
     this app asks for is an object, so anything outside the outermost braces
     is commentary by definition. */
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last > first) spans.push(text.slice(first, last + 1));

  return spans;
}

/** The first of those spans that parses, or null if none of them does.

    Wrapped in an object rather than returned bare, because `null` is itself
    valid JSON and a bare return could not tell the two apart. */
export function extractJSON(raw: string): { value: unknown } | null {
  for (const span of candidates(raw)) {
    const text = span.trim();
    if (!text) continue;
    try {
      return { value: JSON.parse(text) };
    } catch {
      /* Not this span. Try a wider one. */
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
    throw new AIError("The AI returned an unreadable response. Try again.");
  }
  const parsed = found.value;

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
