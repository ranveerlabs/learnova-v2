export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  void import("@/lib/warm").then(({ warmStarters }) => warmStarters());
}
