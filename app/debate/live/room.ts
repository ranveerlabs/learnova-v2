import type { Ballot, Setup, Side, Speech, Turn } from "../types";
import { SPEECH_ORDER } from "../types";

export const ALPHABET = "ACDEFGHJKLMNPQRTUVWXY34679";
export const CODE_LENGTH = 4;

export const ROOM_SIZE = 2;

export const IDLE_MS = 10 * 60 * 1000;

export type Role = "host" | "guest";

export type Member = { role: Role };

// four chars somebody says out loud. not a secret, only ever collides with rooms open right now
export function makeCode(): string {
  const b = new Uint32Array(CODE_LENGTH);
  crypto.getRandomValues(b);
  return Array.from(b, (n) => ALPHABET[n % ALPHABET.length]).join("");
}

export function readCode(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const c = v.trim().toUpperCase();
  if (c.length !== CODE_LENGTH) return null;
  for (const ch of c) if (!ALPHABET.includes(ch)) return null;
  return c;
}

export const channelFor = (code: string) => `debate-live:${code}`;

export type LiveTurn = { side: Side; speech: Speech; text: string };

export const otherSide = (s: Side): Side => (s === "Pro" ? "Con" : "Pro");

// whose turn, worked out from the count. no turn state anywhere
export function toSpeak(ts: LiveTurn[]): { side: Side; speech: Speech } | null {
  if (ts.length >= SPEECH_ORDER.length * 2) return null;
  return {
    side: ts.length % 2 === 0 ? "Pro" : "Con",
    speech: SPEECH_ORDER[Math.floor(ts.length / 2)],
  };
}

export const asTranscript = (ts: LiveTurn[], mine: Side): Turn[] =>
  ts.map((t) => ({
    speaker: t.side === mine ? "user" : "opponent",
    speech: t.speech,
    text: t.text,
  }));

// one ballot, flipped for the other chair
export const mirror = (b: Ballot): Ballot => ({
  ...b,
  winner: b.winner === "user" ? "opponent" : b.winner === "opponent" ? "user" : "draw",
  scores: { user: b.scores.opponent, opponent: b.scores.user },
  key_moments: b.key_moments.map((m) => ({
    ...m,
    speaker: m.speaker === "user" ? "opponent" : "user",
  })),
  feedback: b.feedback_opponent,
  feedback_opponent: b.feedback,
});

export type LiveSetup = Omit<Setup, "tierId">;

export type Joined = { setup: LiveSetup; turns: LiveTurn[] };

export type Wire =
  | { name: "player_joined"; data: Joined }
  | { name: "speech_submitted"; data: LiveTurn }
  | { name: "turn_advanced"; data: { at: number } }
  | { name: "ballot_returned"; data: { ballot: Ballot } }
  | { name: "room_closed"; data: { reason: Closed } };

export type Closed = "left" | "idle" | "done";
