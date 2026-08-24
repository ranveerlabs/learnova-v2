"use client";

export type Channel = "music" | "sound";

const wanted: Record<Channel, boolean> = { music: true, sound: true };

export function audioWanted(): Record<Channel, boolean> {
  return { ...wanted };
}

export function setAudioWanted(channel: Channel, on: boolean): void {
  wanted[channel] = on;
}
