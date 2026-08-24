"use client";

import { conceptStanding, isOpen, type Reveal, type Standing } from "./engine";

const KEY = "learnova.record.v1";

export type ConceptRecord = {
  concept: string;
  standing: Standing;
  reached: number;
  seen: number;
  lastSeen: number;
};

export type TopicRecord = {
  topic: string;
  key: string;
  runs: number;
  bestRating: number;
  lastRun: number;
  concepts: ConceptRecord[];
};

type Library = { version: 1; topics: TopicRecord[] };

const EMPTY: Library = { version: 1, topics: [] };

const MAX_TOPICS = 40;

export function topicKey(topic: string): string {
  return topic.trim().toLowerCase().replace(/\s+/g, " ");
}

export function conceptKey(concept: string): string {
  return concept
    .trim()
    .toLowerCase()
    .replace(/^(the|a|an)\s+/, "")
    .replace(/[.,;:!?]+$/, "")
    .replace(/\s+/g, " ");
}

function read(): Library {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Library;
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
  }
}

export function studied(): TopicRecord[] {
  return [...read().topics].sort((a, b) => b.lastRun - a.lastRun);
}

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

export function openConcepts(record: TopicRecord | null): string[] {
  if (!record) return [];
  return record.concepts.filter((c) => isOpen(c.standing)).map((c) => c.concept);
}

export function bestFor(topic: string): number | null {
  const record = recordFor(topic);
  if (!record || record.runs === 0) return null;
  // anything over 10 is an old build's weighted total. can't convert it without the
  // denominator it was earned against, and that was never stored, so drop it.
  return record.bestRating > 10 ? null : record.bestRating;
}

export function rememberRun(topic: string, data: Reveal): void {
  const key = topicKey(topic);
  if (!key) return;

  const library = read();
  const now = Date.now();
  const existing = library.topics.find((t) => t.key === key);

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

export function forget(topic: string): void {
  const key = topicKey(topic);
  write({ version: 1, topics: read().topics.filter((t) => t.key !== key) });
}
