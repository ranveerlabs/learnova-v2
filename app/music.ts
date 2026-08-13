"use client";

/* Background music.

   One track, shared by both modes, which is why this sits at the app root
   rather than inside app/round where it started. A debate gets the same music
   a run does: the track is the app's atmosphere, not Round Mode's.

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
    than an archaeology exercise. If it now sits on top of the event tones,
    those have their own levels in tone.ts, set against a measurement of this
    track at this volume, and they are what should win. */
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

/* There was a `stopMusic` here, called when a mode unmounted, on the reasoning
   that a track must not outlive the page that started it. Both halves of that
   turned out to be wrong once there were two modes and a landing page between
   them.

   A mode unmounting is not the page going away. It is a client-side
   navigation inside the same document, so tearing the track down on it meant
   the music stopped dead every time somebody moved between the landing and a
   mode, and started again from the first bar a moment later. The track now
   simply keeps playing across a navigation, which is what anybody would
   expect of background music in an app. When the document really does go
   away, the element goes with it, which was the only part the old function
   was actually needed for.

   It also carried a real bug worth recording. It released the element with
   `element.src = ""`, and an empty src does not mean "no source": it resolves
   against the document, so the element went off and tried to decode the
   current HTML page as audio. Every unmount left a failed media load and a
   console error behind it. If anything ever does need to stop the track, use
   `removeAttribute("src")` followed by `load()`. */
