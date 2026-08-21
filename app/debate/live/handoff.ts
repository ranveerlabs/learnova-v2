"use client";

import type { LiveSetup } from "./room";

/* Getting the motion from the create screen to the room, without writing it
   down.

   ── Why this is a module variable and not storage ─────────────────────────
   The host types a motion on `/debate/live` and arrives in
   `/debate/live/ACDEFG`, which is a different route and therefore a
   different component tree. The usual ways to carry something across that
   gap are all wrong here, and each is wrong in its own way:

     sessionStorage   is storage. It survives a reload, which means a
                      student's motion is sitting in the profile of a shared
                      school computer after they have gone, and it puts a new
                      key in the README's Privacy section for the sake of one
                      navigation.
     a query string   puts the motion in the URL, and the URL is the one
                      string about this room that is designed to be copied
                      into a chat. The share link would carry the topic.
     a server round   there is no server-side room. That is the whole design;
                      see the note at the top of `room.ts`.

   So it is a variable. App Router navigations inside a tab are client-side,
   so the module is the same module on both screens and the value is simply
   still there. It never reaches disk, never reaches the URL, and never
   reaches another tab.

   ── What it costs, which is real and not a caveat ─────────────────────────
   A hard reload of the room URL wipes it, because a hard reload is a new
   JavaScript context. The host then has no motion, and the room screen reads
   that correctly: no motion means not the host. A moment later Ably agrees,
   because the connection that WAS the room went down with the reload. What
   they see is that nobody is in that room, which is exactly what is true,
   and a button to open a new one.

   That is the honest failure and it is not disguised. The alternative was
   persisting the motion so a reload could rejoin, and rejoining is not
   something this feature can do: the other tab has already been told the
   room closed. */

/** Keyed on the code it was made for, and never cleared by reading.

    Two reasons it is not a read-once box. React may call a `useState`
    initializer twice, and a box that empties on the first call would hand
    the second one `null` and turn the host into a guest of their own room.
    And a host who opens a second room needs the first room's motion to be
    unreachable rather than merely consumed — keying on the code does that by
    construction, because the old code is never asked for again. */
let pending: { code: string; setup: LiveSetup } | null = null;

/** Leave the motion for the room screen to pick up. */
export function handOff(code: string, setup: LiveSetup) {
  pending = { code, setup };
}

/** Take it, if this tab is the one that left it there for this room. */
export function takeHandoff(code: string): LiveSetup | null {
  return pending && pending.code === code ? pending.setup : null;
}
