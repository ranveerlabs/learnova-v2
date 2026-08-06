"use client";

import { context } from "./voice";

/* Background music, synthesised rather than loaded.

   No audio files in the repository, for the same reason the answer tones have
   none: a loop long enough not to grate is a large binary in a small
   repository, and a loop short enough to ship is one a student will notice
   repeating within a round.

   What this plays is deliberately close to nothing. A slow pad on a five note
   scale, one note moving at a time, at a level that sits under the answer
   tones rather than beside them. Study music that draws attention to itself is
   working against the only thing the session is for, and a tune with a hook in
   it would be rehearsing itself in the student's head instead of the material.

   ── On by default ──────────────────────────────────────────────────────────
   It is on when the session opens, and so are the answer tones. Both have a
   visible control.

   It cannot start before the student's first click, and that is a browser
   rule rather than a setting: audio contexts begin suspended and stay
   suspended until a real user gesture resumes them. So `set(true)` before any
   interaction arms the music rather than starting it, and the first click the
   page sees, which in practice is the start button on the entry screen, is
   what actually begins it. Nothing here tries to work around that, and nothing
   plays on a page the student has not touched. */

const SCALE = [0, 2, 4, 7, 9];
const ROOT = 174.61; // F3, low enough to stay under speech

/** Semitones to a frequency. */
function step(semitones: number): number {
  return ROOT * Math.pow(2, semitones / 12);
}

/** The chord centres the pad drifts between. Slow, and only ever a step or
    two apart, so nothing ever arrives as an event. */
const CENTRES = [0, 5, -3, 2];

type Voice = {
  osc: OscillatorNode;
  gain: GainNode;
};

let master: GainNode | null = null;
let filter: BiquadFilterNode | null = null;
let voices: Voice[] = [];
let timer: ReturnType<typeof setInterval> | null = null;
let armed = false;
let wanted = false;
let step_ = 0;

const LEVEL = 0.05;

function build(ctx: AudioContext) {
  if (master) return;

  master = ctx.createGain();
  master.gain.value = 0;

  /* A low pass well down the spectrum. What is left is a pad rather than an
     instrument, which is the point: nothing with an attack in it. */
  filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 720;
  filter.Q.value = 0.4;

  filter.connect(master);
  master.connect(ctx.destination);

  voices = [0, 1, 2].map((i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = i === 2 ? "triangle" : "sine";
    osc.frequency.value = step(SCALE[i] + (i === 2 ? 12 : 0));
    gain.gain.value = i === 2 ? 0.22 : 0.4;
    osc.connect(gain).connect(filter!);
    osc.start();
    return { osc, gain };
  });
}

/** Move one voice to a new note. One at a time, over four seconds, so the
    harmony changes without anything sounding like it was played. */
function drift(ctx: AudioContext) {
  if (voices.length === 0) return;

  step_ += 1;
  const centre = CENTRES[Math.floor(step_ / 3) % CENTRES.length];
  const voice = voices[step_ % voices.length];
  const degree = SCALE[(step_ * 2) % SCALE.length];
  const octave = voice === voices[2] ? 12 : 0;

  voice.osc.frequency.setTargetAtTime(step(centre + degree + octave), ctx.currentTime, 1.6);

  /* The filter breathes on the same clock, which is what stops a held chord
     reading as a dial tone. */
  filter?.frequency.setTargetAtTime(620 + ((step_ * 137) % 260), ctx.currentTime, 2.4);
}

function run(ctx: AudioContext) {
  build(ctx);
  if (!master) return;

  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setTargetAtTime(LEVEL, ctx.currentTime, 1.2);

  timer ??= setInterval(() => {
    const live = context();
    if (live) drift(live);
  }, 4000);
}

/** Fade out and stop scheduling. The oscillators are left running at zero
    gain: restarting them is not free, and a student toggling the music twice
    should not hear a click for their trouble. */
function hush(ctx: AudioContext) {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  master?.gain.cancelScheduledValues(ctx.currentTime);
  master?.gain.setTargetAtTime(0, ctx.currentTime, 0.6);
}

/** Wait for the first real gesture, then start.

    Registered once. `once: true` on each listener, and `armed` guards against
    a second registration if the student toggles the music off and on again
    before touching anything else. */
function armForGesture() {
  if (armed || typeof window === "undefined") return;
  armed = true;

  const begin = () => {
    armed = false;
    if (!wanted) return;
    const ctx = context();
    if (!ctx) return;
    void ctx.resume();
    run(ctx);
  };

  window.addEventListener("pointerdown", begin, { once: true });
  window.addEventListener("keydown", begin, { once: true });
}

/** Turn the music on or off.

    Safe to call on every render: it does nothing when the state already
    matches, and it never throws. Audio is a garnish and must never be able to
    break a round. */
export function setMusic(on: boolean): void {
  wanted = on;

  try {
    const ctx = context();
    if (!ctx) return;

    if (!on) {
      hush(ctx);
      return;
    }

    /* Suspended means no gesture has reached the page yet. Ask for one rather
       than trying to talk over the browser. */
    if (ctx.state === "suspended") {
      void ctx.resume();
      if (ctx.state === "suspended") {
        armForGesture();
        return;
      }
    }

    run(ctx);
  } catch {
    /* Nothing to do and nothing to say. */
  }
}

/** Whether the music is actually sounding, as opposed to wanted. The interface
    does not currently show this: the toggle reports the student's choice, and
    a control that flipped itself back to off because the browser had not seen
    a click yet would be reporting the browser's state as though it were
    theirs. */
export function musicPlaying(): boolean {
  return wanted && timer !== null;
}
