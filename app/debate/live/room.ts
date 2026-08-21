import type { Ballot, Setup, Side, Speech, Turn } from "../types";
import { SPEECH_ORDER } from "../types";

/* A live room, and the fact that there is no such object anywhere.

   ── Why there is no server-side room ──────────────────────────────────────
   The obvious build is a `Map<code, Room>` in a route handler, and on Vercel
   it is broken before it is written. Serverless functions do not share a
   heap: the host's "create" lands on one instance and the guest's "join"
   lands on another, so the guest is told the room does not exist while the
   host is sitting in it. That is not a scaling problem to be deferred until
   there is traffic. It fails at one room, on the first try, and it fails
   intermittently, which is worse than failing every time.

   So there is no room object. There is an Ably channel named after the code,
   and the two people attached to it ARE the room. Presence answers every
   question the Map was going to be asked:

     does this room exist    is anybody present on the channel
     is it full              are there already two of them
     did they disconnect     Ably says so, whether they closed the tab or
                             their train went into a tunnel
     when is it collected    an empty channel is not a thing that exists

   That last line is the one that pays. A Map needs a sweeper, and a sweeper
   needs a process that stays alive to run it, which is the same thing the
   Map needed and did not have. Nothing here needs collecting because nothing
   here was allocated.

   What it costs, said plainly: an unknown code cannot be rejected on the
   spot. There is no registry to be missing from, so a code nobody has ever
   used and a code whose host has just left look identical from outside —
   both are a channel with nobody on it. The screen says nobody is in that
   room, which is true of both, rather than "no such room", which would be a
   claim this design cannot make. */

/** Four characters, from an alphabet with the look-alikes taken out.

    No `I` and no `1`, no `O` and no `0`, no `S` beside `5`, no `B` beside
    `8`, no `Z` beside `2`. The code's whole job is to survive being read
    across a room and typed by somebody who is not looking at your screen,
    and every pair a tired person can confuse is a room they cannot get into.

    ── Why four and not six ─────────────────────────────────────────────────
    The code used to be six, chosen when it travelled inside a link and
    nobody was going to type it. It is the whole joining mechanism now: there
    is no link, so every guest types these characters, and two fewer of them
    is the difference between reading out a serial number and saying a word.

    What that costs is the space: 26 characters over four places is 456,976
    codes rather than three hundred million. That is still enormous next to
    the number of rooms open at any moment, which is what the space actually
    has to cover — a code is only ever compared against rooms that exist
    right now, and an unused one collides with nothing. A host who does draw
    a code somebody is already sitting in is told so and given another. */
export const ALPHABET = "ACDEFGHJKLMNPQRTUVWXY34679";
export const CODE_LENGTH = 4;

/** Two, and it is the point rather than a limit. This is 1v1. */
export const ROOM_SIZE = 2;

/** How long a room may sit untouched before it lets go.

    Ten minutes with nothing said. It is not a countdown on the debate: every
    message and every arrival resets it, so two people thinking hard about
    their Summary are not thrown out mid-round. It exists for the tab
    somebody left open on a train, which would otherwise hold a room open
    against a code somebody else might want. */
export const IDLE_MS = 10 * 60 * 1000;

export type Role = "host" | "guest";

/** What a member publishes about themselves into presence.

    The role is the whole of it, and the role is what makes the room legible:
    the host is the one who chose the motion, so a channel with nobody in the
    host chair is not a room yet, whatever else happens to be attached. */
export type Member = { role: Role };

export function makeCode(): string {
  const bytes = new Uint32Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => ALPHABET[n % ALPHABET.length]).join("");
}

/** A code from a URL, or nothing.

    Upper-cased before it is checked, so a link that has been through a chat
    app that lower-cases things still opens the room somebody was sent to.
    Anything that is not exactly the right shape is refused rather than
    repaired: a near-miss code is somebody's typo, and quietly correcting it
    would walk them into a stranger's room. */
export function readCode(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const code = v.trim().toUpperCase();
  if (code.length !== CODE_LENGTH) return null;
  for (const ch of code) if (!ALPHABET.includes(ch)) return null;
  return code;
}

/** The channel a code names.

    Namespaced, because an Ably app is a flat space of channel names and a
    six-character code on its own is a name somebody else's feature could
    plausibly pick. */
export function channelFor(code: string): string {
  return `debate-live:${code}`;
}

/* ── The round, as both tabs hold it ──────────────────────────────────────
   Single-player Debate stores turns as `speaker: "user" | "opponent"`, which
   is a fine way to say it when there is one person and one machine and only
   one of them has a screen. Here there are two screens, and the same turn is
   "user" on one and "opponent" on the other. A transcript stored that way
   means something different depending on who is holding it, which is exactly
   the sort of thing that ends up printing one player's speech under the
   other player's name.

   So the wire and the state hold the side, which reads the same on both
   screens and is also what the round is actually about. Each tab converts to
   the viewer-relative shape at the last moment, on the way into components
   that already expect it. */
export type LiveTurn = { side: Side; speech: Speech; text: string };

/** The other one. There are two sides and each screen needs the one it is
    not: the host chose theirs, so the guest's is whatever is left. */
export function otherSide(side: Side): Side {
  return side === "Pro" ? "Con" : "Pro";
}

/** Whose turn it is and which speech, or nothing because the round is over.

    Pro opens. In single-player the student always opens, because there is no
    fairness question when the other side is a model; here there is one, and
    the affirmative opening is the convention every real format shares. Four
    each way, alternating, so the side is the parity and the speech is the
    pair. */
export function toSpeak(turns: LiveTurn[]): { side: Side; speech: Speech } | null {
  if (turns.length >= SPEECH_ORDER.length * 2) return null;
  return {
    side: turns.length % 2 === 0 ? "Pro" : "Con",
    speech: SPEECH_ORDER[Math.floor(turns.length / 2)],
  };
}

/** The round as one particular person sees it.

    The conversion the comment above is about, and the only place it happens.
    Everything downstream — the transcript cards, the judge's `render`, the
    word count that decides whether there is a round worth marking — is the
    existing single-player code, and it wants "user" to mean the person
    reading. */
export function asTranscript(turns: LiveTurn[], mine: Side): Turn[] {
  return turns.map((t) => ({
    speaker: t.side === mine ? "user" : "opponent",
    speech: t.speech,
    text: t.text,
  }));
}

/** The same ballot, read from the other chair.

    Only the host calls the judge — see `judge` in the room screen for why —
    so the ballot that comes back is written about a transcript in which `A`
    is the host. Handed to the guest untouched, it would tell them they won a
    round they lost, in the largest type on the screen, with a scoresheet
    agreeing.

    Three fields carry the sides and all three turn over. `draw` is its own
    case and is left alone, which is why this is spelled out rather than
    written as a flip somebody would later simplify wrongly. */
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
  };
}

/* ── What goes over the wire ──────────────────────────────────────────────
   Five events, named for what happened rather than for what the receiver
   should do about it, because both tabs run the same code and which of them
   cares about a given event depends only on which chair they are sitting
   in. */

/** The setup, minus the one field that would be a lie here.

    `tierId` chooses how hard the model argues and how long its speech may
    run. There is no model in this room. Carrying it anyway would put a
    number in the payload describing an opponent who does not exist, and
    sooner or later somebody would read it as describing the person in the
    other chair. */
export type LiveSetup = Omit<Setup, "tierId">;

/** The host's answer to somebody arriving: here is what we are arguing, and
    here is the round so far.

    It carries the turns as well as the setup, which looks redundant on a
    fresh room and is not. A guest whose phone slept through two speeches
    reconnects to a channel that remembers nothing; the host has the round,
    and sends all of it rather than a diff, because a diff needs both sides
    to agree about what was already known and that agreement is precisely the
    thing that just broke. */
export type Joined = { setup: LiveSetup; turns: LiveTurn[] };

export type Wire =
  | { name: "player_joined"; data: Joined }
  | { name: "speech_submitted"; data: LiveTurn }
  | { name: "turn_advanced"; data: { at: number } }
  | { name: "ballot_returned"; data: { ballot: Ballot } }
  | { name: "room_closed"; data: { reason: Closed } };

export type EventName = Wire["name"];

/** Why a room ended, in the terms the person still sitting there needs.

    Four, and the distinctions are the whole point: this is the vocabulary
    the end-of-room screen speaks, and every collapse of two of these into
    one costs somebody an answer they wanted.

      left   they pressed the button. A decision, and it arrives as a
             `room_closed` message because they were still connected when
             they made it.
      gone   presence said they were no longer there and nothing else did.
             A closed tab, a dead connection, a phone that went to sleep.
             There is no message, because there was nobody left to send one.
      idle   nobody said anything for ten minutes. Not a departure at all.
      done   the round finished and somebody closed the room after it.

    `left` and `gone` are the two that look identical from the outside and
    are not. One of them is a person choosing to stop, which is information
    about them; the other is a network, which is information about nothing.
    Being told the wrong one is worse than being told neither, because a
    student whose partner's train went into a tunnel should not spend the
    evening thinking they were walked out on. */
export type Closed = "left" | "gone" | "idle" | "done";
