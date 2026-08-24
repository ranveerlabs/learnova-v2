import type { Ballot, Setup, Side, Speech, Turn } from "../types";
import { SPEECH_ORDER } from "../types";

export const ALPHABET = "ACDEFGHJKLMNPQRTUVWXY34679";
export const CODE_LENGTH = 4;

export const ROOM_SIZE = 2;

export const IDLE_MS = 10 * 60 * 1000;

export type Role = "host" | "guest";

export type Member = { role: Role };

// four characters somebody has to say out loud. not a secret, and it only ever
// collides with rooms that are open right now.
export function makeCode(): string {
  const bytes = new Uint32Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => ALPHABET[n % ALPHABET.length]).join("");
}

export function readCode(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const code = v.trim().toUpperCase();
  if (code.length !== CODE_LENGTH) return null;
  for (const ch of code) if (!ALPHABET.includes(ch)) return null;
  return code;
}

export function channelFor(code: string): string {
  return `debate-live:${code}`;
}

export type LiveTurn = { side: Side; speech: Speech; text: string };

export function otherSide(side: Side): Side {
  return side === "Pro" ? "Con" : "Pro";
}

export function toSpeak(turns: LiveTurn[]): { side: Side; speech: Speech } | null {
  if (turns.length >= SPEECH_ORDER.length * 2) return null;
  return {
    side: turns.length % 2 === 0 ? "Pro" : "Con",
    speech: SPEECH_ORDER[Math.floor(turns.length / 2)],
  };
}

export function asTranscript(turns: LiveTurn[], mine: Side): Turn[] {
  return turns.map((t) => ({
    speaker: t.side === mine ? "user" : "opponent",
    speech: t.speech,
    text: t.text,
  }));
}

export function mirror(ballot: Ballot): Ballot {
  return {
    ...ballot,
    winner:
      ballot.winner === "user" ? "opponent" : ballot.winner === "opponent" ? "user" : "draw",
    scores: { user: ballot.scores.opponent, opponent: ballot.scores.user },
    key_moments: ballot.key_moments.map((m) => ({
      ...m,
      speaker: m.speaker === "user" ? "opponent" : "user",
    })),
    feedback: ballot.feedback_opponent,
    feedback_opponent: ballot.feedback,
  };
}

export type LiveSetup = Omit<Setup, "tierId">;

export type Joined = { setup: LiveSetup; turns: LiveTurn[] };

export type Wire =
  | { name: "player_joined"; data: Joined }
  | { name: "speech_submitted"; data: LiveTurn }
  | { name: "turn_advanced"; data: { at: number } }
  | { name: "ballot_returned"; data: { ballot: Ballot } }
  | { name: "room_closed"; data: { reason: Closed } };

export type Closed = "left" | "idle" | "done";
