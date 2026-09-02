"use client";

export const MUSIC_VOLUME = 0.6;

const TRACK = "/audio/8bit-dungeon-level.mp3";

let el: HTMLAudioElement | null = null;
let want = false;
let armed = false;

// autoplay is blocked until a click, so wait for one
function waitForGesture() {
  if (armed || typeof window === "undefined") return;
  armed = true;

  const go = () => {
    armed = false;
    window.removeEventListener("click", go);
    window.removeEventListener("keydown", go);
    if (want) setMusic(true);
  };

  window.addEventListener("click", go, { once: true });
  window.addEventListener("keydown", go, { once: true });
}

function audio() {
  if (typeof window === "undefined") return null;
  if (el) return el;

  try {
    const a = new Audio();
    a.preload = "none"; // don't pull 1.5mb on a page nobody turned the music on for
    a.src = TRACK;
    a.loop = true;
    a.volume = MUSIC_VOLUME;
    el = a;
    return a;
  } catch {
    return null;
  }
}

export function setMusic(on: boolean) {
  want = on;
  if (!on && !el) return;

  const a = audio();
  if (!a) return;

  try {
    if (!on) return a.pause();

    a.volume = MUSIC_VOLUME;
    const p = a.play();
    if (p && typeof p.catch === "function") p.catch(() => waitForGesture());
  } catch {
    waitForGesture();
  }
}
