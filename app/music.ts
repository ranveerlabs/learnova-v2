"use client";

export const MUSIC_VOLUME = 0.6;

const TRACK = "/audio/8bit-dungeon-level.mp3";

let element: HTMLAudioElement | null = null;
let wanted = false;
let armed = false;

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

export function setMusic(on: boolean): void {
  wanted = on;

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
    if (started && typeof started.catch === "function") {
      started.catch(() => beginOnFirstGesture());
    }
  } catch {
    beginOnFirstGesture();
  }
}
