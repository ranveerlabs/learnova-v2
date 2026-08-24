const LEAD_INS = [
  "Firstly",
  "First of all",
  "Secondly",
  "Thirdly",
  "Moreover",
  "Furthermore",
  "Additionally",
  "In addition",
  "In conclusion",
  "To conclude",
  "Ultimately",
  "That said",
  "Importantly",
  "Crucially",
  "Notably",
  "Indeed",
  "Overall",
  "In summary",
  "To summarise",
  "To summarize",
  "It is important to note that",
  "It's important to note that",
];

const LEAD_IN = new RegExp(
  `(^|[.!?]["')\\]]?\\s+|\\n)(?:${LEAD_INS.join("|")})\\b\\s*[,:]?\\s*(.)`,
  "gi"
);

const LABEL_LINE =
  /^\s*\**\[?\s*(?:(?:pro|con|aff|neg|affirmative|negative|second|2nd)\s+)?(?:constructive|rebuttal|summary|final focus|crossfire|speech)\s*\]?\s*:?\s*\**\s*$/i;

const DIRECTION_LINE = /^\s*[[(*_].{0,80}[\])*_]\s*$/;

const LABEL_PREFIX =
  /^\s*(?:(?:pro|con|aff|neg|affirmative|negative)\s+)?(?:constructive|rebuttal|summary|final focus|speech)\s*[:.\-]\s+/i;

const FLIP_VERB: Record<string, string> = {
  "is not": "is",
  isnt: "is",
  "are not": "are",
  arent: "are",
  s: "'s",
  re: "'re",
};

const CONTRAST_FLIP =
  /(\bis\s+not\b|\bisn['’]t\b|\bare\s+not\b|\baren['’]t\b|['’]s\s+not\b|['’]re\s+not\b)\s+(?:just\s+|only\s+|merely\s+|simply\s+)?[^,;:.!?]{1,70},\s*(?:it|they|that|this|these|those)(?:['’]s|['’]re|\s+is|\s+are)\s+/gi;

function keptVerb(negation: string): string {
  const bare = negation.toLowerCase().replace(/['’]/g, "");
  if (bare.startsWith("isn")) return FLIP_VERB.isnt;
  if (bare.startsWith("aren")) return FLIP_VERB.arent;
  if (bare.startsWith("is")) return FLIP_VERB["is not"];
  if (bare.startsWith("are")) return FLIP_VERB["are not"];
  if (bare.startsWith("s")) return FLIP_VERB.s;
  return FLIP_VERB.re;
}

const WORD_COUNT = /[([{]\s*(?:approx\.?\s*|~\s*)?\d+\s*words?\s*[)\]}]\s*$/i;
const WORD_COUNT_ONLY = /^\s*[([{]?\s*(?:approx\.?\s*|~\s*)?\d+\s*words?\s*[)\]}]?\s*$/i;

const UNIT_END = /[.!?]["')\]]?(?=\s)|\n/;

const ENUMERATOR = /^\s*(?:\d{1,3}|[a-z])[.)](?=\s)/i;

function isMarker(unit: string): boolean {
  const line = unit.slice(unit.lastIndexOf("\n") + 1);
  return /^\s*(?:\d{1,3}|[a-z])[.)]$/i.test(line);
}

function words(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function clean(unit: string, first: boolean): string {
  let text = unit.trim();
  if (!text) return "";

  if (LABEL_LINE.test(text) || DIRECTION_LINE.test(text) || WORD_COUNT_ONLY.test(text)) return "";

  text = text.replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/i, "");
  text = text.replace(/^#{1,6}\s+/, "");
  text = text.replace(/^\s*[-*•]\s+/, "");

  text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
  text = text.replace(/(?<![*\w])\*([^*\n]+)\*(?![*\w])/g, "$1");

  if (first) {
    const delabelled = text.replace(LABEL_PREFIX, "");
    if (delabelled !== text) text = delabelled.charAt(0).toUpperCase() + delabelled.slice(1);
  }

  text = text.replace(WORD_COUNT, "");

  // em dashes are the loudest tell there is
  text = text.replace(/\s*—\s*/g, ", ");

  text = text.replace(LEAD_IN, (_m, pre: string, next: string) => pre + next.toUpperCase());

  text = text.replace(CONTRAST_FLIP, (_m, negation: string) => `${keptVerb(negation)} `);

  return text.replace(/\s+/g, " ").trim();
}

export type SpeechFilter = {
  push(chunk: string): string;
  end(): string;
  finished(): boolean;
};

export function createSpeechFilter(cap: number): SpeechFilter {
  const limit = Math.round(cap * 1.35);

  let pending = "";
  let said = 0;
  let first = true;
  let stopped = false;
  let gap = -1;

  function take(unit: string, breaks: number): string {
    if (stopped) return "";

    const text = clean(unit, first);
    if (!text) return "";

    const out = separator(text) + text;
    first = false;
    gap = breaks;
    said += words(text);
    if (said >= limit) stopped = true;
    return out;
  }

  function separator(text: string): string {
    if (gap < 0) return "";
    if (gap >= 2) return "\n\n";
    return gap === 1 && ENUMERATOR.test(text) ? "\n" : " ";
  }

  function drain(final: boolean): string {
    let out = "";

    while (!stopped) {
      let at = -1;
      for (let from = 0; ; ) {
        const rel = pending.slice(from).search(UNIT_END);
        if (rel === -1) break;
        const found = from + rel;
        if (pending[found] !== "\n" && isMarker(pending.slice(0, found + 1))) {
          from = found + 1;
          continue;
        }
        at = found;
        break;
      }
      if (at === -1) break;

      const newline = pending[at] === "\n";
      const cut = newline ? at : at + 1;
      const unit = pending.slice(0, cut);

      const rest = pending.slice(cut);
      const space = rest.match(/^\s*/)?.[0] ?? "";

      if (!final && space.length === rest.length) break;

      pending = rest.slice(space.length);
      out += take(unit, space.match(/\n/g)?.length ?? 0);
    }

    return out;
  }

  return {
    push(chunk) {
      if (stopped) return "";
      pending += chunk;
      return drain(false);
    },
    end() {
      if (stopped) return "";
      const out = drain(true);
      const last = pending;
      pending = "";
      return out + take(last, 0);
    },
    finished() {
      return stopped;
    },
  };
}
