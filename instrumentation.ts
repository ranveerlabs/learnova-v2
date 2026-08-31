export function register() {
  // edge runtime gets this too, and it cannot import the route
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  void import("@/lib/warm").then(({ warmStarters }) => warmStarters());
}
