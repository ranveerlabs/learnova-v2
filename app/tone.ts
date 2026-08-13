"use client";

/* The app's event tones.

   Synthesised rather than loaded, so there is no download and no audio asset
   in the repository for these. They began in app/round/voice.ts beside the
   speech recogniser and moved here when debate mode wanted the same three
   lines of oscillator code to drop a gavel with.

   Kept short on purpose. Round Mode is fast enough that anything longer than
   about a tenth of a second would still be playing when the next question
   arrives, and the one exception is the tone that ends a thing rather than
   punctuating it.

   ── Why the levels are what they are ──────────────────────────────────────
   These are functional, not decorative. A student has to know they got it
   wrong without looking up, which means the tone has to survive the music
   playing underneath it rather than merely exist alongside it.

   The levels below were set against a measurement rather than by ear.
   Decoding the background track gives a peak of 0.5 dBFS and, over its
   loudest three second window, an RMS of -11.8 dBFS; played at MUSIC_VOLUME
   of 0.6 that is -16.2 dBFS. A sine at amplitude A has an RMS of A over root
   two, so:

     amplitude 0.05   -12.8 dB relative to the music   the old value
     amplitude 0.12    -5.2 dB
     amplitude 0.17    -2.2 dB
     amplitude 0.24    +0.8 dB

   Those figures compare total RMS, which understates how well a tone carries:
   the music spreads its energy across the spectrum while a sine puts all of
   its own into one critical band, so a tone reads as louder than the
   arithmetic suggests. They are still the right numbers to reason from.

   The one departure is "wrong". It used to be the quietest tone in the set,
   deliberately, so that a miss was not a buzzer. That was the correct call
   when it only had to be gentle and the wrong one now that it has to be
   heard: it is levelled with "right" rather than sitting three decibels
   under it. Equal, not louder. A miss still is not a buzzer, it is simply no
   longer the hardest thing to hear. */

import { audioWanted } from "./audio";

type Tone = "right" | "wrong" | "combo" | "done" | "gavel" | "speech";

let audio: AudioContext | null = null;

/* Module private. It was briefly exported so a synthesised background pad
   could share this context; that pad is gone, and the track that replaced it
   is a media element with its own volume, so nothing outside this file has any
   business with the audio context. */
function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    audio ??= new AudioContext();
    return audio;
  } catch {
    return null;
  }
}

const TONES: Record<Tone, { freq: number[]; ms: number; gain: number; type: OscillatorType }> = {
  /* A rising two-note figure. Up means right in every musical culture this
     interface is likely to meet. */
  right: { freq: [660, 990], ms: 90, gain: 0.17, type: "sine" },
  /* Down and low, which is what says "not that" without needing volume to do
     it. Level with "right" rather than under it: the shape carries the
     meaning, so the loudness does not have to, and this is the one tone a
     student has to catch without looking at the screen. */
  wrong: { freq: [300, 220], ms: 130, gain: 0.17, type: "sine" },
  /* Higher each time a combo climbs, which the caller varies by tier. */
  combo: { freq: [880, 1320], ms: 110, gain: 0.17, type: "triangle" },
  done: { freq: [523, 784, 1047], ms: 150, gain: 0.19, type: "sine" },

  /* ── Debate ─────────────────────────────────────────────────────────────
     The gavel. A debate has exactly one moment worth a sound, and it is the
     one where the ballot lands: the student has spent four speeches and a
     minute of waiting to find out, and having that arrive in silence is what
     made the whole mode feel like a form submission. Two low knocks, square
     rather than sine so they read as wood rather than as a chime, and slower
     than anything in Round Mode because this one is allowed to be an event. */
  gavel: { freq: [196, 147], ms: 260, gain: 0.16, type: "square" },
  /* Your opponent has finished speaking. Deliberately the quietest thing in
     the set and a single note: it is a nudge to look up, not a verdict, and
     it fires up to four times a round. */
  speech: { freq: [440], ms: 70, gain: 0.07, type: "triangle" },
};

/** Play one of the app's sounds. Silent and harmless when the browser has no
    audio, when the context is suspended, or when anything at all goes wrong:
    sound is a garnish and must never be able to break a round.

    The preference is checked here rather than by every caller. It used to be
    threaded as a `sound` boolean from the session into the page, into the
    round components, and guarded at each `play(...)`, which is four places
    that all had to remember and one of them eventually would not. There is
    one question, "does this person want tones", and this is where it gets
    asked. */
export function play(tone: Tone, heat = 0): void {
  if (!audioWanted().sound) return;

  const ctx = context();
  if (!ctx) return;

  try {
    if (ctx.state === "suspended") void ctx.resume();

    const spec = TONES[tone];
    const now = ctx.currentTime;
    const step = spec.ms / 1000 / spec.freq.length;

    spec.freq.forEach((base, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = spec.type;
      /* A run that is going well climbs in pitch as well as in numbers. */
      osc.frequency.value = base * (1 + heat * 0.18);

      const at = now + i * step;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(spec.gain, at + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + step);

      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + step + 0.02);
    });
  } catch {
    /* Nothing to do and nothing to say. */
  }
}
