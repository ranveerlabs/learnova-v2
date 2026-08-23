/* ── Cleaning up after the prompt ─────────────────────────────────────────
   Everything here is already asked for in VOICE, over in route.ts, and asking
   is not enough. A model told not to open a sentence with "Furthermore" opens
   one sentence in ten with "Furthermore", and told to stay under 110 words
   returns 190 often enough that it cannot be treated as a limit. The prompt
   sets the target; this is what makes it true.

   Its own file rather than another two hundred lines of route, because it is
   the one part of debate mode that is pure string in, string out, and that is
   worth being able to run on a sample without a key and a network.

   Nothing here rewrites an argument. It removes the packaging a model puts
   around one: the essay connectives, the markdown, the speech label at the
   top, the word count at the bottom, and the tail past the budget. What is
   left is what the model actually argued.

   ── Why it is a filter and not a function ────────────────────────────────
   It began as one pass over a finished speech, which was the right shape when
   the speech arrived all at once. It does not arrive all at once any more: the
   opponent streams, so the student reads the speech while the model is still
   writing it, and text that has already been read cannot be cleaned up
   afterwards without visibly rewriting itself on screen.

   So the unit of work is a sentence. Text accumulates until a sentence is
   complete, that sentence is cleaned, and only then does it go out. Every rule
   below is either sentence-scoped or line-scoped already, which is what makes
   this possible at all, and a sentence is also the honest granularity for a
   speech: a person speaking delivers phrases, not characters. Nobody wanted
   the typewriter effect.

   `scrub` still exists and is still the thing the tests drive. It is now the
   filter run over a whole string in one go, so there is exactly one set of
   rules and no chance of the streamed speech and the buffered one disagreeing
   about what a speech is allowed to look like. */

/** The connectives an essay runs on and a speech does not. Removed only where
    one opens a sentence, so "the argument is important to note in passing"
    survives and "Importantly, the argument" loses its first word. */
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

/** A line that is nothing but a heading: "[Rebuttal]", "**Con Constructive**",
    "Final Focus:". Matched before the markdown comes off, because once the
    asterisks are gone the line is indistinguishable from a two-word sentence
    that happens to have no full stop. */
const LABEL_LINE =
  /^\s*\**\[?\s*(?:(?:pro|con|aff|neg|affirmative|negative|second|2nd)\s+)?(?:constructive|rebuttal|summary|final focus|crossfire|speech)\s*\]?\s*:?\s*\**\s*$/i;

/** A stage direction on a line of its own: "(pauses)", "[turns to judge]".
    Bounded at eighty characters so a genuine parenthetical sentence, which is
    argument rather than theatre, is never mistaken for one. */
const DIRECTION_LINE = /^\s*[[(*_].{0,80}[\])*_]\s*$/;

/** The same heading, but running into the first sentence: "Summary: they
    dropped the framework." */
const LABEL_PREFIX =
  /^\s*(?:(?:pro|con|aff|neg|affirmative|negative)\s+)?(?:constructive|rebuttal|summary|final focus|speech)\s*[:.\-]\s+/i;

/* ── The contrast flip ────────────────────────────────────────────────────
   "Roblox isn't just another game, it's a platform where kids are the
   product." "That's not a feature, it's a loophole." Set a claim up by
   denying a different one, then land the real one after the comma.

   VOICE bans it in as many words and names five of its shapes, and it still
   arrived three times in one Summary, which is the whole reason this file
   exists: the prompt sets the target and this makes it true. It is the most
   recognisable thing a model does to a sentence after the em dash, and worse
   than the em dash, because a debater who copies it has learned a tic that a
   real judge will hear.

   What this removes is the negative half. "X isn't A, it's B" becomes "X is
   B", which is the same claim with the throat-clearing off the front: the
   argument was always B, and A was a thing nobody had said. The subject and
   its verb form are kept, so a plural subject stays plural and a contraction
   stays contracted.

   ── Why this is allowed to touch the words ───────────────────────────────
   The file's rule is that nothing here rewrites an argument, and this is the
   one rule that edits inside a sentence rather than dropping a whole unit.
   It stays inside the rule because the clause it removes carries no claim:
   it exists to be corrected by the clause after it, which is left exactly as
   the model wrote it. Nothing that was asserted stops being asserted.

   It is deliberately narrow. The negated part has to be short, has to have no
   punctuation in it, and has to be followed immediately by a pronoun picking
   the subject back up. "They dropped the framework, not the impact" is not
   matched and is not touched, because there the second half is the argument
   and cutting either half would change what was said. */

const FLIP_VERB: Record<string, string> = {
  "is not": "is",
  isnt: "is",
  "are not": "are",
  arent: "are",
  s: "'s",
  re: "'re",
};

/** The negation, the thing being denied, and the pronoun restarting the
    sentence. Bounded hard at both ends: this only fires on the shape it was
    written for. */
const CONTRAST_FLIP =
  /(\bis\s+not\b|\bisn['’]t\b|\bare\s+not\b|\baren['’]t\b|['’]s\s+not\b|['’]re\s+not\b)\s+(?:just\s+|only\s+|merely\s+|simply\s+)?[^,;:.!?]{1,70},\s*(?:it|they|that|this|these|those)(?:['’]s|['’]re|\s+is|\s+are)\s+/gi;

/** Which verb the kept half needs, read off whichever negation was used. */
function keptVerb(negation: string): string {
  const bare = negation.toLowerCase().replace(/['’]/g, "");
  if (bare.startsWith("isn")) return FLIP_VERB.isnt;
  if (bare.startsWith("aren")) return FLIP_VERB.arent;
  if (bare.startsWith("is")) return FLIP_VERB["is not"];
  if (bare.startsWith("are")) return FLIP_VERB["are not"];
  if (bare.startsWith("s")) return FLIP_VERB.s;
  return FLIP_VERB.re;
}

/* ── Why the third person is not fixed here ───────────────────────────────
   A reply is spoken to somebody standing there, and the model kept writing
   about them to a spectator who is not in the room: "they're saying kids can
   cash out", "my opponent's framework". VOICE bans it in as many words now,
   and one line of VOICE had been quietly teaching it — the signposting
   example read "on their jobs point", which is the habit in miniature.

   A rule was written here and taken out again, and what killed it is worth
   recording so nobody writes it a second time. Swapping the naming looks
   safe: "my opponent", "the opposition" and "the other side" can only mean
   the person across the table. But the words in front of them are conjugated
   for a third person, so "my opponent says" comes out as "you says". Fixing
   that means conjugating says, argues, claims, wants, has, is, was, doesn't,
   hasn't and the rest, which is rewriting the sentence rather than removing
   packaging, and a miss ships a broken sentence into a speech somebody is
   reading.

   The pronoun half is worse still. A debate is full of third parties who own
   "they" honestly — parents, players, a company, a government — and nothing
   here can tell "they're saying kids can cash out" from "they're spending
   their pocket money on it".

   So this one belongs to the prompt, which is the right owner anyway: the
   model knows which "they" it meant and a regex never will. */

/** The word count it was told not to write, alone or trailing. */
const WORD_COUNT = /[([{]\s*(?:approx\.?\s*|~\s*)?\d+\s*words?\s*[)\]}]\s*$/i;
const WORD_COUNT_ONLY = /^\s*[([{]?\s*(?:approx\.?\s*|~\s*)?\d+\s*words?\s*[)\]}]?\s*$/i;

/** Where a sentence ends: terminal punctuation, any closing quote or bracket
    riding on it, and then whitespace to prove the sentence is actually over
    rather than still arriving one token at a time.

    A newline counts too. It is how a heading or a stage direction on its own
    line becomes a unit this can throw away, and it is what keeps a paragraph
    break from waiting on the next full stop. */
const UNIT_END = /[.!?]["')\]]?(?=\s)|\n/;

/* ── The full stop in "1." is not the end of a sentence ───────────────────
   A speech that lists its points arrives as

     1. Their cost turn never got an answer.
     2. The framework was conceded in cross.

   and `UNIT_END` matched the stop after the 1, because it is a full stop
   with a space behind it. That did two things to the list, and the second
   is the one a reader sees. The marker was split off as a sentence of its
   own, which is survivable by itself, because it rejoins the item in front
   of it with a space. Then the newline between the items was consumed as
   ordinary whitespace after that sentence — one newline, not two, so not a
   paragraph — and the whole list came out on one line:

     1. Their cost turn never got an answer. 2. The framework was conceded.

   which reads as a sentence with stray digits in it. On a longer list the
   numbers stop looking like numbering at all.

   So a stop belonging to a line-leading marker is not a boundary, and a
   single newline in front of one is kept as a line break rather than
   flattened to a space. Both halves are needed: fixing only the first still
   runs the items together, and fixing only the second leaves the marker
   floating as a unit of its own. */
const ENUMERATOR = /^\s*(?:\d{1,3}|[a-z])[.)](?=\s)/i;

/** Whether the stop that ends `unit` is a list marker rather than a
    terminator, decided from the last line of the unit only. */
function isMarker(unit: string): boolean {
  const line = unit.slice(unit.lastIndexOf("\n") + 1);
  return /^\s*(?:\d{1,3}|[a-z])[.)]$/i.test(line);
}

function words(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** One sentence, with the packaging taken off. Empty means "drop this". */
function clean(unit: string, first: boolean): string {
  let text = unit.trim();
  if (!text) return "";

  /* A whole unit that is heading, theatre or bookkeeping. Checked before the
     markdown comes off, while the brackets are still there to recognise. */
  if (LABEL_LINE.test(text) || DIRECTION_LINE.test(text) || WORD_COUNT_ONLY.test(text)) return "";

  /* A fence, which is the model being tidy about prose nobody asked it to
     format. Bullets and headings likewise. */
  text = text.replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/i, "");
  text = text.replace(/^#{1,6}\s+/, "");
  text = text.replace(/^\s*[-*•]\s+/, "");

  /* Markdown, which is never wanted here: nothing renders it, so bold arrives
     on screen as literal asterisks. */
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
  text = text.replace(/(?<![*\w])\*([^*\n]+)\*(?![*\w])/g, "$1");

  /* A heading running into the first sentence of the speech, and the capital
     letter that has to move onto whatever was behind it. */
  if (first) {
    const delabelled = text.replace(LABEL_PREFIX, "");
    if (delabelled !== text) text = delabelled.charAt(0).toUpperCase() + delabelled.slice(1);
  }

  text = text.replace(WORD_COUNT, "");

  /* Em dashes, which are the single most recognisable thing about model
     prose. A comma says the same thing and nobody has ever noticed one. */
  text = text.replace(/\s*—\s*/g, ", ");

  /* Essay connectives, and the capital that moves onto the word behind each
     one that goes. */
  text = text.replace(LEAD_IN, (_m, pre: string, next: string) => pre + next.toUpperCase());

  /* The contrast flip, with the denied half taken out.

     Deliberately after the em dash rule, because that rule can create the
     shape this one looks for: a model that writes "it isn't a game, it's a
     shop" with a dash instead of a comma arrives here with a comma, and the
     flip is the same flip either way. */
  text = text.replace(CONTRAST_FLIP, (_m, negation: string) => `${keptVerb(negation)} `);

  return text.replace(/\s+/g, " ").trim();
}

export type SpeechFilter = {
  /** Feed the model's next delta. Returns the text to show now, which is
      whatever complete sentences that delta finished off, and is usually the
      empty string. */
  push(chunk: string): string;
  /** No more is coming. Returns whatever was still in hand. */
  end(): string;
  /** The speech has run its length. The caller stops reading the model here,
      which is also what stops it being generated. */
  finished(): boolean;
};

/** Hold a streaming speech to its shape and its length.

    The length rule is deliberately generous before it does anything: nothing
    is cut until the speech is more than a third past its budget, because a
    budget is a target for the prompt and trimming every reply to the number
    would behead the last argument of half of them. When it does stop, it
    stops between sentences and never inside one. The tail it drops is, in
    practice, the summary flourish the prompt asked the model not to write. */
export function createSpeechFilter(cap: number): SpeechFilter {
  const limit = Math.round(cap * 1.35);

  let pending = "";
  let said = 0;
  let first = true;
  let stopped = false;
  /** How many newlines the model left between the last thing emitted and
      whatever comes next, or -1 when nothing has been emitted yet.

      A count rather than the separator itself, and that is the whole of the
      list fix. Whether one newline is a line inside a paragraph or the break
      between two list items depends on what the NEXT unit turns out to be,
      and at the moment the gap is measured that unit is still arriving one
      character at a time: the "2" of "2." has landed and the "." has not.
      Deciding then means deciding against a single digit. Kept as a count,
      the decision waits until the unit is in hand.

      Held rather than written eagerly for the reason it always was, too: a
      dropped unit must not leave a gap behind it. */
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

  /** What goes in front of `text`, given the whitespace behind it. */
  function separator(text: string): string {
    if (gap < 0) return "";
    if (gap >= 2) return "\n\n";
    return gap === 1 && ENUMERATOR.test(text) ? "\n" : " ";
  }

  /** Split off every complete unit sitting in `pending` and clean each one.

      The whitespace that ended a unit is consumed with it, and whether it
      held a blank line is what decides the separator in front of whatever
      comes next. */
  function drain(final: boolean): string {
    let out = "";

    while (!stopped) {
      /* Searched from an offset rather than from the front, because a stop
         that turns out to be a list marker is stepped over and the next
         candidate has to be found behind it. */
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

      /* `search` finds where the match starts. For terminal punctuation that
         is the punctuation itself, which belongs to the sentence; for a
         newline it is the separator, which does not. */
      const newline = pending[at] === "\n";
      const cut = newline ? at : at + 1;
      const unit = pending.slice(0, cut);

      const rest = pending.slice(cut);
      const space = rest.match(/^\s*/)?.[0] ?? "";

      /* The run of whitespace after a sentence may still be arriving: a chunk
         boundary can fall between the two newlines of a paragraph break, and
         acting on the first of them would silently turn the break into a
         space. Wait for the character that proves the run has ended, unless
         nothing more is coming.

         Found by a test that pushes the same speech through in random chunk
         sizes and demands the same output as one push. It is exactly the class
         of bug that only appears against a real network. */
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

