// takes the model voice back off a speech, mid stream

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

// "[Rebuttal]", "**Con Constructive**"
const LABEL_LINE =
  /^\s*\**\[?\s*(?:(?:pro|con|aff|neg|affirmative|negative|second|2nd)\s+)?(?:constructive|rebuttal|summary|final focus|crossfire|speech)\s*\]?\s*:?\s*\**\s*$/i;

// "(pauses)", "[turns to judge]"
const DIRECTION_LINE = /^\s*[[(*_].{0,80}[\])*_]\s*$/;

// same label, running into the first sentence
const LABEL_PREFIX =
  /^\s*(?:(?:pro|con|aff|neg|affirmative|negative)\s+)?(?:constructive|rebuttal|summary|final focus|speech)\s*[:.\-]\s+/i;

const FLIP: Record<string, string> = {
  "is not": "is",
  isnt: "is",
  "are not": "are",
  arent: "are",
  s: "'s",
  re: "'re",
};

// "it isn't x, it's y" -> "it's y"
const CONTRAST =
  /(\bis\s+not\b|\bisn['’]t\b|\bare\s+not\b|\baren['’]t\b|['’]s\s+not\b|['’]re\s+not\b)\s+(?:just\s+|only\s+|merely\s+|simply\s+)?[^,;:.!?]{1,70},\s*(?:it|they|that|this|these|those)(?:['’]s|['’]re|\s+is|\s+are)\s+/gi;

function verbFor(neg: string): string {
  const b = neg.toLowerCase().replace(/['’]/g, "");
  if (b.startsWith("isn")) return FLIP.isnt;
  if (b.startsWith("aren")) return FLIP.arent;
  if (b.startsWith("is")) return FLIP["is not"];
  if (b.startsWith("are")) return FLIP["are not"];
  if (b.startsWith("s")) return FLIP.s;
  return FLIP.re;
}

const WC = /[([{]\s*(?:approx\.?\s*|~\s*)?\d+\s*words?\s*[)\]}]\s*$/i;
const WC_ONLY = /^\s*[([{]?\s*(?:approx\.?\s*|~\s*)?\d+\s*words?\s*[)\]}]?\s*$/i;

const UNIT_END = /[.!?]["')\]]?(?=\s)|\n/;
const ENUM = /^\s*(?:\d{1,3}|[a-z])[.)](?=\s)/i;

// the stop in "1." is not the end of a sentence
const isMarker = (u: string) => /^\s*(?:\d{1,3}|[a-z])[.)]$/i.test(u.slice(u.lastIndexOf("\n") + 1));

const nwords = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

function clean(unit: string, first: boolean): string {
  let t = unit.trim();
  if (!t) return "";

  // whole unit is heading, theatre or bookkeeping
  if (LABEL_LINE.test(t) || DIRECTION_LINE.test(t) || WC_ONLY.test(t)) return "";

  t = t.replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/i, "");
  t = t.replace(/^#{1,6}\s+/, "");
  t = t.replace(/^\s*[-*•]\s+/, "");

  // nothing renders markdown here, so bold arrives as asterisks
  t = t.replace(/\*\*([^*]+)\*\*/g, "$1");
  t = t.replace(/(?<![*\w])\*([^*\n]+)\*(?![*\w])/g, "$1");

  if (first) {
    const off = t.replace(LABEL_PREFIX, "");
    if (off !== t) t = off.charAt(0).toUpperCase() + off.slice(1);
  }

  t = t.replace(WC, "");

  // em dashes. biggest tell there is
  t = t.replace(/\s*—\s*/g, ", ");

  t = t.replace(LEAD_IN, (_m, pre: string, next: string) => pre + next.toUpperCase());
  t = t.replace(CONTRAST, (_m, neg: string) => `${verbFor(neg)} `);

  return t.replace(/\s+/g, " ").trim();
}

export type SpeechFilter = {
  push(chunk: string): string;
  end(): string;
  finished(): boolean;
};

export function createSpeechFilter(cap: number): SpeechFilter {
  const max = Math.round(cap * 1.35);

  let buf = "";
  let n = 0;
  let first = true;
  let done = false;
  let gap = -1;

  const sep = (t: string) => {
    if (gap < 0) return "";
    if (gap >= 2) return "\n\n";
    return gap === 1 && ENUM.test(t) ? "\n" : " ";
  };

  function take(unit: string, breaks: number): string {
    if (done) return "";

    const t = clean(unit, first);
    if (!t) return "";

    const out = sep(t) + t;
    first = false;
    gap = breaks;
    n += nwords(t);
    if (n >= max) done = true;
    return out;
  }

  function drain(final: boolean): string {
    let out = "";

    while (!done) {
      let at = -1;
      // search from an offset, a list marker is not a stop
      for (let from = 0; ; ) {
        const rel = buf.slice(from).search(UNIT_END);
        if (rel === -1) break;
        const hit = from + rel;
        if (buf[hit] !== "\n" && isMarker(buf.slice(0, hit + 1))) {
          from = hit + 1;
          continue;
        }
        at = hit;
        break;
      }
      if (at === -1) break;

      const nl = buf[at] === "\n";
      const cut = nl ? at : at + 1;
      const unit = buf.slice(0, cut);

      const rest = buf.slice(cut);
      const ws = rest.match(/^\s*/)?.[0] ?? "";

      // the whitespace run may still be arriving, wait for it
      if (!final && ws.length === rest.length) break;

      buf = rest.slice(ws.length);
      out += take(unit, ws.match(/\n/g)?.length ?? 0);
    }

    return out;
  }

  return {
    push(chunk) {
      if (done) return "";
      buf += chunk;
      return drain(false);
    },
    end() {
      if (done) return "";
      const out = drain(true);
      const last = buf;
      buf = "";
      return out + take(last, 0);
    },
    finished: () => done,
  };
}
