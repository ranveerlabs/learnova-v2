"use client";

/* What you have played, and how it went.

   ── What this replaced ───────────────────────────────────────────────────
   There was an elo here. One number for the whole app, moved by `applyRound`
   after a debate and `applyRun` after a study session, sitting on a
   seven-rung ladder from Fresh to Legend with a rail showing the distance to
   the next rung. It was carefully built and it is gone, along with
   lib/elo.ts and the badge that drew it.

   The reason is that it answered a question nobody was asking with a number
   nobody could check. An elo is a relative measure and it only means anything
   against a field: the whole point of the arithmetic is that beating somebody
   strong is worth more than beating somebody weak. There is no field here.
   There is one person, on one device, playing three declared difficulty tiers
   of the same model, with nothing synced and nobody to be relative to. So the
   figure had the shape of a competitive rating and the content of a private
   guess, which is the exact failure this app spends the rest of its code
   avoiding — and it took a rung table, a projection formula, a study-run cap
   and a paragraph of explanation on two screens to produce.

   What replaces it is the thing the ballot already knew: you won or you did
   not. A record needs no scale, no calibration and no explanation, it cannot
   drift away from what happened, and a person can check it against their own
   memory of the rounds they played. It is a smaller claim and it is true.

   ── Runs are counted, and not as wins ────────────────────────────────────
   A study run has no opponent and therefore no winner, and inventing a
   threshold to call one "won" would put back the thing that was just taken
   out. Round Mode already has its own three words for how a run went, in
   `reveal.tsx` — a strong run, some of it landed, worth another run — and
   the strong band is the one worth keeping a count of. So runs are tallied
   in Round Mode's vocabulary rather than in the debate's.

   Same storage caveats as everything else in this app: one browser, no
   account, wrapped at every turn, and silently absent rather than fatal if
   storage is denied. */

const KEY = "learnova.standing.v1";

/** Where the two debate pools used to live. Read once, merged, and left
    alone: nothing writes this key any more, and leaving it in place means a
    student who opens an old build has not lost anything. */
const DEBATE_KEY = "learnova.debate.v1";

export type Book = {
  /** 2 is the record. 1 was the elo book, and is read for its counts. */
  version: 2;
  /** Debates judged, and how they went. */
  debates: number;
  won: number;
  lost: number;
  drawn: number;
  /** Round Mode runs finished, and how many of those were strong runs. */
  runs: number;
  strong: number;
};

const EMPTY: Book = {
  version: 2,
  debates: 0,
  won: 0,
  lost: 0,
  drawn: 0,
  runs: 0,
  strong: 0,
};

/** A number that was written by an older build, treated as a count.

    Everything in this file is a tally, so anything that is not a
    non-negative whole number is not a tally and is dropped rather than
    coerced. A corrupt book should read as an empty one, never as a record
    somebody did not earn. */
function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

/* ── The two older shapes, both read for their counts ─────────────────────
   Version 1 of this key held a rating, a rung history and the same W/L/D
   counts. Version 1 and 2 of the debate key held two separate pools with a
   rating each. Both are read the same way now, because the only thing either
   of them has that survives is how many rounds were played and how they
   went: the ratings in them are measured on a scale that no longer exists,
   and there is nothing honest to convert them into.

   Neither is deleted. A student who opens an older build still finds their
   old book where it was. */

type OldPool = { rounds?: unknown; won?: unknown; lost?: unknown; drawn?: unknown };

function migrateDebate(): Book | null {
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

    const pools = [book.competitive, book.casual].filter(
      (p): p is OldPool => typeof p === "object" && p !== null
    );
    if (pools.length === 0) return null;

    const total = (pick: (p: OldPool) => unknown) =>
      pools.reduce((sum, p) => sum + count(pick(p)), 0);

    return {
      ...EMPTY,
      debates: total((p) => p.rounds),
      won: total((p) => p.won),
      lost: total((p) => p.lost),
      drawn: total((p) => p.drawn),
    };
  } catch {
    return null;
  }
}

function read(): Book {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {
      /* Nothing here yet. Somebody arriving with debate rounds behind them
         keeps them; somebody arriving fresh starts empty. The merged book is
         written back so this only ever runs once. */
      const moved = migrateDebate();
      if (moved) write(moved);
      return moved ?? EMPTY;
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed?.version !== 1 && parsed?.version !== 2) return EMPTY;

    /* Read field by field rather than spread, so the elo book's `rating` and
       `recent` are dropped on the way through instead of riding along inside
       a record that has no place for them. */
    return {
      version: 2,
      debates: count(parsed.debates),
      won: count(parsed.won),
      lost: count(parsed.lost),
      drawn: count(parsed.drawn),
      runs: count(parsed.runs),
      strong: count(parsed.strong),
    };
  } catch {
    return EMPTY;
  }
}

function write(book: Book): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(book));
  } catch {
    /* The round still happened and the ballot was still read. */
  }
}

export function standing(): Book {
  return read();
}

/** Record a judged debate. The result is the judge's, unchanged: nothing here
    weighs it, scales it or turns it into anything else. */
export function recordDebate(result: "user" | "opponent" | "draw"): Book {
  const book = read();
  const next: Book = {
    ...book,
    debates: book.debates + 1,
    won: book.won + (result === "user" ? 1 : 0),
    lost: book.lost + (result === "opponent" ? 1 : 0),
    drawn: book.drawn + (result === "draw" ? 1 : 0),
  };
  write(next);
  return next;
}

/** Record a finished Round Mode run, and whether it was a strong one.

    `strong` is the top of the three bands `buildReveal` already computes and
    the results screen already names. Nothing new is judged here. */
export function recordRun(strong: boolean): Book {
  const book = read();
  const next: Book = {
    ...book,
    runs: book.runs + 1,
    strong: book.strong + (strong ? 1 : 0),
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
