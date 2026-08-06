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

    Music is on by default now, which puts the whole weight of "nothing plays
    on page load" on WHERE this is called from rather than on what it does.
    The rule, kept in session.ts: this is never called while the page is
    merely loading. It is called from the start button and from the toggle,
    both of which are clicks, and a click is the user gesture browsers require
    before audio may begin. There is deliberately no mount effect that calls
    it, because that is exactly the autoplay this must not do.

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
    /* play() rejects when a browser decides it has not seen a good enough
       gesture. There is nothing useful to say to the student about that and
       nothing to retry, so it is swallowed: the toggle still reads as on,
       which is what they asked for, and the next toggle will try again. */
    if (started && typeof started.catch === "function") {
      started.catch(() => {});
    }
  } catch {
    /* Nothing to do and nothing to say. */
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
