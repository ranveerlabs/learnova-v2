"use client";

import type { LiveSetup } from "./room";

// lives for the one navigation into the room and dies with the tab
let pending: { code: string; setup: LiveSetup } | null = null;

export function handOff(code: string, setup: LiveSetup) {
  pending = { code, setup };
}

export function takeHandoff(code: string): LiveSetup | null {
  return pending && pending.code === code ? pending.setup : null;
}
