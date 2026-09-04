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

export const topicKey = (t: string) => t.trim().toLowerCase().replace(/\s+/g, " ");

export const conceptKey = (c: string) =>
  c
    .trim()
    .toLowerCase()
    .replace(/^(the|a|an)\s+/, "")
    .replace(/[.,;:!?]+$/, "")
    .replace(/\s+/g, " ");

function read(): Library {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const p = JSON.parse(raw) as Library;
    if (p?.version !== 1 || !Array.isArray(p.topics)) return EMPTY;
    return p;
  } catch {
    return EMPTY;
  }
}

function write(lib: Library): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(lib));
  } catch {}
}

export const studied = (): TopicRecord[] => [...read().topics].sort((a, b) => b.lastRun - a.lastRun);

export const standingsFor = (topic: string): Record<string, Standing> =>
  Object.fromEntries((recordFor(topic)?.concepts ?? []).map((c) => [conceptKey(c.concept), c.standing]));

export function recordFor(topic: string): TopicRecord | null {
  const k = topicKey(topic);
  return read().topics.find((t) => t.key === k) ?? null;
}

export const openConcepts = (r: TopicRecord | null): string[] =>
  r ? r.concepts.filter((c) => isOpen(c.standing)).map((c) => c.concept) : [];

export function bestFor(topic: string): number | null {
  const r = recordFor(topic);
  if (!r || !r.runs) return null;
  return r.bestRating > 10 ? null : r.bestRating;
}

export function rememberRun(topic: string, data: Reveal): void {
  const k = topicKey(topic);
  if (!k) return;

  const lib = read();
  const now = Date.now();
  const old = lib.topics.find((t) => t.key === k);

  const was = new Map((old?.concepts ?? []).map((c) => [conceptKey(c.concept), c]));
  const now_ = new Map(was);

  for (const line of data.concepts) {
    const st = conceptStanding(line);
    const before = was.get(conceptKey(line.concept));
    const graded = line.outcome !== null;

    now_.set(conceptKey(line.concept), {
      concept: line.concept,
      standing: !before || graded || rank(st) > rank(before.standing) ? st : before.standing,
      reached: Math.max(before?.reached ?? 0, line.reached),
      seen: (before?.seen ?? 0) + 1,
      lastSeen: now,
    });
  }

  const rec: TopicRecord = {
    topic: topic.trim(),
    key: k,
    runs: (old?.runs ?? 0) + 1,
    bestRating: Math.max((old?.bestRating ?? 0) > 10 ? 0 : old?.bestRating ?? 0, data.rating.score),
    lastRun: now,
    concepts: [...now_.values()],
  };

  const topics = [rec, ...lib.topics.filter((t) => t.key !== k)]
    .sort((a, b) => b.lastRun - a.lastRun)
    .slice(0, MAX_TOPICS);

  write({ version: 1, topics });
}

function rank(s: Standing): number {
  switch (s) {
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
  const k = topicKey(topic);
  write({ version: 1, topics: read().topics.filter((t) => t.key !== k) });
}
