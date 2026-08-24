export class RequestError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export function isBusy(err: unknown): boolean {
  return err instanceof RequestError && err.status === 429;
}

export async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new RequestError(data?.error ?? "Oops! Something went wrong on our end :( Give it another go.", res.status);
  }
  return data as T;
}

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
    throw new RequestError(data?.error ?? "Oops! Something went wrong on our end :( Give it another go.", res.status);
  }
  if (!res.body) throw new RequestError("Oops! That came back empty :( Give it another go.", 502);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let whole = "";
  let started = false;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    // stream: true or a multi-byte char split across two packets arrives as junk
    let chunk = decoder.decode(value, { stream: true });

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
