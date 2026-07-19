import { NextResponse } from "next/server";
import { AIError, chatJSON, isStringArray } from "@/lib/ai";

export type Outcome = "solid" | "shaky" | "not-yet";

export type AnnotationType = "right" | "imprecise" | "wrong";

export type Annotation = {
  quote: string; // verbatim span from the student's explanation
  type: AnnotationType;
  comment: string; // what the source claims instead (empty for "right")
  sourceQuote: string; // verbatim span from the source backing the comment ("" if none/unverified)
};

export type Grade = {
  annotations: Annotation[];
  missed: string[];
  verdict: string;
  outcome: Outcome;
};

const SYSTEM = `You are grading a Teach-Back study session. The student was asked to explain a concept in their own words. Dissect their explanation phrase by phrase against the provided source material ONLY — not against your own knowledge of the topic.

The point of this app is that students can't tell the difference between familiarity and real understanding, so be honest about gaps. But honest is not the same as harsh: address the student directly as "you", give credit for correct ideas even when the wording is loose or informal, and never be demoralizing. Judge the substance of what they mean, not whether they used the source's exact phrasing.

- "annotations": an array that dissects the notable parts of the student's explanation. Each annotation QUOTES a span of the student's own words VERBATIM — copy the exact characters as they wrote them (same wording, spelling, punctuation) so the span can be found in their text. Keep each quote short: a phrase or clause, not the whole answer. Do not let quoted spans overlap. Classify each:
  - type "right": the span correctly conveys a point from the source. Loose or informal wording is fine if the meaning is right. Leave "comment" and "sourceQuote" empty.
  - type "imprecise": the span is on the right track but vague, incomplete, or slightly off. In "comment", say specifically and briefly what the source states.
  - type "wrong": the span contradicts the source or is factually incorrect. In "comment", say what the source actually claims. Never downgrade a genuinely wrong statement to "imprecise", and never mark something "right" to be kind.
- For every "imprecise" and "wrong" annotation, also fill "sourceQuote": a span copied VERBATIM from the source material — the exact characters, word for word — that backs up your comment. Do not paraphrase in "sourceQuote"; it must be a literal substring of the source. If no single span of the source supports the point, leave "sourceQuote" empty rather than inventing one.
- "missed": important points from the source the student left out entirely. These are not in their text, so they have no quote — just state each missing point.
- "verdict": one or two honest, encouraging sentences, written to "you", summarizing where you stand and what to shore up next.
- "outcome": your overall call on this attempt. "solid" means the explanation demonstrates real understanding: the concept's key points are there and nothing important is wrong. "shaky" means right direction, but meaningful gaps or imprecision remain. "not-yet" means the explanation misses most of the substance or contains significant errors. Never grade "solid" out of kindness — solid means demonstrated, and a generous "solid" cheats the student out of knowing what they don't know.

Respond with JSON exactly in this shape:
{"annotations": [{"quote": "...", "type": "right" | "imprecise" | "wrong", "comment": "...", "sourceQuote": "..."}], "missed": ["..."], "verdict": "...", "outcome": "solid" | "shaky" | "not-yet"}`;

function isAnnotation(v: unknown): v is Annotation {
  if (typeof v !== "object" || v === null) return false;
  const a = v as Annotation;
  return (
    typeof a.quote === "string" &&
    typeof a.comment === "string" &&
    typeof a.sourceQuote === "string" &&
    (a.type === "right" || a.type === "imprecise" || a.type === "wrong")
  );
}

/** Collapse whitespace and straighten quotes for a tolerant presence check. */
function flatten(s: string): string {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Drop any sourceQuote that isn't actually present in the pasted source, so
    citations can never be fabricated or hallucinated. */
function verifyCitations(grade: Grade, source: string): Grade {
  const haystack = flatten(source);
  let dropped = 0;
  const annotations = grade.annotations.map((a) => {
    if (a.sourceQuote && !haystack.includes(flatten(a.sourceQuote))) {
      dropped++;
      return { ...a, sourceQuote: "" };
    }
    return a;
  });
  if (dropped > 0) {
    console.warn(`Dropped ${dropped} sourceQuote(s) not found verbatim in the source.`);
  }
  return { ...grade, annotations };
}

function isGrade(v: unknown): v is Grade {
  if (typeof v !== "object" || v === null) return false;
  const g = v as Grade;
  return (
    Array.isArray(g.annotations) &&
    g.annotations.every(isAnnotation) &&
    isStringArray(g.missed) &&
    typeof g.verdict === "string" &&
    (g.outcome === "solid" || g.outcome === "shaky" || g.outcome === "not-yet")
  );
}

export async function POST(req: Request) {
  let body: { source?: unknown; concept?: unknown; explanation?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { source, concept, explanation } = body;
  if (
    typeof source !== "string" || !source.trim() ||
    typeof concept !== "string" || !concept.trim() ||
    typeof explanation !== "string" || !explanation.trim()
  ) {
    return NextResponse.json(
      { error: "source, concept, and explanation are all required." },
      { status: 400 }
    );
  }

  try {
    const grade = await chatJSON(
      SYSTEM,
      `Source material:\n\n${source}\n\n---\n\nConcept being explained: ${concept}\n\nStudent's explanation:\n\n${explanation}`,
      isGrade
    );
    return NextResponse.json(verifyCitations(grade, source));
  } catch (err) {
    if (err instanceof AIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Grading failed:", err);
    return NextResponse.json({ error: "Grading failed. Try again." }, { status: 500 });
  }
}
