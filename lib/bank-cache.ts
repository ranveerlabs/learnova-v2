import { createHash } from "node:crypto";
import type { Question } from "@/app/round/types";

export type CachedBank = {
  concepts: string[];
  questions: Question[];
  exhausted: boolean;
};

type Entry = { bank: CachedBank; at: number };

const TTL = 30 * 60 * 1000;
const CAP = 120;

const K = Symbol.for("learnova.bankCache");
const g = globalThis as unknown as { [K]?: Map<string, Entry> };
const store: Map<string, Entry> = (g[K] ??= new Map<string, Entry>());

const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 32);

export function bankKey(p: {
  stage: "open" | 1 | 2 | 3;
  topic: string;
  notes: string;
  concepts?: string[];
}): string {
  return [
    p.stage,
    p.topic.trim().toLowerCase().replace(/\s+/g, " "),
    hash(p.notes),
    hash((p.concepts ?? []).join(" ")),
  ].join("|");
}

export function recall(k: string): CachedBank | null {
  const e = store.get(k);
  if (!e) return null;
  if (Date.now() - e.at > TTL) {
    store.delete(k);
    return null;
  }
  store.delete(k);
  store.set(k, e);
  return e.bank;
}

export function keep(k: string, bank: CachedBank): void {
  store.set(k, { bank, at: Date.now() });
  while (store.size > CAP) {
    const old = store.keys().next();
    if (old.done) break;
    store.delete(old.value);
  }
}
