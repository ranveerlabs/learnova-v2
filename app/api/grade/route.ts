import { NextResponse } from "next/server";
import { AIError, chatJSON, isStringArray } from "@/lib/ai";

export type Outcome = "solid" | "shaky" | "not-yet";

export type AnnotationType = "right" | "imprecise" | "wrong";

export type Annotation = {
  quote: string;
  type: AnnotationType;
  comment: string;
  sourceQuote: string;
};

export type Grade = {
  annotations: Annotation[];
  missed: string[];
  verdict: string;
  outcome: Outcome;
};

const SYS = `You are grading a Teach-Back study session. The student was asked to explain a concept in their own words. Dissect their explanation phrase by phrase against the provided source material ONLY, not against your own knowledge of the topic.

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

const SYS_TOPIC = `You are grading a Teach-Back study session. The student was asked to explain a concept in their own words. Judge their explanation against ordinary, well established knowledge of that concept, the kind any competent textbook would agree on.

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

function okAnn(v: unknown): v is Annotation {
  if (typeof v !== "object" || v === null) return false;
  const a = v as Annotation;
  return (
    typeof a.quote === "string" &&
    typeof a.comment === "string" &&
    typeof a.sourceQuote === "string" &&
    (a.type === "right" || a.type === "imprecise" || a.type === "wrong")
  );
}

const flat = (s: string) =>
  s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim().toLowerCase();

const tight = (s: string) => flat(s).replace(/\s+/g, "");

const inThere = (q: string, hay: string, hayTight: string) =>
  hay.includes(flat(q)) || hayTight.includes(tight(q));

export function verifyCitations(g: Grade, src: string, exp: string, grounded: boolean): Grade {
  const said = flat(exp);
  const saidT = tight(exp);
  const from = flat(src);
  const fromT = tight(src);

  let noQ = 0, noSrc = 0;

  const anns = g.annotations.map((a) => {
    let out = a;

    if (out.quote && !inThere(out.quote, said, saidT)) {
      noQ++;
      out = { ...out, quote: "" };
    }
    if (out.sourceQuote && (!grounded || !inThere(out.sourceQuote, from, fromT))) {
      if (grounded) noSrc++;
      out = { ...out, sourceQuote: "" };
    }

    return out;
  });

  if (noQ) console.warn(`grade:dropped ${noQ} quote(s), not in their answer`);
  if (noSrc) console.warn(`grade:dropped ${noSrc} citation(s), not in the source`);

  return { ...g, annotations: anns.filter((a) => a.quote || a.comment.trim()) };
}

function okGrade(v: unknown): v is Grade {
  if (typeof v !== "object" || v === null) return false;
  const g = v as Grade;
  return (
    Array.isArray(g.annotations) &&
    g.annotations.every(okAnn) &&
    isStringArray(g.missed) &&
    typeof g.verdict === "string" &&
    (g.outcome === "solid" || g.outcome === "shaky" || g.outcome === "not-yet")
  );
}

const err = (msg: string, status: number) => NextResponse.json({ error: msg }, { status });

export async function POST(req: Request) {
  let b: {
    source?: unknown;
    concept?: unknown;
    explanation?: unknown;
    brief?: unknown;
    via?: unknown;
    grounded?: unknown;
  };
  try {
    b = await req.json();
  } catch {
    return err("Invalid request body.", 400);
  }

  const { source: src, concept, explanation: exp } = b;
  const str = (v: unknown) => typeof v === "string" && !!v.trim();
  if (!str(src) || !str(concept) || !str(exp))
    return err("source, concept, and explanation are all required.", 400);

  const s = src as string, c = concept as string, e = exp as string;

  const spoken = b.via === "voice";
  const how =
    b.brief === true
      ? `\n\n---\n\nHow this answer was given: the student was asked for a quick explanation in one or two sentences${
          spoken ? ", spoken aloud and transcribed" : ", typed under no time pressure"
        }. Judge it as such. Do not treat its length${
          spoken ? ", its lack of punctuation, or its spoken phrasing" : ""
        } as a gap.`
      : "";

  const grounded = b.grounded !== false;

  const material = grounded
    ? `Source material:\n\n${s}`
    : `For context only, the questions this session asked the student about "${c}". This is a record of what was covered. It is NOT source material, it is NOT a passage, and it is NOT the standard the explanation is judged against:\n\n${s}`;

  try {
    const g = await chatJSON(
      grounded ? SYS : SYS_TOPIC,
      `${material}\n\n---\n\nConcept being explained: ${c}\n\nStudent's explanation:\n\n${e}${how}`,
      okGrade
    );
    return NextResponse.json(verifyCitations(g, s, e, grounded));
  } catch (x) {
    if (x instanceof AIError) return err(x.message, x.status);
    console.error("grade:rip", x);
    return err("Oops! We could not mark that one :( Give it another go.", 500);
  }
}
