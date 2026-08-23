"use client";

import { conceptStanding, isOpen, type Reveal, type Standing } from "./engine";

/* What a run leaves behind.

   ── Why this exists ──────────────────────────────────────────────────────
   Everything else in this mode was built on the assumption that a session is
   the whole story: it starts on the entry screen, it ends on the results, and
   closing the tab ends it. That was honest about the plumbing and wrong about
   the pedagogy. Retrieval practice does its work through SPACING. Meeting a
   concept once, failing to explain it, and never meeting it again is the half
   of the idea that feels like studying and is not the half that makes it
   stick. A run that leaves nothing behind can only ever demonstrate the idea.

   And the session already knows the thing worth keeping. `rankForProduction`
   works out how far up the ladder each concept survived and how fast the
   correct answers came; `buildReveal` lands every one of them on a standing.
   That pair is a map of which ideas a student can recognise but cannot say,
   which is a genuinely unusual thing to know about somebody, and until now it
   was computed, shown once, and thrown away on the walk to the results screen.

   ── What this is not ─────────────────────────────────────────────────────
   It is not an account and it does not pretend to be one. This is
   `localStorage`: one browser, one device, cleared by clearing site data, and
   gone if they open the app on their phone instead of their laptop. Every
   sentence the interface says about it has to be true at that level, so the
   results screen says "on this device" and offers to forget it, rather than
   implying anything is synced or backed up anywhere.

   Nothing here leaves the browser. No explanations, no answers, no text the
   student wrote: what is kept is concept names, a standing each, and a few
   counts. The explanation you typed in Round 4 is read by the grader and then
   dropped, exactly as before. */

const KEY = "learnova.record.v1";

export type ConceptRecord = {
  concept: string;
  standing: Standing;
  /** Highest round it was ever answered correctly in, across every run. */
  reached: number;
  /** Runs that have asked about it. */
  seen: number;
  /** Epoch ms of the last run that asked about it. */
  lastSeen: number;
};

export type TopicRecord = {
  /** As the student typed it, for showing back to them. */
  topic: string;
  /** Normalised, and what everything is keyed on. */
  key: string;
  runs: number;
  /** Best score out of ten on this topic. Topic scoped on purpose: see
      `bestFor`, and `score` in engine.ts for why it is a proportion rather
      than the weighted total this used to hold. */
  bestRating: number;
  lastRun: number;
  concepts: ConceptRecord[];
};

type Library = { version: 1; topics: TopicRecord[] };

const EMPTY: Library = { version: 1, topics: [] };

/** How many topics to keep. Generous enough that nobody hits it by studying,
    small enough that the store cannot grow without bound in a browser the
    student never clears. Oldest run drops out first. */
const MAX_TOPICS = 40;

export function topicKey(topic: string): string {
  return topic.trim().toLowerCase().replace(/\s+/g, " ");
}

/** What makes two concept names the same concept.

    This is load bearing, and it is the one place this feature can quietly
    fail. Concepts are not stored anywhere between runs: the model is asked
    for them again from the topic each time, so a second run on photosynthesis
    can come back with "The Calvin cycle" where the first said "Calvin cycle",
    and matched literally those are two different concepts. The record would
    then fill up with near duplicates, every one of them permanently open,
    and a student who had explained something perfectly well would be shown it
    as unfinished forever.

    Case, surrounding space, a leading article and trailing punctuation are
    the drift that actually shows up, so they are what this removes. It cannot
    catch a genuine rewording ("Calvin cycle" against "light-independent
    reactions") and does not try: guessing at that would merge two concepts
    that are not the same, which is the worse failure of the two. */
export function conceptKey(concept: string): string {
  return concept
    .trim()
    .toLowerCase()
    .replace(/^(the|a|an)\s+/, "")
    .replace(/[.,;:!?]+$/, "")
    .replace(/\s+/g, " ");
}

/* ── Reading and writing ─────────────────────────────────────────────────
   Every path through here is wrapped, and every failure is silent and total:
   the feature turns itself off and the app behaves exactly as it did before
   there was a record. `localStorage` throws rather than returning null in
   more cases than people expect (Safari with cookies blocked, a full quota,
   an iframe with third-party storage partitioned off), and none of those is a
   reason a student cannot answer a question about photosynthesis. */

function read(): Library {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Library;
    /* Anything not written by this version of the shape is discarded rather
       than migrated. There is one version and it has never shipped another,
       so a migration path here would be speculative code guarding a case that
       cannot yet exist; when there is a v2 it can read v1 properly. */
    if (parsed?.version !== 1 || !Array.isArray(parsed.topics)) return EMPTY;
    return parsed;
  } catch {
    return EMPTY;
  }
}

function write(library: Library): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(library));
  } catch {
    /* Out of quota, or storage denied. The run still happened and the student
       still saw their results; all that is lost is the next run knowing about
       it, and telling them so mid-session would be noise about a thing they
       cannot act on. */
  }
}

/* ── The questions the rest of the app asks ──────────────────────────────── */

/** Every topic with a record, most recently studied first. */
export function studied(): TopicRecord[] {
  return [...read().topics].sort((a, b) => b.lastRun - a.lastRun);
}

/** How every concept on a topic stood at the end of the last run, keyed the
    same loose way the merge keys them. What the results screen compares
    against to work out what actually moved. */
export function standingsFor(topic: string): Record<string, Standing> {
  const record = recordFor(topic);
  return Object.fromEntries(
    (record?.concepts ?? []).map((c) => [conceptKey(c.concept), c.standing])
  );
}

export function recordFor(topic: string): TopicRecord | null {
  const key = topicKey(topic);
  return read().topics.find((t) => t.key === key) ?? null;
}

/** The concepts on a topic that are not finished with.

    "Finished with" means explained in their own words and nothing less, so a
    concept they have only ever recognised is in this list. That is the whole
    argument of the mode written as a filter: recognition is not the thing. */
export function openConcepts(record: TopicRecord | null): string[] {
  if (!record) return [];
  return record.concepts.filter((c) => isOpen(c.standing)).map((c) => c.concept);
}

/** The best score to beat on a topic.

    Topic scoped, which is a correction rather than a feature. The best was
    held in a ref for the tab and compared across whatever the student had
    played, so a strong run on supply and demand set the bar for their next run
    on the French Revolution. Those are different question sets with different
    totals and the comparison never meant anything.

    Anything above ten was written by a build that kept the weighted total
    here, and it is dropped rather than converted. There is no honest way to
    turn 1,380 into a score without the denominator it was earned against,
    and that was never stored. A student who studied on an older build keeps
    every concept standing in this record and loses only the bar, which the
    next run they finish sets again. */
export function bestFor(topic: string): number | null {
  const record = recordFor(topic);
  if (!record || record.runs === 0) return null;
  return record.bestRating > 10 ? null : record.bestRating;
}

/* ── Writing a finished run back ─────────────────────────────────────────── */

/** Fold a completed run into the record for its topic.

    ── When a standing may go down ──────────────────────────────────────────
    A Round 4 grade always wins, including when it is worse than what was
    there: somebody who explained a concept last week and cannot today has
    learned something true about themselves and the app should not hide it.

    Everything weaker can only raise a standing, never lower it, and that
    asymmetry is the important part. Round 4 asks about at most three
    concepts, so most concepts in most runs are answered in the rounds and
    never produced. Letting that demote "explained" to "recognised" would mean
    a student's record decayed every time they played, purely because the
    round that produces the strong evidence is capped. Not being asked to
    explain something is not evidence that you cannot. */
export function rememberRun(topic: string, data: Reveal): void {
  const key = topicKey(topic);
  if (!key) return;

  const library = read();
  const now = Date.now();
  const existing = library.topics.find((t) => t.key === key);

  /* Keyed loosely, so a concept that comes back from the model spelled a
     little differently lands on the record it already had. The display name
     is taken from the newest run, because that is the wording the student was
     actually shown this time. */
  const previous = new Map((existing?.concepts ?? []).map((c) => [conceptKey(c.concept), c]));
  const merged = new Map(previous);

  for (const line of data.concepts) {
    const standing = conceptStanding(line);
    const before = previous.get(conceptKey(line.concept));
    const graded = line.outcome !== null;

    merged.set(conceptKey(line.concept), {
      concept: line.concept,
      standing:
        before === undefined || graded || rank(standing) > rank(before.standing)
          ? standing
          : before.standing,
      reached: Math.max(before?.reached ?? 0, line.reached),
      seen: (before?.seen ?? 0) + 1,
      lastSeen: now,
    });
  }

  const record: TopicRecord = {
    topic: topic.trim(),
    key,
    runs: (existing?.runs ?? 0) + 1,
    /* An older build's weighted total is not a bar this run has to clear, so
       it is replaced rather than maxed against. See `bestFor`. */
    bestRating: Math.max(
      (existing?.bestRating ?? 0) > 10 ? 0 : (existing?.bestRating ?? 0),
      data.rating.score
    ),
    lastRun: now,
    concepts: [...merged.values()],
  };

  const topics = [record, ...library.topics.filter((t) => t.key !== key)]
    .sort((a, b) => b.lastRun - a.lastRun)
    .slice(0, MAX_TOPICS);

  write({ version: 1, topics });
}

/** Standings in order of how much they establish, for the upgrade-only rule
    above. Deliberately not exported: this ordering is an implementation
    detail of merging, not a ranking the interface should ever show. Nothing
    on screen tells a student that "recognised" beats "not yet", because in
    the only sense that matters to them it does not. Both are still open. */
function rank(standing: Standing): number {
  switch (standing) {
    case "explained":
      return 4;
    case "almost":
      return 3;
    case "recognised":
      return 2;
    case "not-yet":
      return 1;
    case "missed":
      return 0;
  }
}

/* ── Forgetting ──────────────────────────────────────────────────────────
   Offered plainly on the results screen rather than buried, because a record
   nobody can delete is a record kept on somebody rather than for them. */

export function forget(topic: string): void {
  const key = topicKey(topic);
  write({ version: 1, topics: read().topics.filter((t) => t.key !== key) });
}

