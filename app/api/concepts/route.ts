import { NextResponse } from "next/server";
import { AIError, chatJSON } from "@/lib/ai";
import { sourceProblem } from "@/lib/source";

export type Concept = {
  name: string;
  prompt: string;
};

const SYS = `You are helping build a Teach-Back study session. Given source material a student pasted (notes, a passage), identify the distinct concepts in it that are worth testing for real understanding.

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

type Payload = { concepts: Concept[]; insufficient?: string };

function ok(v: unknown): v is Payload {
  if (typeof v !== "object" || v === null) return false;
  const { concepts, insufficient } = v as { concepts?: unknown; insufficient?: unknown };
  if (insufficient !== undefined && typeof insufficient !== "string") return false;
  return (
    Array.isArray(concepts) &&
    concepts.every(
      (c) =>
        typeof c === "object" &&
        c !== null &&
        typeof (c as Concept).name === "string" &&
        typeof (c as Concept).prompt === "string"
    )
  );
}

const err = (msg: string, status: number) => NextResponse.json({ error: msg }, { status });

export async function POST(req: Request) {
  let src: unknown;
  try {
    ({ source: src } = await req.json());
  } catch {
    return err("Invalid request body.", 400);
  }
  if (typeof src !== "string") return err("Paste some source material first.", 400);

  const bad = sourceProblem(src);
  if (bad) return err(bad, 400);

  try {
    const { concepts, insufficient } = await chatJSON(SYS, `Source material:\n\n${src}`, ok);

    // empty array is a real answer
    if (!concepts.length) {
      const said = insufficient?.trim();
      return err(
        said?.slice(0, 300) ??
          "There is not enough substance in that to build a session from. Paste fuller notes or a longer passage, one that explains ideas rather than just naming them.",
        422
      );
    }

    return NextResponse.json({ concepts });
  } catch (e) {
    if (e instanceof AIError) return err(e.message, e.status);
    console.error("concepts:rip", e);
    return err("Oops! We could not pull the concepts out of that :( Give it another go.", 500);
  }
}
