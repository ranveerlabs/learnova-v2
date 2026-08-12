"use client";

import { START } from "@/lib/elo";
import type { Tab } from "./types";

/* Where a debater's rating lives between rounds.

   Its own key, and its own file, kept apart from the study record on purpose.
   The two describe different things about different activities, and the one
   rule this store has to hold above every other is the one below.

   ── The pools never mix ──────────────────────────────────────────────────
   Competitive and casual ratings are stored separately and are never added,
   averaged, or shown as one number. A casual rating is earned against a judge
   told to keep the bar realistic for a general audience and to be gentle with
   beginners; a competitive one is earned against a judge told that 60 means
   mediocre by tournament standards. Blending them would produce a number that
   is not a measurement of anything, and it would do the most damage to the
   person who cares most: somebody using the competitive tab to prepare for a
   real tournament needs that figure to mean one thing only.

   Same storage caveats as the study record: one browser, no account, wrapped
   at every turn, and silently absent rather than fatal if storage is denied. */

const KEY = "learnova.debate.v1";

export type Pool = {
  rating: number;
  rounds: number;
  won: number;
  lost: number;
  drawn: number;
  /** Rating after each of the last few rounds, oldest first. Enough to draw a
      direction of travel and not enough to be a chart. */
  recent: number[];
};

type Book = {
  version: 1;
  competitive: Pool;
  casual: Pool;
};

function fresh(): Pool {
  return { rating: START, rounds: 0, won: 0, lost: 0, drawn: 0, recent: [] };
}

const EMPTY: Book = { version: 1, competitive: fresh(), casual: fresh() };

function read(): Book {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Book;
    if (parsed?.version !== 1) return EMPTY;
    return {
      version: 1,
      competitive: { ...fresh(), ...parsed.competitive },
      casual: { ...fresh(), ...parsed.casual },
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

export function poolFor(tab: Tab): Pool {
  return read()[tab];
}

export function bothPools(): { competitive: Pool; casual: Pool } {
  const book = read();
  return { competitive: book.competitive, casual: book.casual };
}

/** Record a finished round in one pool and one pool only. */
export function recordRound(
  tab: Tab,
  { rating, result }: { rating: number; result: "user" | "opponent" | "draw" }
): Pool {
  const book = read();
  const pool = book[tab];

  const next: Pool = {
    rating,
    rounds: pool.rounds + 1,
    won: pool.won + (result === "user" ? 1 : 0),
    lost: pool.lost + (result === "opponent" ? 1 : 0),
    drawn: pool.drawn + (result === "draw" ? 1 : 0),
    recent: [...pool.recent, rating].slice(-8),
  };

  write({ ...book, [tab]: next });
  return next;
}

export function forgetRatings(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* Nothing to do. */
  }
}
