"use client";

import { START } from "@/lib/elo";

/* One rating, for the whole app.

   ── What changed and why ─────────────────────────────────────────────────
   Debate used to keep two ratings, one for open debate and one for
   tournament prep, and Round Mode kept none: its "rating" was a per-run
   score out of what that session was worth, which is a different kind of
   number that happened to share a word. Three things called a rating, none
   of them comparable to either of the others, and nothing on any screen that
   answered "how am I doing" across the app somebody was actually using.

   Now there is one number. Both modes move it, by their own arithmetic:
   `applyRound` rates a debate against the tier's declared strength,
   `applyRun` rates a study run against the material it was served. The
   formulas differ because the activities differ. The ladder they climb is
   the same one, which is the whole point.

   ── What that costs ──────────────────────────────────────────────────────
   The old file argued hard that competitive and casual ratings must never
   mix, and that argument was right about the thing it was about: the two
   judges are told different bars, so a point earned under one is not a point
   earned under the other. Merging them loses that, and it is a real loss for
   somebody using tournament prep to get ready for a real tournament.

   It is a deliberate trade rather than an oversight. A rating nobody can
   compare to anything is a rating nobody looks at twice, and the app had
   three of those. The record kept here is per source, so the tooltip can
   still say how much of a standing was earned where, and a debater who wants
   the strict number can read their debate record off it.

   Same storage caveats as everything else in this app: one browser, no
   account, wrapped at every turn, and silently absent rather than fatal if
   storage is denied. */

const KEY = "learnova.standing.v1";

/** Where the two debate pools used to live. Read once, merged, and left
    alone: nothing writes this key any more, and leaving it in place means a
    student who opens an old build has not lost anything. */
const DEBATE_KEY = "learnova.debate.v1";

/** The 1200-based scale the debate rating started on, before it was rebased
    on zero. Only used to move a book written under it. */
const OLD_START = 1200;

export type Ladder = {
  version: 1;
  rating: number;
  /** Debates judged, and how they went. */
  debates: number;
  won: number;
  lost: number;
  drawn: number;
  /** Round Mode runs finished. */
  runs: number;
  /** Rating after each of the last few results, oldest first. Enough to draw
      a direction of travel and not enough to be a chart. */
  recent: number[];
};

const EMPTY: Ladder = {
  version: 1,
  rating: START,
  debates: 0,
  won: 0,
  lost: 0,
  drawn: 0,
  runs: 0,
  recent: [],
};

/* ── Reading the old debate book ─────────────────────────────────────────
   Two pools have to become one number and there is no merge that loses
   nothing, so this picks the least dishonest one: the rating from whichever
   pool the student actually played, and the win record from both.

   Averaging the two would invent a standing nobody ever held, and taking the
   higher would hand a debater the best of two bars they were judged on
   separately. Rounds played is the tiebreak because it is the pool with the
   most evidence behind it, and it is also, for almost everybody, the only
   pool with anything in it at all. */

type OldPool = { rating?: number; rounds?: number; won?: number; lost?: number; drawn?: number };

function migrateDebate(): Ladder | null {
  if (typeof window === "undefined") return null;

  let raw: string | null;
  try {
    raw = window.localStorage.getItem(DEBATE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const book = JSON.parse(raw) as {
      version?: unknown;
      competitive?: OldPool;
      casual?: OldPool;
    };
    if (book?.version !== 1 && book?.version !== 2) return null;

    /* Version 1 was the 1200-based scale. Subtracting the old start preserves
       the standing exactly, because a rating only ever meant its distance
       from where everybody began. */
    const shift = book.version === 1 ? OLD_START : 0;
    const pools = [book.competitive, book.casual].filter(
      (p): p is OldPool => typeof p === "object" && p !== null
    );
    if (pools.length === 0) return null;

    const played = [...pools].sort((a, b) => (b.rounds ?? 0) - (a.rounds ?? 0))[0];
    const count = (pick: (p: OldPool) => number | undefined) =>
      pools.reduce((sum, p) => sum + (pick(p) ?? 0), 0);

    const rating = Math.max(0, Math.round((played.rating ?? START) - shift));

    return {
      ...EMPTY,
      rating,
      debates: count((p) => p.rounds),
      won: count((p) => p.won),
      lost: count((p) => p.lost),
      drawn: count((p) => p.drawn),
      recent: [rating],
    };
  } catch {
    return null;
  }
}

function read(): Ladder {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {
      /* Nothing here yet. Somebody arriving with debate rounds behind them
         keeps them; somebody arriving fresh starts at zero. The merged book
         is written back so this only ever runs once. */
      const moved = migrateDebate();
      if (moved) write(moved);
      return moved ?? EMPTY;
    }
    const parsed = JSON.parse(raw) as Ladder;
    if (parsed?.version !== 1) return EMPTY;
    return { ...EMPTY, ...parsed, recent: Array.isArray(parsed.recent) ? parsed.recent : [] };
  } catch {
    return EMPTY;
  }
}

function write(ladder: Ladder): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ladder));
  } catch {
    /* The round still happened and the ballot was still read. */
  }
}

export function standing(): Ladder {
  return read();
}

/** Record a judged debate. The rating itself is computed by `applyRound`, in
    lib/elo.ts, from a value we already held. Nothing here decides it. */
export function recordDebate(rating: number, result: "user" | "opponent" | "draw"): Ladder {
  const book = read();
  const next: Ladder = {
    ...book,
    rating,
    debates: book.debates + 1,
    won: book.won + (result === "user" ? 1 : 0),
    lost: book.lost + (result === "opponent" ? 1 : 0),
    drawn: book.drawn + (result === "draw" ? 1 : 0),
    recent: [...book.recent, rating].slice(-8),
  };
  write(next);
  return next;
}

/** Record a finished Round Mode run. Same note: `applyRun` decides the
    number, this only remembers it. */
export function recordRun(rating: number): Ladder {
  const book = read();
  const next: Ladder = {
    ...book,
    rating,
    runs: book.runs + 1,
    recent: [...book.recent, rating].slice(-8),
  };
  write(next);
  return next;
}

export function forgetStanding(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
    window.localStorage.removeItem(DEBATE_KEY);
  } catch {
    /* Nothing to do. */
  }
}
