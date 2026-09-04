"use client";

import type { LiveSetup } from "./room";

let pending: { code: string; setup: LiveSetup } | null = null;

export function handOff(code: string, setup: LiveSetup) {
  pending = { code, setup };
}

export function takeHandoff(code: string): LiveSetup | null {
  return pending && pending.code === code ? pending.setup : null;
}
