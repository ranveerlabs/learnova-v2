"use client";

import { audioWanted } from "./audio";

type Tone = "right" | "wrong" | "combo" | "done" | "gavel" | "speech";

let audio: AudioContext | null = null;

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
  right: { freq: [660, 990], ms: 90, gain: 0.17, type: "sine" },
  wrong: { freq: [300, 220], ms: 130, gain: 0.17, type: "sine" },
  combo: { freq: [880, 1320], ms: 110, gain: 0.17, type: "triangle" },
  done: { freq: [523, 784, 1047], ms: 150, gain: 0.19, type: "sine" },

  gavel: { freq: [196, 147], ms: 260, gain: 0.16, type: "square" },
  speech: { freq: [440], ms: 70, gain: 0.07, type: "triangle" },
};

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
  }
}
