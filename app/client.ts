/** A failed request, carrying the status alongside the route's own message.

    The status is kept because one of them means something different to the
    student than all the others: 429 is the shared key being busy, which is a
    wait rather than a fault, and the session responds to it by stepping around
    the missing piece instead of stopping. Everything else is a fault and is
    treated as one. */
export class RequestError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** Whether a thrown error was the rate limit rather than a real failure. */
export function isBusy(err: unknown): boolean {
  return err instanceof RequestError && err.status === 429;
}

/** POST JSON to one of the app's routes, surfacing the route's own error text
    so the interface can say what actually went wrong. */
export async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new RequestError(data?.error ?? "Something went wrong. Try again.", res.status);
  }
  return data as T;
}

/** POST JSON and read a plain-text body as it arrives.

    For the one route that answers with prose the reader watches rather than
    waits for. `onText` is called with each piece as it lands and the whole
    thing is returned at the end, so a caller can show the speech being given
    and still keep the finished text without reassembling it themselves.

    A failure before the first byte is still an ordinary RequestError carrying
    the route's own message and status, which is what keeps the busy key
    reading as a queue rather than as a fault. After the first byte the status
    is already 200 and cannot be taken back: a stream that dies part way
    through returns what it had, and the caller decides whether that is enough
    of a speech to keep. */
export async function postStream(
  url: string,
  body: unknown,
  onText: (chunk: string) => void
): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new RequestError(data?.error ?? "Something went wrong. Try again.", res.status);
  }
  if (!res.body) throw new RequestError("The reply arrived empty. Try again.", 502);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let whole = "";
  let started = false;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    /* `stream: true` so a multi-byte character split across two network
       packets is held until the rest of it turns up, rather than arriving on
       screen as a replacement glyph. */
    let chunk = decoder.decode(value, { stream: true });

    /* Whitespace before the first real character is thrown away rather than
       shown. The route opens every stream with a kilobyte of spaces, because
       WebKit will not release a streamed response to the page until it has
       1024 bytes of it and a speech is smaller than that; the padding is what
       makes the words arrive as they are written on Safari and on iOS. It is
       the client's job to make sure that padding is never seen. */
    if (!started) {
      chunk = chunk.replace(/^\s+/, "");
      if (!chunk) continue;
      started = true;
    }

    whole += chunk;
    onText(chunk);
  }

  return whole;
}
