import { NextResponse } from "next/server";
import { AIError, chatJSON, isStringArray } from "@/lib/ai";

export type Grade = {
  gotRight: string[];
  partlyRight: string[];
  missed: string[];
  gotWrong: string[];
  verdict: string;
};

const SYSTEM = `You are grading a Teach-Back study session. The student was asked to explain a concept in their own words. Grade their explanation ONLY against the provided source material — not against your own knowledge of the topic.

The point of this app is that students can't tell the difference between familiarity and real understanding, so be honest about gaps. But honest is not the same as harsh: address the student directly as "you", give credit for correct ideas even when the wording is loose or informal, and never be demoralizing. Judge the substance of what they mean, not whether they used the source's exact phrasing.

- "gotRight": ideas the student explained correctly, including correct ideas expressed in casual or imprecise language. If they clearly conveyed the right idea, it belongs here even if worded differently from the source.
- "partlyRight": ideas they got the gist of but stated imprecisely, incompletely, or with a minor inaccuracy — right direction, not fully there. Note briefly what's missing or fuzzy.
- "missed": important points from the source about this concept that the explanation left out entirely.
- "gotWrong": things the student stated that genuinely contradict the source. Empty if nothing is actually wrong. Do not put merely-vague statements here — those go in "partlyRight".
- "verdict": one or two honest, encouraging sentences, written to "you", summarizing where you stand and what to shore up next.

Each list item is one short, specific point (a phrase or single sentence), written to "you" where natural. Respond with JSON exactly in this shape:
{"gotRight": ["..."], "partlyRight": ["..."], "missed": ["..."], "gotWrong": ["..."], "verdict": "..."}`;

function isGrade(v: unknown): v is Grade {
  if (typeof v !== "object" || v === null) return false;
  const g = v as Grade;
  return (
    isStringArray(g.gotRight) &&
    isStringArray(g.partlyRight) &&
    isStringArray(g.missed) &&
    isStringArray(g.gotWrong) &&
    typeof g.verdict === "string"
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
    return NextResponse.json(grade);
  } catch (err) {
    if (err instanceof AIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Grading failed:", err);
    return NextResponse.json({ error: "Grading failed. Try again." }, { status: 500 });
  }
}
