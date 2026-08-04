import { NextResponse } from "next/server";
import { AIError, chatJSON } from "@/lib/ai";
import { sourceProblem } from "@/lib/source";

export type Concept = {
  name: string;
  prompt: string;
};

const SYSTEM = `You are helping build a Teach-Back study session. Given source material a student pasted (notes, a passage), identify the distinct concepts in it that are worth testing for real understanding.

Rules:
- Only pick concepts actually present in the source material.
- 3 to 6 concepts, ordered roughly from foundational to advanced.
- Each concept gets a short name and a one-sentence prompt asking the student to explain it in their own words. The prompt should say what to cover, without giving away the answer.
- Judge whether there is anything real to test BEFORE writing any concepts. If the material has no genuine conceptual content, return an empty "concepts" array and explain why in "insufficient". That applies when the text is random or mashed characters, filler or placeholder text, a bare list of words or terms with no explanation of them, navigation or boilerplate scraped from a page, or simply too thin to explain anything about. An empty array is a correct and expected answer for such input.
- Never invent, pad or generalise concepts to fill the array. A concept you could have written without reading this particular source is not a concept from this source. If you find fewer than three real ones, return the empty array and say so.
- Do not use em dashes anywhere in your output. Use commas, colons or separate sentences instead.

Respond with JSON in exactly one of these two shapes:
{"concepts": [{"name": "...", "prompt": "..."}]}
{"concepts": [], "insufficient": "one or two sentences, addressed to the student as \\"you\\", saying what is missing from the material"}`;

type ConceptsPayload = { concepts: Concept[]; insufficient?: string };

/* An empty array is now a meaningful answer rather than a malformed one, so
   shape validation no longer doubles as a "did the model say anything useful"
   check. The route decides what an empty array means. */
function isConceptsPayload(v: unknown): v is ConceptsPayload {
  if (typeof v !== "object" || v === null) return false;
  const { concepts, insufficient } = v as { concepts?: unknown; insufficient?: unknown };
  if (insufficient !== undefined && typeof insufficient !== "string") return false;
  return (
    Array.isArray(concepts) &&
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
  if (typeof source !== "string") {
    return NextResponse.json({ error: "Paste some source material first." }, { status: 400 });
  }
  /* The client checks this too, so the student sees it before pressing
     anything, but the floor belongs to the route, not to the button. */
  const problem = sourceProblem(source);
  if (problem) {
    return NextResponse.json({ error: problem }, { status: 400 });
  }

  try {
    const { concepts, insufficient } = await chatJSON(
      SYSTEM,
      `Source material:\n\n${source}`,
      isConceptsPayload
    );

    /* The local floors catch material that is too small or not prose. This
       catches the rest: text that reads fine and still has nothing in it to
       explain. Better to say so than to hand back invented concepts. */
    if (concepts.length === 0) {
      const said = insufficient?.trim();
      return NextResponse.json(
        {
          error: said
            ? said.slice(0, 300)
            : "There is not enough substance in that to build a session from. Paste fuller notes or a longer passage, one that explains ideas rather than just naming them.",
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ concepts });
  } catch (err) {
    if (err instanceof AIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Concept extraction failed:", err);
    return NextResponse.json({ error: "Concept extraction failed. Try again." }, { status: 500 });
  }
}
