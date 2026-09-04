export class RequestError extends Error {
  constructor(msg: string, public status: number) {
    super(msg);
  }
}

export const isBusy = (e: unknown) => e instanceof RequestError && e.status === 429;

const OOPS = "Oops! Something went wrong on our end :( Give it another go.";

const send = (url: string, body: unknown) =>
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await send(url, body);
  const d = await res.json().catch(() => null);
  if (!res.ok) throw new RequestError(d?.error ?? OOPS, res.status);
  return d as T;
}

export async function postStream(
  url: string,
  body: unknown,
  onText: (chunk: string) => void
): Promise<string> {
  const res = await send(url, body);

  if (!res.ok) {
    const d = await res.json().catch(() => null);
    throw new RequestError(d?.error ?? OOPS, res.status);
  }
  if (!res.body) throw new RequestError("Oops! That came back empty :( Give it another go.", 502);

  const rd = res.body.getReader();
  const dec = new TextDecoder();
  let all = "";
  let going = false;

  for (;;) {
    const { done, value } = await rd.read();
    if (done) break;

    let c = dec.decode(value, { stream: true });

    if (!going) {
      c = c.replace(/^\s+/, "");
      if (!c) continue;
      going = true;
    }

    all += c;
    onText(c);
  }

  return all;
}
