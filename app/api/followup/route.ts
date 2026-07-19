import { NextResponse } from "next/server";
import { AIError, chatText } from "@/lib/ai";

// TODO: prompt-injection hardening — the question and feedback are untrusted input.
// TODO: per-user abuse/rate limits before exposing beyond local use.

const SYSTEM = `You are a study assistant inside a Teach-Back session. The student just tried to explain a concept in their own words and received feedback. They can ask you a follow-up question about that feedback.

Your job is to help them understand the FEEDBACK and what the SOURCE MATERIAL says: clarify a term, explain what a piece of feedback meant, or point them to the relevant part of the source.

Hard rules:
- Do NOT explain the concept for them, and do NOT provide a model answer or a rewrite of their explanation. The whole point is that the student must demonstrate the concept themselves afterward. If the question amounts to "what should I have written" or "just tell me the answer", warmly decline and instead nudge them toward the part of the source to reconsider.
- Ground every claim strictly in the provided source material. Do not introduce facts that aren't in the source. Quote the source where it helps, and say so.
- If the source doesn't address their question, say that plainly rather than filling the gap from your own knowledge.
- Keep it short: at most three short paragraphs, addressed to "you", plain and encouraging. Plain text only, no markdown headers.`;

export async function POST(req: Request) {
  let body: {
    source?: unknown;
    concept?: unknown;
    explanation?: unknown;
    feedback?: unknown;
    question?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { source, concept, explanation, feedback, question } = body;
  if (
    typeof source !== "string" || !source.trim() ||
    typeof concept !== "string" || !concept.trim() ||
    typeof question !== "string" || !question.trim()
  ) {
    return NextResponse.json(
      { error: "source, concept, and question are all required." },
      { status: 400 }
    );
  }

  const user = [
    `Source material:\n\n${source}`,
    `---\n\nConcept the student is being asked to explain (do NOT answer this for them): ${concept}`,
    typeof explanation === "string" && explanation.trim()
      ? `---\n\nWhat the student wrote:\n\n${explanation}`
      : "",
    typeof feedback === "string" && feedback.trim()
      ? `---\n\nThe feedback they received:\n\n${feedback}`
      : "",
    `---\n\nThe student's follow-up question:\n\n${question}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const answer = await chatText(SYSTEM, user);
    return NextResponse.json({ answer });
  } catch (err) {
    if (err instanceof AIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Follow-up failed:", err);
    return NextResponse.json({ error: "Couldn't answer that. Try again." }, { status: 500 });
  }
}
