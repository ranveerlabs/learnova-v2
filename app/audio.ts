"use client";

/* Which of the two audio channels the person wants on.

   The mechanisms live elsewhere and are unchanged: music.ts owns the track,
   tone.ts owns the event tones. This owns only the answer to "do they want
   it", and it exists because that answer now has to survive something it did
   not have to survive before.

   ── Why it cannot be component state ──────────────────────────────────────
   There are two modes and a landing page between them, and moving between
   them is a client-side navigation: same document, same JavaScript, brand new
   React tree. Held in each mode's own useState, the setting reset to "on"
   every time somebody crossed between them. Mute the music in Round Mode,
   go back, open a debate, and the track starts again, off a control the
   person had already used. Module state is exactly the right lifetime for
   this: it is per document, so it lasts as long as the visit and no longer.

   Deliberately not localStorage. A muting is usually about the room somebody
   is in right now rather than a standing preference, and a student who muted
   once in a library should not find the app silent a week later with no
   memory of having asked for that. Reloading the page is a big enough gesture
   to mean "start again". */

export type Channel = "music" | "sound";

/* Both on. Music is atmosphere and the tones are feedback, and the app is
   better with both; the controls are on every screen of both modes for
   anybody who disagrees. */
const wanted: Record<Channel, boolean> = { music: true, sound: true };

/** What the person currently wants, for a mode about to mount its controls.

    Safe during the server pass: it returns the defaults there, which are the
    same values the client's first render sees, so the two agree. */
export function audioWanted(): Record<Channel, boolean> {
  return { ...wanted };
}

export function setAudioWanted(channel: Channel, on: boolean): void {
  wanted[channel] = on;
}
