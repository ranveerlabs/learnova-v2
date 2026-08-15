/* Fitting a student's material into a prompt without quietly testing only its
   first page.

   Until now the whole pasted source went into every generation call, whole and
   unread. For the page or two of notes most sessions are built on that is
   exactly right and this file does nothing to it. For a chapter it is two
   problems at once: the same long text is paid for on all four calls of a run,
   and a model handed more material than it can hold writes about the part it
   read first. A student who pastes twelve pages and gets a session about pages
   one and two has been quietly told that the rest did not matter.

   ── Why a spread, and not a window per round ────────────────────────────

   The obvious move is to give each round a different slice, so a run walks the
   document. It does not survive contact with the ladder. The whole mode is
   built on asking about the SAME concepts with less help each round: the
   concepts are decided once, on the opening call, and rounds 1 to 3 must all
   be able to write cited questions about them. A round whose slice never
   mentions a concept cannot cite one, so every question it wrote about that
   concept would fail the citation check and be dropped, and the student would
   get a short round for a reason nobody could see.

   So every call in a session sees the same material: an even spread of the
   document rather than the front of it. The concepts come from the whole text,
   and every round can reach every concept.

   ── What this must never do ─────────────────────────────────────────────

   Narrow what a citation is checked against. Sampling decides what the model
   is SHOWN; `keepGrounded` still checks every citation against the full source
   the student pasted, exactly as before. That ordering is what keeps this
   safe: a span the model copied out of the sample is by construction also in
   the full text, so the check can only ever be stricter than the prompt, never
   looser. Checking against the sample instead would be a real hole, because a
   student's own material would start failing verification for the crime of
   being long. */

/** Roughly a long paragraph. Chunks are the unit a spread is built from, so
    they want to be small enough that dropping one loses a paragraph rather
    than a section, and large enough to still read as prose. */
const CHUNK_CHARS = 1200;

/** How much material any one generation call is given.

    Not a context window limit, and deliberately well under one. The binding
    constraint here is a shared key at 450 requests per thirty minutes and a
    student waiting on the cold open, so the number to keep small is tokens per
    call rather than tokens the model could technically hold. */
export const PROMPT_BUDGET_CHARS = 12_000;

/* The ceiling on pasted material is not here. It lives in lib/source.ts
   beside the floor, because it is the same kind of fact and the interface
   states both from one place. */

/** Split material into paragraph-sized pieces.

    Blank lines first, because that is where a writer already decided one idea
    ends. A paragraph longer than a chunk on its own is split again at sentence
    ends, and only if it is still too long is it cut mid-sentence, which is the
    case that produces a chunk nobody can quote cleanly and is why it is last. */
export function chunkSource(source: string): string[] {
  const paragraphs = source
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const pieces: string[] = [];
  for (const paragraph of paragraphs) {
    if (paragraph.length <= CHUNK_CHARS) {
      pieces.push(paragraph);
      continue;
    }
    /* Keep the terminator with the sentence it ends, so a chunk boundary never
       lands between a word and its full stop. */
    const sentences = paragraph.match(/[^.!?]+[.!?]+[\])'"’”]*\s*|[^.!?]+$/g) ?? [paragraph];
    let held = "";
    for (const sentence of sentences) {
      if (held && held.length + sentence.length > CHUNK_CHARS) {
        pieces.push(held.trim());
        held = "";
      }
      /* A single sentence longer than a chunk. Nothing left to split on that
         is not arbitrary, so it is cut on width. */
      if (sentence.length > CHUNK_CHARS) {
        for (let i = 0; i < sentence.length; i += CHUNK_CHARS) {
          pieces.push(sentence.slice(i, i + CHUNK_CHARS).trim());
        }
        continue;
      }
      held += sentence;
    }
    if (held.trim()) pieces.push(held.trim());
  }

  return pieces.filter(Boolean);
}

export type Sampled = {
  /** The material to put in the prompt. */
  text: string;
  /** Whether anything was left out. False means `text` is the whole source. */
  sampled: boolean;
  /** How many of the source's chunks made it in, and how many there were. */
  kept: number;
  total: number;
};

/** The material a prompt should carry for this source.

    Short enough to fit, and the source itself when it already does: the common
    case costs one length check and returns the original string. */
export function sampleForPrompt(source: string, budget = PROMPT_BUDGET_CHARS): Sampled {
  const trimmed = source.trim();
  const chunks = chunkSource(trimmed);

  if (trimmed.length <= budget || chunks.length <= 1) {
    return { text: trimmed, sampled: false, kept: chunks.length, total: chunks.length };
  }

  /* How many chunks fit, then which ones. Evenly spaced across the document by
     index rather than taken from the front, so the run covers the material
     the student actually pasted. The first chunk is always in: it is where a
     passage says what it is about, and a session that cannot name its own
     subject is a worse failure than one that skips a paragraph. */
  const average = trimmed.length / chunks.length;
  const room = Math.max(1, Math.floor(budget / Math.max(1, average)));
  if (room >= chunks.length) {
    return { text: trimmed, sampled: false, kept: chunks.length, total: chunks.length };
  }

  const step = chunks.length / room;
  const picked: number[] = [];
  for (let i = 0; i < room; i++) {
    const index = Math.min(chunks.length - 1, Math.floor(i * step));
    if (picked[picked.length - 1] !== index) picked.push(index);
  }

  /* The gaps are marked rather than papered over. A model given two paragraphs
     spliced together with nothing between them will happily write a question
     about the join, and the join is not in the student's notes. */
  const parts: string[] = [];
  let previous = -1;
  for (const index of picked) {
    if (previous !== -1 && index > previous + 1) parts.push("[...]");
    parts.push(chunks[index]);
    previous = index;
  }
  if (previous < chunks.length - 1) parts.push("[...]");

  return {
    text: parts.join("\n\n"),
    sampled: true,
    kept: picked.length,
    total: chunks.length,
  };
}
