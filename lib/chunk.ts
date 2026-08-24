const CHUNK_CHARS = 1200;

export const PROMPT_BUDGET_CHARS = 12_000;

export type Chunk = {
  text: string;
  opensSentence: boolean;
  closesSentence: boolean;
};

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
  text: string;
  sampled: boolean;
  kept: number;
  total: number;
};

export function sampleForPrompt(source: string, budget = PROMPT_BUDGET_CHARS): Sampled {
  const trimmed = source.trim();
  const chunks = chunkSource(trimmed);

  if (trimmed.length <= budget || chunks.length <= 1) {
    return { text: trimmed, sampled: false, kept: chunks.length, total: chunks.length };
  }

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

  const parts: string[] = [];
  let previous = -1;
  for (const index of picked) {
    const chunk = chunks[index];

    if (previous === -1) {
      parts.push(chunk.text);
    } else if (index > previous + 1) {
      parts.push("\n\n[...]\n\n", chunk.text);
    } else if (!chunks[previous].closesSentence && !chunk.opensSentence) {
      parts.push(chunk.text.startsWith(" ") ? chunk.text : ` ${chunk.text}`);
    } else {
      parts.push("\n\n", chunk.text);
    }
    previous = index;
  }
  if (previous < chunks.length - 1) parts.push("\n\n[...]");

  if (!chunks[picked[0]].opensSentence) parts.unshift("[...] ");

  return {
    text: parts.join("").trim(),
    sampled: true,
    kept: picked.length,
    total: chunks.length,
  };
}
