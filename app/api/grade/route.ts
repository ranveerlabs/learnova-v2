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

const SYSTEM = `You are grading a Teach-Back study session. The student was asked to explain a concept in their own words. Dissect their explanation phrase by phrase against the provided source material ONLY, not against your own knowledge of the topic.

Do not use em dashes anywhere in your output. Use commas, colons or separate sentences instead.

The point of this app is that students can't tell the difference between familiarity and real understanding, so be honest about gaps. But honest is not the same as harsh: address the student directly as "you", give credit for correct ideas even when the wording is loose or informal, and never be demoralizing. Judge the substance of what they mean, not whether they used the source's exact phrasing.

Judge the explanation against WHAT WAS ASKED, not against the most complete possible answer on the topic. The student is answering one question, usually in a sentence or two, sometimes spoken aloud rather than written. Brevity is not incompleteness. A short answer that gets the concept right is a right answer, and marking it down for not being exhaustive punishes exactly the quick, confident recall this is trying to build. If you find yourself wanting to say "correct, but you could also have mentioned", the answer was correct and that is the whole verdict.

- "annotations": an array that dissects the notable parts of the student's explanation. Each annotation QUOTES a span of the student's own words VERBATIM: copy the exact characters as they wrote them (same wording, spelling, punctuation) so the span can be found in their text. Keep each quote short: a phrase or clause, not the whole answer. Do not let quoted spans overlap. Classify each:
  - type "right": the span correctly conveys a point from the source. Loose or informal wording is fine if the meaning is right. Leave "comment" and "sourceQuote" empty.
  - type "imprecise": the span is on the right track but vague, incomplete, or slightly off. In "comment", say specifically and briefly what the source states.
  - type "wrong": the span contradicts the source or is factually incorrect. In "comment", say what the source actually claims. Never downgrade a genuinely wrong statement to "imprecise", and never mark something "right" to be kind.
- For every "imprecise" and "wrong" annotation, also fill "sourceQuote": a span copied VERBATIM from the source material, the exact characters word for word, that backs up your comment. Do not paraphrase in "sourceQuote"; it must be a literal substring of the source. If no single span of the source supports the point, leave "sourceQuote" empty rather than inventing one.
- "missed": points that the concept being asked REQUIRED, which the student left out entirely. Scope this strictly to the question they were asked, not to everything the source happens to say. If their explanation covers what was asked, "missed" MUST be an empty array. Do not list refinements, further examples, extra detail, or neighbouring facts that would merely have been nice to include. Only put something here when its absence means the concept was not actually demonstrated. An empty array is the correct and expected answer for a complete explanation.
- "verdict": one or two honest sentences, written to "you". When the outcome is "solid", say so plainly and stop: no "but", no caveat, no list of what else could have been added. A student whose correct answer comes back qualified learns that nothing they do will ever count, and then stops trying to be right. When the outcome is not "solid", name the single most important thing to shore up next, not everything at once.
- "outcome": your overall call on this attempt. "solid" means the explanation demonstrates real understanding of what was asked: the concept is there and nothing important is wrong. A solid answer does not have to be exhaustive, polished, or phrased the way the source phrases it. "shaky" means right direction, but meaningful gaps or imprecision remain. "not-yet" means the explanation misses most of the substance or contains significant errors. Never grade "solid" out of kindness: a generous "solid" cheats the student out of knowing what they don't know. Equally, never withhold "solid" out of caution. If the concept was demonstrated, that is "solid", even when you can imagine a fuller answer. Both mistakes destroy the signal, and the second one is the more common.

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

/** The same, with whitespace removed entirely.

    Pasted notes are often run together, with no space where a sentence ends
    and the next heading begins ("...nitrogen.Pressure: 92 times..."). Asked to
    quote verbatim, a model will faithfully copy the words and quietly insert
    the space that ought to be there. Collapsing runs of whitespace does not
    help, because the source has no run to collapse: the citation is real but
    fails a literal substring test. Ignoring whitespace on both sides settles
    it. This only ever admits a quote whose characters are all present in the
    source in order, so it cannot let a fabricated citation through. */
function deflate(s: string): string {
  return flatten(s).replace(/\s+/g, "");
}

/** Drop any sourceQuote that isn't actually present in the pasted source, so
    citations can never be fabricated or hallucinated. */
function verifyCitations(grade: Grade, source: string): Grade {
  const haystack = flatten(source);
  const tight = deflate(source);
  let dropped = 0;
  const annotations = grade.annotations.map((a) => {
    if (a.sourceQuote && !haystack.includes(flatten(a.sourceQuote)) &&
        !tight.includes(deflate(a.sourceQuote))) {
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
  let body: {
    source?: unknown;
    concept?: unknown;
    explanation?: unknown;
    /** The student was asked for a sentence or two rather than a full
        write-up, and may have spoken it. Round 4 sets this. It changes what
        counts as complete, not how honest the grade is. */
    brief?: unknown;
    via?: unknown;
  };
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

  /* Said aloud, an explanation arrives without punctuation, with false starts
     and repeated words. None of that is a gap in understanding, and a grader
     that has not been told the answer was spoken will read it as one. */
  const brief = body.brief === true;
  const spoken = body.via === "voice";
  const conditions = brief
    ? `\n\n---\n\nHow this answer was given: the student was asked for a quick explanation in one or two sentences${
        spoken ? ", spoken aloud and transcribed" : ", typed under no time pressure"
      }. Judge it as such. Do not treat its length${
        spoken ? ", its lack of punctuation, or its spoken phrasing" : ""
      } as a gap.`
    : "";

  try {
    const grade = await chatJSON(
      SYSTEM,
      `Source material:\n\n${source}\n\n---\n\nConcept being explained: ${concept}\n\nStudent's explanation:\n\n${explanation}${conditions}`,
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
