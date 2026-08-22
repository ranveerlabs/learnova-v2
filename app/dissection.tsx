"use client";

import { useMemo } from "react";
import type { Annotation } from "./api/grade/route";
import { Label } from "./ui";

/* ═══ The apparatus ═══════════════════════════════════════════════════════
   The student's explanation, set in the reading face and marked in place.
   Flagged spans carry a siglum that keys to a note in the margin; each note
   attests what the source actually says, verbatim.

   Colour is one of three channels and never the only one: every mark also
   has its own underline shape, and every note names its kind in words.

   The pieces are exported separately so the page can run the notes down the
   whole margin rather than only alongside the text block. */

type Flagged = Exclude<Annotation["type"], "right">;

const NARROW: React.CSSProperties = { fontVariationSettings: '"wdth" 88' };

const MARK_CLASS: Record<Annotation["type"], string> = {
  right: "mk mk-solid",
  imprecise: "mk mk-shaky px-0.5",
  wrong: "mk mk-broken px-0.5",
};

const NOTE_KIND: Record<Flagged, { word: string; mark: string; ink: string; tint: string }> = {
  imprecise: {
    word: "Imprecise",
    mark: "var(--shaky-mark)",
    ink: "var(--shaky-ink)",
    tint: "var(--shaky-tint)",
  },
  wrong: {
    word: "Contradicts the source",
    mark: "var(--broken-mark)",
    ink: "var(--broken-ink)",
    tint: "var(--broken-tint)",
  },
};

/** What a "wrong" mark is allowed to call itself.

    "Contradicts the source" is a true sentence in a grounded session and a
    false one everywhere else, and it was being printed in both. In a
    topic-only session there is no source: the student pasted nothing, the
    grader is told in as many words that there is nothing to quote, and the
    server blanks every citation on the way out. The screen went on saying
    "Contradicts the source" anyway, over a heading that reads "The notes",
    which names a document that does not exist and attributes the model's own
    opinion to it.

    That is not a missing disclaimer, it is the app asserting a check it never
    ran, in the one place a student is most likely to defer to it. Somebody who
    knew that Tritoflex is sprayed on cold wrote exactly that, and was told it
    contradicted a source. There was no source. There was a model that had the
    fact wrong, and an interface that dressed it up as an authority.

    So the mark says who is actually disagreeing. */
function wrongWord(grounded: boolean): string {
  return grounded ? NOTE_KIND.wrong.word : "Model disagrees";
}

export type Segment =
  | { kind: "text"; value: string }
  | { kind: "mark"; value: string; id: number; type: Annotation["type"]; n?: number };

export type Card = {
  id: number;
  n?: number;
  type: Flagged;
  quote: string;
  comment: string;
  sourceQuote: string;
};

/** Straight-quote curly punctuation without changing string length, so match
    positions stay valid against the original text. */
function normalize(s: string): string {
  return s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
}

function overlaps(s: number, e: number, taken: [number, number][]): boolean {
  return taken.some(([a, b]) => s < b && e > a);
}

function findRange(
  normText: string,
  normQuote: string,
  taken: [number, number][]
): { start: number; end: number } | null {
  if (!normQuote) return null;
  // Exact match first.
  for (let from = 0; ; ) {
    const i = normText.indexOf(normQuote, from);
    if (i < 0) break;
    const e = i + normQuote.length;
    if (!overlaps(i, e, taken)) return { start: i, end: e };
    from = i + 1;
  }
  // Whitespace-tolerant fallback (model may re-flow whitespace in the quote).
  const escaped = normQuote.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  let re: RegExp;
  try {
    re = new RegExp(escaped, "gi");
  } catch {
    return null;
  }
  let m: RegExpExecArray | null;
  while ((m = re.exec(normText))) {
    const e = m.index + m[0].length;
    if (!overlaps(m.index, e, taken)) return { start: m.index, end: e };
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return null;
}

export function buildDissection(
  text: string,
  annotations: Annotation[]
): { segments: Segment[]; cards: Card[] } {
  const normText = normalize(text);
  const taken: [number, number][] = [];
  const matched: {
    start: number;
    end: number;
    type: Annotation["type"];
    comment: string;
    sourceQuote: string;
    id: number;
  }[] = [];
  const unmatched: Card[] = [];

  annotations.forEach((ann, id) => {
    const quote = ann.quote.trim();
    const range = quote ? findRange(normText, normalize(quote), taken) : null;
    if (range) {
      taken.push([range.start, range.end]);
      matched.push({
        ...range,
        type: ann.type,
        comment: ann.comment,
        sourceQuote: ann.sourceQuote,
        id,
      });
    } else if (ann.type !== "right") {
      // Couldn't locate it, so keep it as a note and no feedback is silently lost.
      unmatched.push({
        id,
        type: ann.type,
        quote: ann.quote,
        comment: ann.comment,
        sourceQuote: ann.sourceQuote,
      });
    }
  });

  matched.sort((a, b) => a.start - b.start);

  // Number the flagged spans in reading order: the sigla key text to notes.
  let counter = 0;
  const numById = new Map<number, number>();
  for (const m of matched) if (m.type !== "right") numById.set(m.id, ++counter);

  const segments: Segment[] = [];
  let cursor = 0;
  for (const m of matched) {
    if (m.start > cursor) segments.push({ kind: "text", value: text.slice(cursor, m.start) });
    segments.push({
      kind: "mark",
      value: text.slice(m.start, m.end),
      id: m.id,
      type: m.type,
      n: numById.get(m.id),
    });
    cursor = m.end;
  }
  if (cursor < text.length) segments.push({ kind: "text", value: text.slice(cursor) });

  const cards: Card[] = [];
  for (const m of matched) {
    if (m.type === "right") continue;
    cards.push({
      id: m.id,
      n: numById.get(m.id),
      type: m.type,
      quote: text.slice(m.start, m.end),
      comment: m.comment,
      sourceQuote: m.sourceQuote,
    });
  }
  cards.push(...unmatched);

  return { segments, cards };
}

export function useDissection(text: string, annotations: Annotation[]) {
  return useMemo(() => buildDissection(text, annotations), [text, annotations]);
}

/** The student's own words, marked. Left plain rather than ruled: the marks
    are the reason to look at this block, and ruling fights the underlines. */
export function MarkedUpText({
  segments,
  cards,
  active,
  setActive,
  grounded,
}: {
  segments: Segment[];
  cards: Card[];
  active: number | null;
  setActive: (id: number | null) => void;
  /** Whether these marks were made against material the student pasted. Only
      a grounded session may describe a mark as contradicting a source. */
  grounded: boolean;
}) {
  const hasSolid = segments.some((s) => s.kind === "mark" && s.type === "right");
  const kinds = Array.from(new Set(cards.map((c) => c.type)));

  /* Marks ink in one after another, in reading order, so the position in the
     sequence has to be counted over marks alone, not over every segment. */
  let markNo = -1;

  return (
    <figure className="m-0 flex min-w-0 flex-col gap-3">
      <figcaption className="flex items-baseline justify-between gap-4">
        <Label>Your explanation, marked up</Label>
        {cards.length > 0 && (
          <span className="font-mono text-[0.6875rem] tabular-nums text-ink-faint">
            {cards.length} {cards.length === 1 ? "note" : "notes"}
          </span>
        )}
      </figcaption>

      <div className="prose-read whitespace-pre-wrap rounded-[3px] border border-line bg-page px-6 py-5 text-ink">
        {segments.map((seg, i) => {
          if (seg.kind === "text") return <span key={i}>{seg.value}</span>;

          markNo += 1;
          const step = { ["--i" as string]: markNo };

          if (seg.type === "right") {
            return (
              <span key={i} style={step} className={`${MARK_CLASS.right} ink-in`}>
                {seg.value}
              </span>
            );
          }

          /* A siglum is a reference to its note, so it is a link, which is
             also the only inline-wrapping control available: Chrome coerces
             <button> to inline-block, which would stop a long marked phrase
             from breaking across lines. */
          return (
            <a
              key={i}
              href={`#note-${seg.id}`}
              aria-label={`${NOTE_KIND[seg.type].word}: “${seg.value}”. Go to note ${seg.n}.`}
              onMouseEnter={() => setActive(seg.id)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(seg.id)}
              onBlur={() => setActive(null)}
              style={{ ...step, color: NOTE_KIND[seg.type].ink }}
              className={`${MARK_CLASS[seg.type]} ink-in cursor-pointer ${
                active === seg.id ? "mk-linked" : ""
              }`}
            >
              <span className="text-ink">{seg.value}</span>
              {seg.n !== undefined && (
                <sup style={step} className="siglum-in ml-px font-mono text-[0.625rem] font-semibold">
                  {seg.n}
                </sup>
              )}
            </a>
          );
        })}
      </div>

      <MarkKey hasSolid={hasSolid} kinds={kinds} grounded={grounded} />
    </figure>
  );
}

/** Key to the apparatus. States what each underline means, so the marks are
    readable before the reader has hovered anything, and without colour. */
function MarkKey({
  hasSolid,
  kinds,
  grounded,
}: {
  hasSolid: boolean;
  kinds: Flagged[];
  grounded: boolean;
}) {
  const entries = [
    ...(hasSolid ? [{ cls: "mk mk-solid", word: "Holds up" }] : []),
    ...kinds.map((k) => ({
      cls: MARK_CLASS[k],
      word: k === "wrong" ? wrongWord(grounded) : NOTE_KIND[k].word,
    })),
  ];
  if (entries.length === 0) return null;
  return (
    <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1">
      {entries.map((e) => (
        <li key={e.word} className="font-sans text-[0.75rem] text-ink-soft">
          <span className={`${e.cls} font-read text-[0.9375rem] text-ink`}>Aa</span>
          <span className="ml-2">{e.word}</span>
        </li>
      ))}
    </ul>
  );
}

/** The margin. Each note is keyed to its siglum and attests the source. */
export function MarginNotes({
  cards,
  active,
  setActive,
  grounded,
}: {
  cards: Card[];
  active: number | null;
  setActive: (id: number | null) => void;
  /** See MarkedUpText. Decides whether a "wrong" mark may claim a source. */
  grounded: boolean;
}) {
  if (cards.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <Label className="xl:hidden">The notes</Label>
      <ol className="flex flex-col gap-3">
        {cards.map((card, i) => {
          const kind = NOTE_KIND[card.type];
          const on = active === card.id;
          return (
            <li
              key={card.id}
              id={`note-${card.id}`}
              className="note-in scroll-mt-24"
              style={{ ["--i" as string]: i }}
              onMouseEnter={() => setActive(card.id)}
              onMouseLeave={() => setActive(null)}
            >
              <div
                className="lift rounded-[3px] border-l-[3px] py-3 pl-3.5 pr-3.5"
                style={{
                  borderLeftColor: kind.mark,
                  background: on ? kind.tint : "var(--sunk)",
                }}
              >
                <div className="flex items-baseline gap-2">
                  {card.n !== undefined && (
                    <span
                      className="font-mono text-[0.6875rem] font-semibold tabular-nums"
                      style={{ color: kind.ink }}
                    >
                      {card.n}
                    </span>
                  )}
                  <span
                    style={{ ...NARROW, color: kind.ink }}
                    className="font-sans text-[0.625rem] font-semibold uppercase tracking-[0.12em]"
                  >
                    {card.type === "wrong" ? wrongWord(grounded) : kind.word}
                  </span>
                </div>

                {/* Only when there is something to quote.

                    The grader's quote is checked against the explanation
                    server-side and blanked when it is not actually in there,
                    so this can arrive empty. Printed anyway it became a pair
                    of quotation marks around nothing, which reads as the app
                    having lost the student's words rather than as the model
                    having never had them. The comment below carries the note
                    on its own. */}
                {card.quote && (
                  <p className="mt-1.5 font-read text-[0.9375rem] leading-[1.55] text-ink">
                    <span className={MARK_CLASS[card.type]}>“{card.quote}”</span>
                  </p>
                )}

                {card.sourceQuote && (
                  <p className="mt-2.5 font-read text-[0.9375rem] leading-[1.55] text-ink-soft">
                    <span
                      style={NARROW}
                      className="mr-1.5 font-sans text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-ink-faint"
                    >
                      Source
                    </span>
                    <span className="italic">“{card.sourceQuote}”</span>
                  </p>
                )}

                {card.comment && (
                  <p className="mt-2.5 font-sans text-[0.8125rem] leading-[1.55] text-ink-soft">
                    {card.comment}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
