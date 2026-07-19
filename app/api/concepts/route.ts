import { NextResponse } from "next/server";
import { AIError, chatJSON } from "@/lib/ai";

export type Concept = {
  name: string;
  prompt: string;
};

const SYSTEM = `You are helping build a Teach-Back study session. Given source material a student pasted (notes, a passage), identify the distinct concepts in it that are worth testing for real understanding.

Rules:
- Only pick concepts actually present in the source material.
- 3 to 6 concepts, ordered roughly from foundational to advanced.
- Each concept gets a short name and a one-sentence prompt asking the student to explain it in their own words. The prompt should say what to cover, without giving away the answer.

Respond with JSON exactly in this shape:
{"concepts": [{"name": "...", "prompt": "..."}]}`;

function isConceptsPayload(v: unknown): v is { concepts: Concept[] } {
  if (typeof v !== "object" || v === null) return false;
  const { concepts } = v as { concepts?: unknown };
  return (
    Array.isArray(concepts) &&
    concepts.length > 0 &&
    concepts.every(
      (c) =>
        typeof c === "object" && c !== null &&
        typeof (c as Concept).name === "string" &&
        typeof (c as Concept).prompt === "string"
    )
  );
}

export async function POST(req: Request) {
  let source: unknown;
  try {
    ({ source } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (typeof source !== "string" || !source.trim()) {
    return NextResponse.json({ error: "Paste some source material first." }, { status: 400 });
  }

  try {
    const { concepts } = await chatJSON(
      SYSTEM,
      `Source material:\n\n${source}`,
      isConceptsPayload
    );
    return NextResponse.json({ concepts });
  } catch (err) {
    if (err instanceof AIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Concept extraction failed:", err);
    return NextResponse.json({ error: "Concept extraction failed. Try again." }, { status: 500 });
  }
}
