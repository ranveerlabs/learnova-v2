"use client";

import { useState } from "react";
import type { Concept } from "./api/concepts/route";
import type { Grade } from "./api/grade/route";

type Phase = "source" | "explain" | "result" | "done";

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error ?? "Something went wrong. Try again.");
  }
  return data as T;
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>("source");
  const [source, setSource] = useState("");
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [idx, setIdx] = useState(0);
  const [explanation, setExplanation] = useState("");
  const [grade, setGrade] = useState<Grade | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const concept = concepts[idx];

  async function startSession() {
    setLoading(true);
    setError(null);
    try {
      const { concepts } = await postJSON<{ concepts: Concept[] }>("/api/concepts", { source });
      setConcepts(concepts);
      setIdx(0);
      setPhase("explain");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function submitExplanation() {
    setLoading(true);
    setError(null);
    try {
      const result = await postJSON<Grade>("/api/grade", {
        source,
        concept: `${concept.name} — ${concept.prompt}`,
        explanation,
      });
      setGrade(result);
      setPhase("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function nextConcept() {
    setExplanation("");
    setGrade(null);
    setError(null);
    if (idx + 1 < concepts.length) {
      setIdx(idx + 1);
      setPhase("explain");
    } else {
      setPhase("done");
    }
  }

  function reset() {
    setPhase("source");
    setSource("");
    setConcepts([]);
    setIdx(0);
    setExplanation("");
    setGrade(null);
    setError(null);
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <header>
        <h1 className="text-2xl font-bold">Learnova</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Explain it in your own words. Find out what you actually understand.
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {phase === "source" && (
        <section className="flex flex-col gap-3">
          <label htmlFor="source" className="font-medium">
            Paste your source material
          </label>
          <textarea
            id="source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Notes, a textbook passage, an article…"
            rows={12}
            className="rounded-md border border-gray-300 bg-transparent p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700"
          />
          <button
            onClick={startSession}
            disabled={loading || !source.trim()}
            className="self-start rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Finding concepts…" : "Start teach-back"}
          </button>
        </section>
      )}

      {(phase === "explain" || phase === "result") && concept && (
        <section className="flex flex-col gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Concept {idx + 1} of {concepts.length}
          </p>
          <h2 className="text-lg font-semibold">{concept.name}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">{concept.prompt}</p>

          {phase === "explain" && (
            <>
              <textarea
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="Explain it in your own words — as if teaching someone who hasn't read the material."
                rows={8}
                autoFocus
                className="rounded-md border border-gray-300 bg-transparent p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700"
              />
              <button
                onClick={submitExplanation}
                disabled={loading || !explanation.trim()}
                className="self-start rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Grading…" : "Grade my explanation"}
              </button>
            </>
          )}

          {phase === "result" && grade && (
            <div className="flex flex-col gap-4">
              <p className="rounded-md border border-gray-300 px-4 py-3 text-sm font-medium dark:border-gray-700">
                {grade.verdict}
              </p>

              <GradeList
                title="You got right"
                items={grade.gotRight}
                empty="Nothing solid landed yet — take another run at it below."
                className="text-green-700 dark:text-green-400"
              />
              <GradeList
                title="Almost there"
                items={grade.partlyRight}
                empty="Nothing half-formed — your points were either solid or absent."
                className="text-blue-700 dark:text-blue-400"
              />
              <GradeList
                title="You missed"
                items={grade.missed}
                empty="Nothing — you covered the source's key points."
                className="text-amber-700 dark:text-amber-400"
              />
              <GradeList
                title="You got wrong"
                items={grade.gotWrong}
                empty="Nothing contradicted the source."
                className="text-red-700 dark:text-red-400"
              />

              <button
                onClick={nextConcept}
                className="self-start rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                {idx + 1 < concepts.length ? "Next concept" : "Finish"}
              </button>
            </div>
          )}
        </section>
      )}

      {phase === "done" && (
        <section className="flex flex-col items-start gap-4">
          <h2 className="text-lg font-semibold">Session complete</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            You worked through {concepts.length} concept{concepts.length === 1 ? "" : "s"}. Paste new
            material to go again.
          </p>
          <button
            onClick={reset}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Start over
          </button>
        </section>
      )}
    </main>
  );
}

function GradeList({
  title,
  items,
  empty,
  className,
}: {
  title: string;
  items: string[];
  empty: string;
  className: string;
}) {
  return (
    <div>
      <h3 className={`text-sm font-semibold ${className}`}>{title}</h3>
      {items.length === 0 ? (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{empty}</p>
      ) : (
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
