/* What counts as material worth reading.

   A session is only honest if there was something in the source to extract.
   Given a word or two, or a handful of mashed keys, the model will still
   return "concepts": plausible, fluent, and about nothing the student
   pasted. So the floor is enforced before any request is made, and again on
   the route, and it is stated in the interface rather than sprung as an
   error.

   Two gates, in order of cost. Length comes first because it is exact. Then
   substance, which asks whether the characters look like prose at all.

   Length is one number on purpose. There used to be a word floor beside it,
   and two floors where clearing one still blocks you is just confusing: real
   notes cleared 40 words by a margin of zero while the character count was
   never in doubt. Characters subsume the job anyway, since the substance
   check is what actually catches 200 characters of nonsense. */

/** About a paragraph. Below this there is nothing to extract concepts from. */
export const MIN_SOURCE_CHARS = 200;

/** And a ceiling, for the opposite reason.

    Material longer than a prompt can hold is thinned to an even spread of
    itself before it reaches the model, so length is not by itself a problem
    and most of a long chapter is handled. This is where that stops being
    worth doing: past it, the paste is mostly text that will be sampled out,
    and the whole of it would still cross the wire on each of the four calls
    a run makes.

    Stated here, in the same place as the floor and for the same reason. The
    route enforces it too, but a limit a student only meets as a failed
    request is a limit the interface never told them about. */
export const MAX_SOURCE_CHARS = 100_000;

/* The everyday words that hold English sentences together. Real prose is
   roughly a third function words; keyboard mash has almost none. The list is
   deliberately short and dull: it is a signal of grammar, not of vocabulary,
   so adding topic words would only weaken it. */
const COMMON_WORDS = new Set([
  "a", "about", "after", "all", "also", "an", "and", "any", "are", "as", "at",
  "be", "because", "been", "before", "being", "between", "both", "but", "by",
  "can", "could", "did", "do", "does", "each", "for", "from", "had", "has",
  "have", "how", "however", "if", "in", "into", "is", "it", "its", "just",
  "like", "may", "more", "most", "much", "must", "no", "not", "of", "on",
  "one", "only", "or", "other", "our", "out", "over", "should", "since", "so",
  "some", "such", "than", "that", "the", "their", "them", "then", "there",
  "these", "they", "this", "those", "through", "to", "two", "under", "up",
  "use", "used", "was", "we", "well", "were", "what", "when", "where",
  "which", "while", "who", "why", "will", "with", "within", "would", "you",
  "your",
]);

const VOWELS = new Set(["a", "e", "i", "o", "u"]);

function tokenize(source: string): string[] {
  return source.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? [];
}

export function countWords(source: string): number {
  return tokenize(source).length;
}

type Signals = {
  /** Mean token length. English prose runs near 4.7; mashed keys near 1. */
  avgWordLength: number;
  /** Share of tokens that are everyday English words. */
  commonRatio: number;
  /** How many distinct everyday words appear at all. */
  distinctCommon: number;
  /** Share of tokens that are a single character. */
  singleCharRatio: number;
  /** Share of letters that immediately repeat the letter before them. */
  repeatedCharRatio: number;
  /** Share of letters that are vowels. English runs near 0.38. */
  vowelRatio: number;
  /** Share of letters that are a to z, used to tell whether the English
      specific signals mean anything for this text at all. */
  latinRatio: number;
};

function measure(source: string): Signals {
  const words = tokenize(source);
  const total = words.length || 1;

  let lengthSum = 0;
  let singles = 0;
  let commonHits = 0;
  const seenCommon = new Set<string>();

  for (const word of words) {
    lengthSum += word.length;
    if (word.length === 1) singles++;
    if (COMMON_WORDS.has(word)) {
      commonHits++;
      seenCommon.add(word);
    }
  }

  /* Repeats and vowels are counted over letters within words, so spacing and
     punctuation cannot dilute either ratio. */
  let letters = 0;
  let latin = 0;
  let vowels = 0;
  let repeats = 0;

  for (const word of words) {
    let prev = "";
    for (const ch of word) {
      if (!/\p{L}/u.test(ch)) continue;
      letters++;
      if (ch >= "a" && ch <= "z") latin++;
      if (VOWELS.has(ch)) vowels++;
      if (ch === prev) repeats++;
      prev = ch;
    }
  }

  const letterBase = letters || 1;

  return {
    avgWordLength: lengthSum / total,
    commonRatio: commonHits / total,
    distinctCommon: seenCommon.size,
    singleCharRatio: singles / total,
    repeatedCharRatio: repeats / letterBase,
    vowelRatio: vowels / letterBase,
    latinRatio: latin / letterBase,
  };
}

/* Any one signal can misfire on legitimate material: telegraphic bullet notes
   carry almost no function words, a formula list carries almost no vowels. So
   nothing is rejected on a single signal. Two independent failures is the bar,
   and mashed keys trip four. */
function substanceFailures(source: string): string[] {
  const s = measure(source);
  const english = s.latinRatio >= 0.6;
  const reasons: string[] = [];

  if (s.avgWordLength < 3) {
    reasons.push("the words are far too short to be prose");
  }
  if (english && s.commonRatio < 0.06 && s.distinctCommon < 4) {
    reasons.push("almost none of the everyday words that hold sentences together appear");
  }
  if (english && s.vowelRatio < 0.26) {
    reasons.push("the letters do not fall the way they do in real words");
  }
  if (s.repeatedCharRatio > 0.15) {
    reasons.push("there are long runs of the same character");
  }
  if (s.singleCharRatio > 0.35) {
    reasons.push("most of it is loose single letters rather than words");
  }

  return reasons;
}

/* Everything the interface needs to describe where a source stands, decided
   in exactly one place. The gauge, the button and the route all read this, so
   none of them can advertise a threshold that is not the real one. */
export type SourceStatus =
  | { state: "empty" }
  /** Short of the character floor. `progress` runs 0 to 1 toward it. */
  | { state: "short"; chars: number; progress: number }
  /** Past the ceiling. More material than one session can work through. */
  | { state: "too-long"; chars: number }
  /** Long enough, but it does not read like prose. */
  | { state: "unreadable"; chars: number; reasons: string[] }
  | { state: "ready"; chars: number };

export function sourceStatus(source: string): SourceStatus {
  const trimmed = source.trim();
  if (!trimmed) return { state: "empty" };

  const chars = trimmed.length;
  if (chars < MIN_SOURCE_CHARS) {
    return { state: "short", chars, progress: chars / MIN_SOURCE_CHARS };
  }
  if (chars > MAX_SOURCE_CHARS) {
    return { state: "too-long", chars };
  }

  const reasons = substanceFailures(trimmed);
  if (reasons.length >= 2) {
    return { state: "unreadable", chars, reasons: reasons.slice(0, 2) };
  }

  return { state: "ready", chars };
}

/** The reason this source cannot start a session, or null if it can. */
export function sourceProblem(source: string): string | null {
  const status = sourceStatus(source);

  switch (status.state) {
    case "ready":
      return null;

    case "empty":
      return "Paste some source material first: notes, a passage, anything you are studying from.";

    case "short":
      return `That is too short to pull real concepts from: ${status.chars} characters of the ${MIN_SOURCE_CHARS} needed. Paste the actual notes or passage you are studying, a paragraph or more, in the source's own words. Anything shorter and the concepts would be invented rather than found.`;

    case "too-long":
      return `That is more material than one session can work through: ${status.chars.toLocaleString()} characters against a ceiling of ${MAX_SOURCE_CHARS.toLocaleString()}. Paste the chapter or section you are actually studying. A long passage is fine and gets spread across the run; a whole book would mostly go untested.`;

    case "unreadable":
      return `That does not read like study material: ${status.reasons.join(
        ", and "
      )}. Paste the actual notes or passage you are studying. Learnova can only test you on ideas that are genuinely in the text, so on this it would invent them.`;
  }
}

/** Whether this source can start a session. The same test as a predicate, so
    the gauge in the interface and the guard can never disagree. */
export function sourceIsReady(source: string): boolean {
  return sourceStatus(source).state === "ready";
}
