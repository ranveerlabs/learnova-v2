"use client";

import { useMemo, useState } from "react";
import type { Concept } from "./api/concepts/route";
import type { Annotation, Grade, Outcome } from "./api/grade/route";
import {
  Ask,
  Eyebrow,
  GhostButton,
  PrimaryButton,
  Progress,
  Thinking,
  Wordmark,
} from "./ui";

type Phase = "source" | "explain" | "result" | "done";

type ItemStatus = "pending" | "resurfacing" | "demonstrated" | "set-aside";

type Attempt = { explanation: string; grade: Grade };

type SessionItem = {
  concept: Concept;
  attempts: Attempt[];
  status: ItemStatus;
  returns: number; // how many times this concept has been sent back around
};

/* After this many attempts without a solid, the student may set the
   concept aside — it ends the loop honestly instead of punishing them. */
const SET_ASIDE_AFTER = 3;

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
  const [items, setItems] = useState<SessionItem[]>([]);
  const [queue, setQueue] = useState<number[]>([]);
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentIdx = queue[0];
  const current = currentIdx !== undefined ? items[currentIdx] : undefined;
  const lastAttempt = current?.attempts[current.attempts.length - 1];

  async function startSession() {
    setLoading(true);
    setError(null);
    try {
      const { concepts } = await postJSON<{ concepts: Concept[] }>("/api/concepts", { source });
      setItems(
        concepts.map((concept) => ({ concept, attempts: [], status: "pending", returns: 0 }))
      );
      setQueue(concepts.map((_, i) => i));
      setPhase("explain");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function submitExplanation() {
    if (!current) return;
    const submitted = explanation;
    setLoading(true);
    setError(null);
    try {
      const grade = await postJSON<Grade>("/api/grade", {
        source,
        concept: `${current.concept.name} — ${current.concept.prompt}`,
        explanation: submitted,
      });
      setItems((prev) =>
        prev.map((item, i) =>
          i === currentIdx
            ? { ...item, attempts: [...item.attempts, { explanation: submitted, grade }] }
            : item
        )
      );
      setPhase("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  /** Leave the current concept with a final status and move to what's next. */
  function finishCurrent(status: "demonstrated" | "set-aside") {
    setItems((prev) => prev.map((item, i) => (i === currentIdx ? { ...item, status } : item)));
    const rest = queue.slice(1);
    setQueue(rest);
    setExplanation("");
    setError(null);
    setPhase(rest.length > 0 ? "explain" : "done");
  }

  function retryNow() {
    setExplanation("");
    setError(null);
    setPhase("explain");
  }

  function comeBackLater() {
    setItems((prev) =>
      prev.map((item, i) =>
        i === currentIdx ? { ...item, status: "resurfacing", returns: item.returns + 1 } : item
      )
    );
    setQueue((prev) => [...prev.slice(1), prev[0]]);
    setExplanation("");
    setError(null);
    setPhase("explain");
  }

  function reset() {
    setPhase("source");
    setSource("");
    setItems([]);
    setQueue([]);
    setExplanation("");
    setError(null);
  }

  const inSession = phase === "explain" || phase === "result";
  const attemptNo = (current?.attempts.length ?? 0) + 1;
  const othersWaiting = queue.length > 1;
  const demonstrated = items.filter((i) => i.status === "demonstrated");
  const setAside = items.filter((i) => i.status === "set-aside");

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-line/70">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-5 py-4">
          <Wordmark />
          {inSession && items.length > 0 && (
            <Progress
              segments={items.map((i) => ({ status: i.status, returns: i.returns }))}
              current={currentIdx}
            />
          )}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-12 sm:py-16">
        {error && (
          <p
            role="alert"
            className="mb-8 rounded-lg border border-wrong-fg/25 bg-wrong-bg px-4 py-3 text-sm text-wrong-fg"
          >
            {error}
          </p>
        )}

        {/* ---- Source ------------------------------------------------ */}
        {phase === "source" && !loading && (
          <section className="rise flex flex-col gap-5">
            <Eyebrow>Start</Eyebrow>
            <Ask>What are you studying?</Ask>
            <p className="max-w-prose text-[0.95rem] leading-relaxed text-ink-soft">
              Paste your notes or a passage. Learnova finds the concepts worth testing, then asks
              you to explain each one in your own words — and shows you where familiarity ends and
              real understanding begins.
            </p>
            <textarea
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="Paste notes, a textbook passage, an article…"
              rows={12}
              className="w-full resize-y rounded-xl border border-line bg-surface p-4 text-[0.95rem] leading-relaxed text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
            />
            <PrimaryButton onClick={startSession} disabled={!source.trim()}>
              Find the concepts <span aria-hidden>→</span>
            </PrimaryButton>
          </section>
        )}

        {phase === "source" && loading && (
          <Thinking title="Reading your material" sub="Finding the ideas worth testing." />
        )}

        {/* ---- Explain ---------------------------------------------- */}
        {phase === "explain" && current && !loading && (
          <section className="rise flex flex-col gap-5">
            <Eyebrow>
              {current.concept.name}
              {attemptNo > 1 && ` · attempt ${attemptNo}`}
            </Eyebrow>
            <Ask>{current.concept.prompt}</Ask>

            {lastAttempt && (
              <details className="group rounded-xl border border-line bg-surface-sunk px-4 py-3">
                <summary className="cursor-pointer list-none text-sm font-medium text-ink-soft transition-colors hover:text-ink">
                  <span
                    className="mr-1.5 inline-block transition-transform group-open:rotate-90"
                    aria-hidden
                  >
                    ›
                  </span>
                  What last attempt flagged
                </summary>
                <div className="mt-3 flex flex-col gap-3">
                  <FeedbackBand
                    label="Flagged"
                    items={flaggedList(lastAttempt.grade.annotations)}
                    empty="Nothing was flagged last time."
                    tone="wrong"
                  />
                  <FeedbackBand
                    label="Missed"
                    items={lastAttempt.grade.missed}
                    empty="Nothing was missing last time."
                    tone="missed"
                  />
                </div>
              </details>
            )}

            <textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder={
                attemptNo > 1
                  ? "Explain it again, fresh — aim to cover what was flagged last time…"
                  : "Explain it in your own words, as if teaching someone who hasn't read the material…"
              }
              rows={9}
              autoFocus
              className="w-full resize-y rounded-xl border border-line bg-surface p-4 text-[0.95rem] leading-relaxed text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
            />
            <PrimaryButton onClick={submitExplanation} disabled={!explanation.trim()}>
              Check my understanding <span aria-hidden>→</span>
            </PrimaryButton>
          </section>
        )}

        {phase === "explain" && loading && (
          <Thinking
            title="Reading your explanation"
            sub="Checking it against the source — line by line."
          />
        )}

        {/* ---- Result (dissection) ---------------------------------- */}
        {phase === "result" && current && lastAttempt && (
          <section className="rise flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Eyebrow>
                  {current.concept.name}
                  {current.attempts.length > 1 && ` · attempt ${current.attempts.length}`}
                </Eyebrow>
                <OutcomeChip outcome={lastAttempt.grade.outcome} />
              </div>
              <p className="font-display text-lg italic leading-snug text-ink">
                {lastAttempt.grade.verdict}
              </p>
            </div>

            <Dissection
              text={lastAttempt.explanation}
              annotations={lastAttempt.grade.annotations}
            />

            <FeedbackBand
              label="You left out"
              items={lastAttempt.grade.missed}
              empty="You covered the source's key points — nothing important was left out."
              tone="missed"
            />

            <Followups
              key={`${currentIdx}-${current.attempts.length}`}
              source={source}
              concept={`${current.concept.name} — ${current.concept.prompt}`}
              explanation={lastAttempt.explanation}
              feedback={feedbackSummary(lastAttempt.grade)}
            />

            {lastAttempt.grade.outcome === "solid" ? (
              <PrimaryButton onClick={() => finishCurrent("demonstrated")}>
                {othersWaiting ? (
                  <>
                    Next concept <span aria-hidden>→</span>
                  </>
                ) : (
                  "Finish session"
                )}
              </PrimaryButton>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-ink-soft">
                  A concept counts when you can explain it, not when you&apos;ve seen it. Take
                  another run now{othersWaiting ? ", or let it come back around later" : ""}.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <PrimaryButton onClick={retryNow}>Try again now</PrimaryButton>
                  {othersWaiting && current.attempts.length < SET_ASIDE_AFTER && (
                    <GhostButton onClick={comeBackLater}>Come back to this later</GhostButton>
                  )}
                  {(current.attempts.length >= SET_ASIDE_AFTER || !othersWaiting) && (
                    <GhostButton onClick={() => finishCurrent("set-aside")}>
                      Set it aside for today
                    </GhostButton>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ---- Done ------------------------------------------------- */}
        {phase === "done" && (
          <section className="rise flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <Eyebrow>Session complete</Eyebrow>
              <Ask>
                {setAside.length === 0
                  ? "Every concept, demonstrated."
                  : "Here's where you actually stand."}
              </Ask>
              <p className="max-w-prose text-[0.95rem] leading-relaxed text-ink-soft">
                {setAside.length === 0
                  ? `You explained ${demonstrated.length} concept${
                      demonstrated.length === 1 ? "" : "s"
                    } well enough to count — not just recognized ${
                      demonstrated.length === 1 ? "it" : "them"
                    }, explained ${demonstrated.length === 1 ? "it" : "them"}.`
                  : "Demonstrated means you explained it and the explanation held up. Set aside means it's still open — a good place to start next time."}
              </p>
            </div>

            <ul className="flex flex-col gap-2">
              {items.map((item, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-4 rounded-xl border border-line bg-surface px-4 py-3"
                >
                  <span className="text-[0.95rem] font-medium text-ink">{item.concept.name}</span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="font-mono text-[0.7rem] tracking-wide text-ink-faint">
                      {item.attempts.length}{" "}
                      {item.attempts.length === 1 ? "attempt" : "attempts"}
                    </span>
                    {item.status === "demonstrated" ? (
                      <span className="rounded-full bg-right-bg px-2.5 py-1 font-mono text-[0.65rem] font-medium uppercase tracking-[0.12em] text-right-fg">
                        Demonstrated
                      </span>
                    ) : (
                      <span className="rounded-full bg-missed-bg px-2.5 py-1 font-mono text-[0.65rem] font-medium uppercase tracking-[0.12em] text-missed-fg">
                        Set aside
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>

            <GhostButton onClick={reset}>Start a new session</GhostButton>
          </section>
        )}
      </main>
    </div>
  );
}

/* ---- Dissection: highlight the student's own words inline ------------- */

/* Colour tints for sighted readers, plus a distinct underline shape per type
   (solid / dotted / wavy) so the three kinds stay distinguishable without colour. */
const MARK_TONE: Record<Annotation["type"], string> = {
  right: "text-right-fg underline decoration-solid decoration-right-fg/70 decoration-2 underline-offset-4",
  imprecise:
    "rounded bg-almost-bg px-0.5 text-almost-fg underline decoration-dotted decoration-almost-fg decoration-2 underline-offset-4",
  wrong:
    "rounded bg-wrong-bg px-0.5 text-wrong-fg underline decoration-wavy decoration-wrong-fg decoration-2 underline-offset-4",
};

const CARD_UNDERLINE: Record<"imprecise" | "wrong", string> = {
  imprecise: "underline decoration-dotted decoration-almost-fg decoration-2 underline-offset-4",
  wrong: "underline decoration-wavy decoration-wrong-fg decoration-2 underline-offset-4",
};

type Segment =
  | { kind: "text"; value: string }
  | { kind: "mark"; value: string; id: number; type: Annotation["type"]; n?: number };

type Card = {
  id: number;
  n?: number;
  type: "imprecise" | "wrong";
  quote: string;
  comment: string;
  sourceQuote: string;
};

/** Straight-quote curly punctuation without changing string length, so match
    positions stay valid against the original text. */
function normalize(s: string): string {
  return s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
}

function overlaps(s: number, e: number, taken: [number, number][]): boolean {
  return taken.some(([a, b]) => s < b && e > a);
}

function findRange(
  normText: string,
  normQuote: string,
  taken: [number, number][]
): { start: number; end: number } | null {
  if (!normQuote) return null;
  // Exact match first.
  for (let from = 0; ; ) {
    const i = normText.indexOf(normQuote, from);
    if (i < 0) break;
    const e = i + normQuote.length;
    if (!overlaps(i, e, taken)) return { start: i, end: e };
    from = i + 1;
  }
  // Whitespace-tolerant fallback (model may re-flow whitespace in the quote).
  const escaped = normQuote.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  let re: RegExp;
  try {
    re = new RegExp(escaped, "gi");
  } catch {
    return null;
  }
  let m: RegExpExecArray | null;
  while ((m = re.exec(normText))) {
    const e = m.index + m[0].length;
    if (!overlaps(m.index, e, taken)) return { start: m.index, end: e };
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return null;
}

function buildDissection(text: string, annotations: Annotation[]): {
  segments: Segment[];
  cards: Card[];
} {
  const normText = normalize(text);
  const taken: [number, number][] = [];
  const matched: {
    start: number;
    end: number;
    type: Annotation["type"];
    comment: string;
    sourceQuote: string;
    id: number;
  }[] = [];
  const unmatched: Card[] = [];

  annotations.forEach((ann, id) => {
    const quote = ann.quote.trim();
    const range = quote ? findRange(normText, normalize(quote), taken) : null;
    if (range) {
      taken.push([range.start, range.end]);
      matched.push({ ...range, type: ann.type, comment: ann.comment, sourceQuote: ann.sourceQuote, id });
    } else if (ann.type !== "right") {
      // Couldn't locate it — keep it as a card so no feedback is silently lost.
      unmatched.push({
        id,
        type: ann.type,
        quote: ann.quote,
        comment: ann.comment,
        sourceQuote: ann.sourceQuote,
      });
    }
  });

  matched.sort((a, b) => a.start - b.start);

  // Number the flagged (imprecise/wrong) spans in reading order.
  let counter = 0;
  const numById = new Map<number, number>();
  for (const m of matched) if (m.type !== "right") numById.set(m.id, ++counter);

  const segments: Segment[] = [];
  let cursor = 0;
  for (const m of matched) {
    if (m.start > cursor) segments.push({ kind: "text", value: text.slice(cursor, m.start) });
    segments.push({
      kind: "mark",
      value: text.slice(m.start, m.end),
      id: m.id,
      type: m.type,
      n: numById.get(m.id),
    });
    cursor = m.end;
  }
  if (cursor < text.length) segments.push({ kind: "text", value: text.slice(cursor) });

  const cards: Card[] = [];
  for (const m of matched) {
    if (m.type === "right") continue;
    cards.push({
      id: m.id,
      n: numById.get(m.id),
      type: m.type,
      quote: text.slice(m.start, m.end),
      comment: m.comment,
      sourceQuote: m.sourceQuote,
    });
  }
  cards.push(...unmatched);

  return { segments, cards };
}

function Dissection({ text, annotations }: { text: string; annotations: Annotation[] }) {
  const [active, setActive] = useState<number | null>(null);
  const { segments, cards } = useMemo(() => buildDissection(text, annotations), [text, annotations]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-ink-faint" aria-hidden />
          <h3 className="font-mono text-[0.7rem] font-medium uppercase tracking-[0.14em] text-ink-faint">
            Your explanation
          </h3>
        </div>
        <p className="rounded-xl border border-line bg-surface px-4 py-3.5 text-[0.95rem] leading-[1.9] text-ink">
          {segments.map((seg, i) =>
            seg.kind === "text" ? (
              <span key={i}>{seg.value}</span>
            ) : seg.type === "right" ? (
              <span key={i} className={MARK_TONE.right}>
                {seg.value}
              </span>
            ) : (
              <button
                key={i}
                type="button"
                onClick={() => setActive(active === seg.id ? null : seg.id)}
                onMouseEnter={() => setActive(seg.id)}
                className={`${MARK_TONE[seg.type]} cursor-pointer align-baseline transition-shadow ${
                  active === seg.id ? "ring-2 ring-current/40" : ""
                }`}
              >
                {seg.value}
                {seg.n !== undefined && (
                  <sup className="ml-0.5 font-mono text-[0.6rem] font-semibold">{seg.n}</sup>
                )}
              </button>
            )
          )}
        </p>
      </div>

      {cards.length > 0 && (
        <ul className="flex flex-col gap-2">
          {cards.map((card) => (
            <li
              key={card.id}
              onMouseEnter={() => setActive(card.id)}
              onMouseLeave={() => setActive(null)}
              className={`rounded-xl px-4 py-3 transition-shadow ${
                card.type === "wrong" ? "bg-wrong-bg" : "bg-almost-bg"
              } ${active === card.id ? "ring-2 ring-current/30" : ""}`}
            >
              <div className="flex items-baseline gap-2">
                {card.n !== undefined && (
                  <span
                    className={`font-mono text-[0.7rem] font-semibold ${
                      card.type === "wrong" ? "text-wrong-fg" : "text-almost-fg"
                    }`}
                  >
                    {card.n}
                  </span>
                )}
                <div className="flex flex-col gap-1.5">
                  <span
                    className={`text-[0.9rem] font-medium ${CARD_UNDERLINE[card.type]} ${
                      card.type === "wrong" ? "text-wrong-fg" : "text-almost-fg"
                    }`}
                  >
                    “{card.quote}”
                  </span>
                  {card.sourceQuote ? (
                    <span className="text-[0.9rem] leading-relaxed text-ink">
                      The source says:{" "}
                      <span className="italic text-ink-soft">“{card.sourceQuote}”</span>
                      {card.comment && (
                        <span className="mt-1 block text-[0.85rem] text-ink-soft">
                          {card.comment}
                        </span>
                      )}
                    </span>
                  ) : (
                    card.comment && (
                      <span className="text-[0.9rem] leading-relaxed text-ink">{card.comment}</span>
                    )
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Flatten flagged annotations into short strings for the retry recap. */
function flaggedList(annotations: Annotation[]): string[] {
  return annotations
    .filter((a) => a.type !== "right")
    .map((a) => (a.comment ? `“${a.quote}” — ${a.comment}` : `“${a.quote}”`));
}

/** Compact summary of a grade, given to the follow-up route for context. */
function feedbackSummary(grade: Grade): string {
  const flagged = grade.annotations
    .filter((a) => a.type !== "right")
    .map((a) => {
      const src = a.sourceQuote ? ` (source: "${a.sourceQuote}")` : "";
      return `- ${a.type}: "${a.quote}" — ${a.comment}${src}`;
    });
  const parts = [`Verdict: ${grade.verdict}`];
  if (flagged.length) parts.push(`Flagged:\n${flagged.join("\n")}`);
  if (grade.missed.length) parts.push(`Left out:\n${grade.missed.map((m) => `- ${m}`).join("\n")}`);
  return parts.join("\n\n");
}

type Turn = { question: string; answer: string };

/** Ask a grounded question about the feedback — the route won't hand over the
    answer to the concept, it only clarifies the feedback and the source. */
function Followups({
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
        className="self-start text-sm font-medium text-brand underline decoration-brand/30 underline-offset-4 transition-colors hover:decoration-brand"
      >
        Unclear on the feedback? Ask about it
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface-sunk px-4 py-4">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />
        <h3 className="font-mono text-[0.7rem] font-medium uppercase tracking-[0.14em] text-ink-soft">
          Ask about the feedback
        </h3>
      </div>
      <p className="text-[0.85rem] leading-relaxed text-ink-faint">
        This clarifies what the feedback meant and what the source says — it won&apos;t explain the
        concept for you. That part&apos;s still yours.
      </p>

      {thread.map((t, i) => (
        <div key={i} className="flex flex-col gap-1.5 border-l-2 border-line pl-3">
          <p className="text-[0.9rem] font-medium text-ink">{t.question}</p>
          <p className="whitespace-pre-wrap text-[0.9rem] leading-relaxed text-ink-soft">
            {t.answer}
          </p>
        </div>
      ))}

      {error && <p className="text-sm text-wrong-fg">{error}</p>}

      <div className="flex flex-col gap-2">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) ask();
          }}
          placeholder="e.g. What did “fix carbon” mean in the feedback?"
          rows={2}
          className="w-full resize-y rounded-lg border border-line bg-surface p-3 text-[0.9rem] leading-relaxed text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
        />
        <GhostButton onClick={ask} disabled={loading || !question.trim()}>
          {loading ? "Thinking…" : "Ask"}
        </GhostButton>
      </div>
    </div>
  );
}

const OUTCOME_CHIP: Record<Outcome, { label: string; cls: string }> = {
  solid: { label: "Demonstrated", cls: "bg-right-bg text-right-fg" },
  shaky: { label: "Nearly there", cls: "bg-almost-bg text-almost-fg" },
  "not-yet": { label: "Not yet", cls: "bg-wrong-bg text-wrong-fg" },
};

function OutcomeChip({ outcome }: { outcome: Outcome }) {
  const c = OUTCOME_CHIP[outcome];
  return (
    <span
      className={`rounded-full px-2.5 py-1 font-mono text-[0.65rem] font-medium uppercase tracking-[0.12em] ${c.cls}`}
    >
      {c.label}
    </span>
  );
}

const TONE: Record<string, { text: string; bg: string; dot: string }> = {
  right: { text: "text-right-fg", bg: "bg-right-bg", dot: "bg-right-fg" },
  almost: { text: "text-almost-fg", bg: "bg-almost-bg", dot: "bg-almost-fg" },
  missed: { text: "text-missed-fg", bg: "bg-missed-bg", dot: "bg-missed-fg" },
  wrong: { text: "text-wrong-fg", bg: "bg-wrong-bg", dot: "bg-wrong-fg" },
};

function FeedbackBand({
  label,
  items,
  empty,
  tone,
}: {
  label: string;
  items: string[];
  empty: string;
  tone: keyof typeof TONE;
}) {
  const t = TONE[tone];
  const has = items.length > 0;
  return (
    <div className={`rounded-xl px-4 py-3.5 ${has ? t.bg : "bg-surface-sunk"}`}>
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${has ? t.dot : "bg-ink-faint"}`} aria-hidden />
        <h3
          className={`font-mono text-[0.7rem] font-medium uppercase tracking-[0.14em] ${
            has ? t.text : "text-ink-faint"
          }`}
        >
          {label}
        </h3>
      </div>
      {has ? (
        <ul className="mt-2 flex flex-col gap-1.5 pl-3.5">
          {items.map((item, i) => (
            <li
              key={i}
              className="relative text-[0.9rem] leading-relaxed text-ink before:absolute before:-left-3.5 before:text-ink-faint before:content-['–']"
            >
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 pl-3.5 text-[0.85rem] italic leading-relaxed text-ink-faint">
          {empty}
        </p>
      )}
    </div>
  );
}
