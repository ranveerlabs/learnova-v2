export const MIN_SOURCE_CHARS = 200;
export const MAX_SOURCE_CHARS = 100_000;

// the glue words real prose can't avoid
const COMMON = new Set([
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

const VOWEL = new Set(["a", "e", "i", "o", "u"]);

const words = (s: string) => s.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? [];

type Sig = {
  len: number;
  common: number;
  distinct: number;
  singles: number;
  runs: number;
  vowels: number;
  latin: number;
};

function measure(src: string): Sig {
  const w = words(src);
  const n = w.length || 1;

  let lenSum = 0, single = 0, hits = 0;
  const seen = new Set<string>();

  for (const x of w) {
    lenSum += x.length;
    if (x.length === 1) single++;
    if (COMMON.has(x)) {
      hits++;
      seen.add(x);
    }
  }

  let letters = 0, latin = 0, vow = 0, rep = 0;

  for (const x of w) {
    let prev = "";
    for (const c of x) {
      if (!/\p{L}/u.test(c)) continue;
      letters++;
      if (c >= "a" && c <= "z") latin++;
      if (VOWEL.has(c)) vow++;
      if (c === prev) rep++;
      prev = c;
    }
  }

  const lb = letters || 1;

  return {
    len: lenSum / n,
    common: hits / n,
    distinct: seen.size,
    singles: single / n,
    runs: rep / lb,
    vowels: vow / lb,
    latin: latin / lb,
  };
}

function junk(src: string): string[] {
  const s = measure(src);
  const eng = s.latin >= 0.6;
  const why: string[] = [];

  if (s.len < 3) why.push("the words are far too short to be prose");
  if (eng && s.common < 0.06 && s.distinct < 4)
    why.push("almost none of the everyday words that hold sentences together appear");
  if (eng && s.vowels < 0.26) why.push("the letters do not fall the way they do in real words");
  if (s.runs > 0.15) why.push("there are long runs of the same character");
  if (s.singles > 0.35) why.push("most of it is loose single letters rather than words");

  return why;
}

export type SourceStatus =
  | { state: "empty" }
  | { state: "short"; chars: number; progress: number }
  | { state: "too-long"; chars: number }
  | { state: "unreadable"; chars: number; reasons: string[] }
  | { state: "ready"; chars: number };

export function sourceStatus(src: string): SourceStatus {
  const t = src.trim();
  if (!t) return { state: "empty" };

  const chars = t.length;
  if (chars < MIN_SOURCE_CHARS) return { state: "short", chars, progress: chars / MIN_SOURCE_CHARS };
  if (chars > MAX_SOURCE_CHARS) return { state: "too-long", chars };

  // one bad signal is noise, two is not prose
  const why = junk(t);
  if (why.length >= 2) return { state: "unreadable", chars, reasons: why.slice(0, 2) };

  return { state: "ready", chars };
}

export function sourceProblem(src: string): string | null {
  const s = sourceStatus(src);

  switch (s.state) {
    case "ready":
      return null;
    case "empty":
      return "Paste some source material first: notes, a passage, anything you are studying from.";
    case "short":
      return `Too short to pull real concepts from: ${s.chars} characters of the ${MIN_SOURCE_CHARS} needed. Paste the actual notes or passage, a paragraph or more, in the source's own words. Any shorter and the concepts get invented rather than found.`;
    case "too-long":
      return `More material than one session can work through: ${s.chars.toLocaleString()} characters against a ceiling of ${MAX_SOURCE_CHARS.toLocaleString()}. Paste the chapter or section you are actually studying. A long passage is fine and gets spread across the run; a whole book would mostly go untested.`;
    case "unreadable":
      return `That does not read like study material: ${s.reasons.join(", and ")}. Paste the actual notes or passage you are studying. Learnova can only test you on ideas genuinely in the text, so on this it would invent them.`;
  }
}
