/* Finding the cited spans inside the source, so they can be marked in it.

   The point of drawing this at all is that it needs no trust. A page can say
   "every question was checked against the source" and a reader has to take
   that on faith; a page that lights up the exact words in the exact paragraph
   has handed them the means to check it themselves, which is the only version
   of the claim worth making on a page about not being taken on faith.

   Matching is the same shape as the server's: compare with whitespace
   collapsed and quotes straightened, so a citation that differs from the
   source only in how it was spaced still lands. Anything that cannot be found
   is simply not marked. This never invents a position to make the picture
   tidier, because an unfindable citation is exactly the thing the server
   already dropped and the interesting case if one ever reaches here. */

export type Piece = { text: string; cited: boolean; n?: number };

/** Straighten quotes without changing length, so offsets stay valid against
    the original text. Same trick as the marking apparatus in dissection.ts. */
function straighten(s: string): string {
  return s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
}

/** Where `quote` sits in `source`, allowing for differences in whitespace.

    Walks the source a character at a time against the quote, skipping runs of
    whitespace on both sides. Returns the half-open range in the ORIGINAL
    string, which is what lets the caller slice it without the text shifting. */
function locate(source: string, quote: string, from: number): [number, number] | null {
  const hay = straighten(source).toLowerCase();
  const needle = straighten(quote).toLowerCase().trim();
  if (!needle) return null;

  for (let start = from; start < hay.length; start++) {
    let i = start;
    let j = 0;

    while (i < hay.length && j < needle.length) {
      const a = hay[i];
      const b = needle[j];

      if (/\s/.test(a) && /\s/.test(b)) {
        while (i < hay.length && /\s/.test(hay[i])) i++;
        while (j < needle.length && /\s/.test(needle[j])) j++;
        continue;
      }
      /* Whitespace in the source where the quote has none is allowed to be
         skipped only if the quote has already matched something, so a match
         cannot begin by swallowing the space in front of it. */
      if (a !== b) break;
      i++;
      j++;
    }

    if (j >= needle.length) return [start, i];
  }
  return null;
}

/** The source, split into cited and uncited runs.

    Citations are numbered in the order they appear in the text rather than the
    order they were given, so the marks read down the paragraph the way a
    person reads it. Overlaps are dropped rather than nested: two questions
    citing the same sentence is one highlight, not a highlight inside another. */
export function markSource(source: string, quotes: string[]): Piece[] {
  const found: { start: number; end: number }[] = [];

  for (const quote of quotes) {
    const at = locate(source, quote, 0);
    if (!at) continue;
    const [start, end] = at;
    if (found.some((r) => start < r.end && end > r.start)) continue;
    found.push({ start, end });
  }

  found.sort((a, b) => a.start - b.start);

  const pieces: Piece[] = [];
  let cursor = 0;
  found.forEach((range, i) => {
    if (range.start > cursor) {
      pieces.push({ text: source.slice(cursor, range.start), cited: false });
    }
    pieces.push({ text: source.slice(range.start, range.end), cited: true, n: i + 1 });
    cursor = range.end;
  });
  if (cursor < source.length) pieces.push({ text: source.slice(cursor), cited: false });

  return pieces;
}
