/* Runs once when a server instance starts.

   The one thing here is starting the starter topics generating, so that the
   most-taken path into the app does not begin with a wait. It deliberately
   does not await anything: Next holds the server back from accepting
   requests until `register` resolves, so anything awaited here is time
   nobody can use the app, which would be an odd way to make it faster. */
export function register() {
  /* Node only. The edge runtime has neither the key nor any business
     generating question banks. */
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  void import("@/lib/warm").then(({ warmStarters }) => warmStarters());
}
