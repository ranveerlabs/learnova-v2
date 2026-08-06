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
