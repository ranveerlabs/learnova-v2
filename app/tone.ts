"use client";

import { audioWanted } from "./audio";

type Tone = "right" | "wrong" | "combo" | "done" | "gavel" | "speech";

let ac: AudioContext | null = null;

function ctxOf(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    ac ??= new AudioContext();
    return ac;
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

  const ctx = ctxOf();
  if (!ctx) return;

  try {
    if (ctx.state === "suspended") void ctx.resume();

    const s = TONES[tone];
    const now = ctx.currentTime;
    const step = s.ms / 1000 / s.freq.length;

    s.freq.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = s.type;
      osc.frequency.value = f * (1 + heat * 0.18);

      const at = now + i * step;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(s.gain, at + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, at + step);

      osc.connect(g).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + step + 0.02);
    });
  } catch {}
}
