"use client";

/* Background music.

   One track, played from a file. What was here before was a synthesised pad:
   three oscillators through a low pass filter, drifting between chord centres
   on a four second timer. It was clever and it sounded like fan noise, so it
   has been removed rather than tuned. None of it survives.

   ── Credit ────────────────────────────────────────────────────────────────
   "8bit Dungeon Level" Kevin MacLeod (incompetech.com)
   Licensed under Creative Commons: By Attribution 4.0
   http://creativecommons.org/licenses/by/4.0/

   Attribution is a licence condition, not a courtesy, so it is in three
   places a person might actually look: CREDITS.md at the repository root,
   a pointer in README.md, and a control on the entry screen that a student
   can reach without knowing to go looking. This comment is a fourth, for
   whoever opens this file next and wonders where the audio came from.

   ── Why an audio element and not Web Audio ────────────────────────────────
   The track is three and a half minutes at 320kbps. Decoding that into an
   AudioBuffer to get sample accurate looping would cost something like
   thirty five megabytes of resident memory, on a page whose entire job is to
   ask short questions quickly. A media element streams it instead and loops
   it natively.

   The trade is honest and worth writing down: MP3 carries encoder padding at
   the head and tail of the file, so a native loop can leave a few
   milliseconds of silence at the seam. If that ever becomes audible enough to
   matter, the fix is the file rather than this code, either a trimmed MP3 or
   an OGG. */

/** How loud the music sits under everything else.

    It started at 0.18, which was inaudible in practice: a media element's
    volume is amplitude rather than perceived loudness, so 0.18 is roughly
    fifteen decibels down, and a quiet chiptune fifteen decibels down is not
    background, it is nothing. 0.6 is about five decibels down, which is
    present without being the loudest thing in the room.

    One constant, so adjusting it after listening is a one line change rather
    than an archaeology exercise. If it now sits on top of the answer tones,
    those have their own levels in voice.ts, at 0.05 for correct and 0.035 for
    wrong, and they are what should win. */
export const MUSIC_VOLUME = 0.6;

const TRACK = "/audio/8bit-dungeon-level.mp3";

let element: HTMLAudioElement | null = null;
let wanted = false;
let armed = false;

/** Start at the student's first interaction, whatever it happens to be.

    The music is meant to be playing as early as it possibly can, and the
    earliest a browser permits is the first real gesture on the page. That is
    usually a click on the topic field or a starter chip, sometimes the first
    keystroke of a topic, sometimes the start button; this does not care which.

    The listener is `click` rather than `pointerdown` on purpose. React's
    handlers run before a bubbled window listener, so if the very first thing a
    student does is reach for the mute control, the toggle has already set
    `wanted` to false by the time this fires and it correctly declines to
    start. Arming on `pointerdown` instead would fire first and play a tenth of
    a second of music at exactly the person who was trying to switch it off. */
function beginOnFirstGesture(): void {
  if (armed || typeof window === "undefined") return;
  armed = true;

  const go = () => {
    armed = false;
    window.removeEventListener("click", go);
    window.removeEventListener("keydown", go);
    if (wanted) setMusic(true);
  };

  window.addEventListener("click", go, { once: true });
  window.addEventListener("keydown", go, { once: true });
}

function track(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (element) return element;

  try {
    const audio = new Audio();
    /* Nothing is fetched until the student actually asks for music. It is off
       by default and most sessions will never turn it on, and eight megabytes
       downloaded on the chance that somebody might is eight megabytes of
       somebody's data. */
    audio.preload = "none";
    audio.src = TRACK;
    audio.loop = true;
    audio.volume = MUSIC_VOLUME;
    element = audio;
    return audio;
  } catch {
    return null;
  }
}

/** Turn the music on or off.

    Called on mount with the session's setting, so the music starts as early
    as the browser will allow rather than waiting for any particular button.
    On a page nobody has touched yet, the browser refuses and `play()` rejects;
    that rejection is not a failure, it is the signal to wait for the first
    gesture, which is what `beginOnFirstGesture` then does. The student
    experiences it as music that was already there.

    Safe to call repeatedly, and it never throws: audio is a garnish and must
    never be able to break a round. */
export function setMusic(on: boolean): void {
  wanted = on;

  /* Turning off something that was never turned on has nothing to do. Worth
     the two lines: the session sets this to false on mount, and without the
     guard every session that never touches the toggle would still construct
     an audio element to pause it. */
  if (!on && !element) return;

  const audio = track();
  if (!audio) return;

  try {
    if (!on) {
      audio.pause();
      return;
    }

    audio.volume = MUSIC_VOLUME;
    const started = audio.play();
    /* A rejection here means the browser has not seen a gesture yet. Nothing
       has gone wrong and there is nothing to tell the student: the toggle
       still reads as on, which is the setting they have, and the first thing
       they touch will start it. */
    if (started && typeof started.catch === "function") {
      started.catch(() => beginOnFirstGesture());
    }
  } catch {
    beginOnFirstGesture();
  }
}

/** Stop and release the element. Called when the session unmounts, so a track
    cannot outlive the page that started it. */
export function stopMusic(): void {
  wanted = false;
  if (!element) return;
  try {
    element.pause();
    element.src = "";
  } catch {
    /* Nothing to do. */
  }
  element = null;
}

/** Whether music is currently wanted. The toggle renders from the session's
    own state rather than from this; it exists for anything that needs to ask
    without owning the setting. */
export function musicWanted(): boolean {
  return wanted;
}
