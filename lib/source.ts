export const MIN_SOURCE_CHARS = 200;

export const MAX_SOURCE_CHARS = 100_000;

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

type Signals = {
  avgWordLength: number;
  commonRatio: number;
  distinctCommon: number;
  singleCharRatio: number;
  repeatedCharRatio: number;
  vowelRatio: number;
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

export type SourceStatus =
  | { state: "empty" }
  | { state: "short"; chars: number; progress: number }
  | { state: "too-long"; chars: number }
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
