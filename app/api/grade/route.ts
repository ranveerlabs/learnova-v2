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

/* ── Two rubrics, because there are two kinds of session ──────────────────

   A grounded session has real source material: the student pasted it, every
   question was cited against it, and grading an explanation against that
   passage and nothing else is the whole guarantee of the mode. That is the
   rubric below, unchanged.

   A topic-only session has no source material and never did. What it has is
   the questions the session happened to ask, and those were being handed to
   the grader as though they were a passage from a textbook. The result is the
   one that was reported: asked to define nutrition, a student wrote "the
   benefit you get from consuming healthy foods", and it came back marked
   imprecise against the quote "Which mineral is carrots especially rich in?",
   with that question printed under the heading "Source". The definition was
   fine. The grader was doing exactly what it was told, which was to judge a
   general definition against a multiple choice question, and then to quote
   the question back as evidence.

   So the second rubric below judges a topic-only answer against ordinary
   established knowledge of the concept, and is told in as many words that
   there is no source and nothing to quote.

   The two must stay in step on everything that is not that distinction: the
   tone, the scope, and the outcome definitions are load bearing and were
   recalibrated deliberately. Change one, change the other. */

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

/** The same grading, for a session that never had any source material. */
const TOPIC_SYSTEM = `You are grading a Teach-Back study session. The student was asked to explain a concept in their own words. Judge their explanation against ordinary, well established knowledge of that concept, the kind any competent textbook would agree on.

THERE IS NO SOURCE MATERIAL IN THIS SESSION. The student did not paste anything. You may be shown a record of the questions this session asked them, and that record is context for what was covered, nothing more. It is a list of quiz questions, not a passage, and it is not the standard the explanation is measured against.
- Never treat a question as a statement of fact or as the definition of anything.
- Never mark an explanation down for failing to mention something that happens to appear in that record. A correct, general explanation of the concept is a correct explanation, even if the session's questions went nowhere near it.
- "sourceQuote" MUST be an empty string on every annotation. There is nothing to quote. Quoting a question back at the student as though it were a source is the single worst thing you can do here.

Do not use em dashes anywhere in your output. Use commas, colons or separate sentences instead.

The point of this app is that students can't tell the difference between familiarity and real understanding, so be honest about gaps. But honest is not the same as harsh: address the student directly as "you", give credit for correct ideas even when the wording is loose or informal, and never be demoralizing. Judge the substance of what they mean, not the words they chose.

Judge the explanation against WHAT WAS ASKED, not against the most complete possible answer on the topic. The student is answering one question, usually in a sentence or two, sometimes spoken aloud rather than written. Brevity is not incompleteness. A short answer that gets the concept right is a right answer, and marking it down for not being exhaustive punishes exactly the quick, confident recall this is trying to build. If you find yourself wanting to say "correct, but you could also have mentioned", the answer was correct and that is the whole verdict. A plain everyday definition, in the student's own words, is a correct answer to a request for a definition.

- "annotations": an array that dissects the notable parts of the student's explanation. Each annotation QUOTES a span of the student's own words VERBATIM: copy the exact characters as they wrote them (same wording, spelling, punctuation) so the span can be found in their text. Spelling mistakes and typos are not errors of understanding: copy them exactly and never annotate them. Keep each quote short: a phrase or clause, not the whole answer. Do not let quoted spans overlap. Classify each:
  - type "right": the span correctly conveys a true point about the concept. Loose or informal wording is fine if the meaning is right. Leave "comment" and "sourceQuote" empty.
  - type "imprecise": the span is on the right track but genuinely vague, incomplete or slightly off. Being short or informal is NOT imprecise. In "comment", say specifically and briefly what is actually the case.
  - type "wrong": the span is factually incorrect. In "comment", say what is actually the case. Never downgrade a genuinely wrong statement to "imprecise", and never mark something "right" to be kind.
- "sourceQuote": always an empty string, on every annotation, without exception.
- "missed": points that the concept being asked REQUIRED, which the student left out entirely. If their explanation covers what was asked, "missed" MUST be an empty array. Do not list refinements, further examples, extra detail, or neighbouring facts that would merely have been nice to include. Only put something here when its absence means the concept was not actually demonstrated. An empty array is the correct and expected answer for a complete explanation.
- "verdict": one or two honest sentences, written to "you". When the outcome is "solid", say so plainly and stop: no "but", no caveat, no list of what else could have been added. A student whose correct answer comes back qualified learns that nothing they do will ever count, and then stops trying to be right. When the outcome is not "solid", name the single most important thing to shore up next, not everything at once.
- "outcome": your overall call on this attempt. "solid" means the explanation demonstrates real understanding of what was asked: the concept is there and nothing important is wrong. A solid answer does not have to be exhaustive or polished. "shaky" means right direction, but meaningful gaps or imprecision remain. "not-yet" means the explanation misses most of the substance or contains significant errors. Never grade "solid" out of kindness: a generous "solid" cheats the student out of knowing what they don't know. Equally, never withhold "solid" out of caution. If the concept was demonstrated, that is "solid", even when you can imagine a fuller answer. Both mistakes destroy the signal, and the second one is the more common.

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
    citations can never be fabricated or hallucinated.

    In a topic-only session there is no source to be present in, so every
    quote goes. The prompt already says so; this is the part that holds when
    the model does it anyway, and it is the reason a quiz question can no
    longer be printed under the heading "Source". */
/** Is this quote actually present in that text, allowing for the punctuation
    and spacing a model tidies up on the way past? */
function present(quote: string, haystack: string, tight: string): boolean {
  return haystack.includes(flatten(quote)) || tight.includes(deflate(quote));
}

/** Every quotation on a grade, checked against the thing it claims to quote.

    ── The student's own words ──────────────────────────────────────────────
    `quote` is documented as a verbatim span of the explanation, and the
    interface treats it as one: an annotation whose span cannot be located in
    the text is still shown, as a note, with the quote printed inside actual
    quotation marks. So a model that paraphrases instead of quoting, or that
    invents the sentence it wishes had been written, produces a card that
    attributes words to the student that the student never wrote.

    That is the worst failure this file can produce. It is not a wrong mark on
    a real sentence, which a student can look at and disagree with; it is a
    sentence that does not exist, and the only thing they can conclude is that
    they wrote it and forgot. Blanking the quote leaves the comment, which is
    often still worth reading, and leaves nothing to be misread as theirs.

    Checked here rather than trusted from the prompt for the same reason the
    source citations are: this one is decidable without a model, so it should
    not depend on one. */
export function verifyCitations(
  grade: Grade,
  source: string,
  explanation: string,
  grounded: boolean
): Grade {
  const said = flatten(explanation);
  const saidTight = deflate(explanation);
  const inSource = flatten(source);
  const sourceTight = deflate(source);

  let lostQuotes = 0;
  let lostCitations = 0;

  const annotations = grade.annotations.map((a) => {
    let out = a;

    if (out.quote && !present(out.quote, said, saidTight)) {
      lostQuotes++;
      out = { ...out, quote: "" };
    }

    /* In a topic-only session there is no source to be present in, so every
       citation goes whatever it says. */
    if (out.sourceQuote && (!grounded || !present(out.sourceQuote, inSource, sourceTight))) {
      if (grounded) lostCitations++;
      out = { ...out, sourceQuote: "" };
    }

    return out;
  });

  if (lostQuotes > 0) {
    console.warn(`Dropped ${lostQuotes} quote(s) not found in the student's explanation.`);
  }
  if (lostCitations > 0) {
    console.warn(`Dropped ${lostCitations} sourceQuote(s) not found verbatim in the source.`);
  }

  /* An annotation with nothing left to point at and nothing to say is not a
     note, it is a blank card. The ones that keep a comment survive. */
  return { ...grade, annotations: annotations.filter((a) => a.quote || a.comment.trim()) };
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
    /** Whether `source` is material the student actually pasted. False for a
        topic-only session, where `source` is only a record of the questions
        this session asked and must never be graded against. Defaults to the
        grounded reading, so a caller that forgets to say gets the stricter
        rubric rather than the looser one. */
    grounded?: unknown;
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

  /* Grounded unless the caller says otherwise. The stricter rubric is the
     safe default: applied to a grounded session it is correct, and applied to
     a topic-only one it is merely what this already did. */
  const grounded = body.grounded !== false;

  /* The heading this material is given matters as much as the rubric. Called
     "Source material", a list of the session's own questions reads as a
     passage to quote from, which is how a multiple choice question ended up
     printed under the word "Source" as evidence against a student. */
  const material = grounded
    ? `Source material:\n\n${source}`
    : `For context only, the questions this session asked the student about "${concept}". This is a record of what was covered. It is NOT source material, it is NOT a passage, and it is NOT the standard the explanation is judged against:\n\n${source}`;

  try {
    const grade = await chatJSON(
      grounded ? SYSTEM : TOPIC_SYSTEM,
      `${material}\n\n---\n\nConcept being explained: ${concept}\n\nStudent's explanation:\n\n${explanation}${conditions}`,
      isGrade
    );
    return NextResponse.json(verifyCitations(grade, source, explanation, grounded));
  } catch (err) {
    if (err instanceof AIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Grading failed:", err);
    return NextResponse.json({ error: "Grading failed. Try again." }, { status: 500 });
  }
}
