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

/** One piece of the source, and what its edges are.

    A passage being a literal substring of the material is what makes citation
    checking safe, and it is not the same thing as the passage being READABLE
    on its own. A span can be substring-true and still mislead badly in
    isolation: cut before the "not" that governs it, stopped halfway through a
    conditional, begun mid-clause so the subject is somewhere else. So a piece
    carries what is known about its own edges, and whoever assembles pieces
    into a prompt has to say so rather than presenting a fragment as a
    finished thought. */
export type Chunk = {
  text: string;
  /** False when this piece begins part-way through a sentence. */
  opensSentence: boolean;
  /** False when this piece stops before its sentence has ended. */
  closesSentence: boolean;
};

/** Where to cut a sentence that is longer than a chunk on its own.

    There is no safe place to cut inside a sentence, so this is a ladder of
    less-bad ones: a clause joint first, then any comma, then at least a word
    boundary. Raw width is the floor and is only reached by something with no
    spaces in it at all, which is a base64 blob or a URL rather than prose.

    Only the last third of the window is considered, so that preferring a
    joint cannot produce a run of tiny chunks out of a comma-heavy sentence. */
function cutPoint(sentence: string, limit: number): number {
  const floor = Math.floor(limit * 0.67);
  const window = sentence.slice(0, limit);

  for (const pattern of [/[;:]\s/g, /,\s/g, /\s/g]) {
    let best = -1;
    for (const match of window.matchAll(pattern)) {
      const end = match.index + match[0].length;
      if (end >= floor) best = end;
    }
    if (best > 0) return best;
  }
  return limit;
}

/** Split material into paragraph-sized pieces.

    Blank lines first, because that is where a writer already decided one idea
    ends. A paragraph longer than a chunk is split again at sentence ends, with
    the terminator kept on the sentence it closes. Only a single sentence that
    is itself longer than a chunk is ever cut inside, and those cuts are marked
    on the pieces either side so nothing downstream can mistake half a sentence
    for a whole one. */
export function chunkSource(source: string): Chunk[] {
  const paragraphs = source
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const pieces: Chunk[] = [];
  const whole = (text: string) =>
    ({ text, opensSentence: true, closesSentence: true }) satisfies Chunk;

  for (const paragraph of paragraphs) {
    if (paragraph.length <= CHUNK_CHARS) {
      pieces.push(whole(paragraph));
      continue;
    }

    const sentences = paragraph.match(/[^.!?]+[.!?]+[\])'"’”]*\s*|[^.!?]+$/g) ?? [paragraph];
    let held = "";
    for (const sentence of sentences) {
      if (held && held.length + sentence.length > CHUNK_CHARS) {
        pieces.push(whole(held.trim()));
        held = "";
      }

      if (sentence.length > CHUNK_CHARS) {
        /* Flush first: what is held is a run of complete sentences and must
           not be glued onto the front of a severed one. */
        if (held.trim()) {
          pieces.push(whole(held.trim()));
          held = "";
        }
        let rest = sentence;
        let first = true;
        while (rest.length > CHUNK_CHARS) {
          const at = cutPoint(rest, CHUNK_CHARS);
          pieces.push({
            text: rest.slice(0, at).trim(),
            opensSentence: first,
            closesSentence: false,
          });
          rest = rest.slice(at);
          first = false;
        }
        if (rest.trim()) {
          pieces.push({ text: rest.trim(), opensSentence: false, closesSentence: true });
        }
        continue;
      }

      held += sentence;
    }
    if (held.trim()) pieces.push(whole(held.trim()));
  }

  return pieces.filter((c) => c.text.length > 0);
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

  /* Assembling the picked pieces, where the only job is to not lie about what
     sits between two of them.

     Three different joins, because there are three different truths to tell
     and the first version of this told all of them as "\n\n". A blank line
     between two passages means a paragraph break in the student's material,
     so using it for everything invented paragraph breaks that were not there
     and, worse, presented the two halves of one severed sentence as two
     separate complete thoughts. That is precisely the failure a verbatim
     substring check cannot catch: both halves really are in the source, and
     the thing being shown is still not what the source says. */
  const parts: string[] = [];
  let previous = -1;
  for (const index of picked) {
    const chunk = chunks[index];

    if (previous === -1) {
      parts.push(chunk.text);
    } else if (index > previous + 1) {
      /* Material was skipped. Said out loud, because a model handed two
         paragraphs spliced together will write a question about the join. */
      parts.push("\n\n[...]\n\n", chunk.text);
    } else if (!chunks[previous].closesSentence && !chunk.opensSentence) {
      /* Contiguous halves of one sentence too long to chunk. They are joined
         back into the sentence they came from rather than broken apart. */
      parts.push(chunk.text.startsWith(" ") ? chunk.text : ` ${chunk.text}`);
    } else {
      parts.push("\n\n", chunk.text);
    }
    previous = index;
  }
  if (previous < chunks.length - 1) parts.push("\n\n[...]");

  /* An opening piece that begins mid-sentence can only happen when the first
     chunk was itself a severed one, which the spread avoids by always keeping
     chunk zero. Marked anyway rather than assumed away. */
  if (!chunks[picked[0]].opensSentence) parts.unshift("[...] ");

  return {
    text: parts.join("").trim(),
    sampled: true,
    kept: picked.length,
    total: chunks.length,
  };
}
