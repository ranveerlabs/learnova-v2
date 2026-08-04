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
    throw new Error(data?.error ?? "Something went wrong. Try again.");
  }
  return data as T;
}
