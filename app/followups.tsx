"use client";

import { useState } from "react";
import { postJSON } from "./client";
import { GhostButton, Label } from "./ui";

type Turn = { question: string; answer: string };

/* A margin conversation about the marks. The route clarifies the feedback and
   the source; it will not hand over the concept. The interface says so up
   front rather than letting the student discover it by being refused. */

export function Followups({
  source,
  concept,
  explanation,
  feedback,
}: {
  source: string;
  concept: string;
  explanation: string;
  feedback: string;
}) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [thread, setThread] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask() {
    const q = question.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      const { answer } = await postJSON<{ answer: string }>("/api/followup", {
        source,
        concept,
        explanation,
        feedback,
        question: q,
      });
      setThread((prev) => [...prev, { question: q, answer }]);
      setQuestion("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't answer that.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start font-sans text-[0.875rem] font-medium text-accent underline decoration-accent/30 decoration-1 underline-offset-4 transition-colors hover:decoration-accent"
      >
        Ask about a mark
      </button>
    );
  }

  return (
    <section className="flex max-w-[42rem] flex-col gap-4 rounded-[3px] border border-line bg-sunk p-5">
      <div className="flex flex-col gap-1.5">
        <Label>Ask about a mark</Label>
        <p className="font-sans text-[0.8125rem] leading-[1.55] text-ink-soft">
          This explains what a mark meant and what your source says. It won&apos;t explain the
          concept. That part stays yours.
        </p>
      </div>

      {thread.length > 0 && (
        <ol className="flex flex-col gap-4">
          {thread.map((t, i) => (
            <li key={i} className="flex flex-col gap-1.5 border-l-2 border-line-strong pl-3.5">
              <p className="font-sans text-[0.875rem] font-semibold text-ink">{t.question}</p>
              <p className="whitespace-pre-wrap font-read text-[0.9375rem] leading-[1.65] text-ink-soft">
                {t.answer}
              </p>
            </li>
          ))}
        </ol>
      )}

      {error && (
        <p role="alert" className="font-sans text-[0.8125rem] text-broken-ink">
          {error}
        </p>
      )}

      <div className="flex flex-col items-start gap-2.5">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) ask();
          }}
          placeholder="e.g. What did “fix carbon” mean in note 2?"
          rows={2}
          className="w-full resize-y rounded-[3px] border border-line bg-page p-3 font-sans text-[0.875rem] leading-[1.55] text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
        />
        <GhostButton onClick={ask} disabled={loading || !question.trim()}>
          {loading ? "Reading…" : "Ask"}
        </GhostButton>
      </div>
    </section>
  );
}
