// node --experimental-strip-types scripts/spread.mjs

import { chunkSource, sampleForPrompt, PROMPT_BUDGET_CHARS } from "../lib/chunk.ts";

let failed = 0;
function check(name, condition, detail = "") {
  if (condition) {
    console.log(`  ok   ${name}`);
    return;
  }
  failed++;
  console.log(`  FAIL ${name} ${detail}`);
}

console.log("\nShort material, which is the common case");
const short = "Tritoflex is sprayed on cold.\n\nIt needs no torch and no kettle.";
const asIs = sampleForPrompt(short);
check("is not sampled", asIs.sampled === false);
check("is passed through verbatim", asIs.text === short.trim());
check("splits on paragraphs", chunkSource(short).length === 2);
check(
  "every piece of ordinary prose is a whole one",
  chunkSource(short).every((c) => c.opens && c.closes)
);

console.log("\nNo material at all, which is every topic-only session");
const empty = sampleForPrompt("");
check("an empty source is safe", empty.sampled === false && empty.text === "" && empty.total === 0);
check("a whitespace-only source is safe", sampleForPrompt("   \n\n  ").text === "");

console.log("\nA long document");
const paragraph = (n) =>
  `Paragraph ${n}. ` + "This sentence exists to take up room in the document. ".repeat(12);
const long = Array.from({ length: 120 }, (_, i) => paragraph(i)).join("\n\n");
const spread = sampleForPrompt(long);

check("is sampled", spread.sampled === true);
check(
  "fits the prompt budget",
  spread.text.length <= PROMPT_BUDGET_CHARS * 1.15,
  `(${spread.text.length} chars against a budget of ${PROMPT_BUDGET_CHARS})`
);
check("keeps fewer passages than it was given", spread.kept < spread.total, `(${spread.kept}/${spread.total})`);
check("marks the gaps", spread.text.includes("[...]"));

const kept = [...spread.text.matchAll(/Paragraph (\d+)\./g)].map((m) => Number(m[1]));
const highest = Math.max(...kept);
const pastHalfway = kept.filter((n) => n >= 60).length;

check("always keeps the opening", kept.includes(0));
check("reaches the end of the document", highest > 100, `(highest kept: ${highest} of 119)`);
check(
  "does not bunch in the first half",
  pastHalfway >= kept.length * 0.35,
  `(${pastHalfway} of ${kept.length} came from the second half)`
);

console.log("\nThe safety property citation checking depends on");
const flatten = (s) => s.replace(/\s+/g, " ").trim().toLowerCase();
const haystack = flatten(long);
const passages = spread.text.split("[...]").map(flatten).filter(Boolean);
check(
  "every passage shown is a literal substring of the full source",
  passages.every((p) => haystack.includes(p)),
  "-- without this, grounded questions written from long notes would fail their own citation check"
);

console.log("\nBoundaries: a passage has to read on its own, not merely be a substring");

const proseChunks = chunkSource(long);
check(
  "no passage of ordinary prose begins mid-sentence",
  proseChunks.every((c) => c.opens)
);
check(
  "no passage of ordinary prose ends mid-sentence",
  proseChunks.every((c) => c.closes)
);
check(
  "every passage ends on a sentence terminator",
  proseChunks.every((c) => /[.!?][\])'"’”]*$/.test(c.text.trim())),
  "-- a passage stopping mid-clause can invert its own meaning"
);

const runOn =
  "The membrane cures cold and is never torched, " +
  "which matters because the deck below it cannot take flame; ".repeat(40) +
  "and that is the whole reason it is specified.";
const severed = chunkSource(runOn);
check("a sentence longer than a chunk is split", severed.length > 1);
check("the first piece is marked as opening the sentence", severed[0].opens === true);
check("the first piece is marked as not closing it", severed[0].closes === false);
check(
  "the last piece is marked as not opening it",
  severed[severed.length - 1].opens === false
);
function wordBounded(piece, source) {
  const at = source.indexOf(piece);
  if (at === -1) return false;
  const end = at + piece.length;
  const before = at === 0 ? " " : source[at - 1];
  const after = end >= source.length ? " " : source[end];
  return !/\p{L}/u.test(before) && !/\p{L}/u.test(after);
}

check(
  "no piece is cut mid-word",
  severed.every((c) => wordBounded(c.text, runOn)),
  "-- raw width slicing severed words in half"
);
check(
  "cuts prefer a clause joint where there is one",
  severed.slice(0, -1).filter((c) => /[;:,]$/.test(c.text.trim())).length > 0,
  "-- the ladder tries a clause joint, then a comma, then any space"
);

const rejoined = sampleForPrompt(runOn, 2000);
check(
  "the reassembly case is actually set up",
  rejoined.kept === 2 && severed[0].closes === false && severed[1].opens === false,
  `(kept ${rejoined.kept} of ${rejoined.total})`
);
check(
  "contiguous halves of one sentence are rejoined, not paragraphed apart",
  rejoined.text.includes(`${severed[0].text} ${severed[1].text}`),
  "-- they are one sentence and must read as one"
);
check(
  "no blank line is invented between them",
  !rejoined.text.includes(`${severed[0].text}\n\n${severed[1].text}`),
  "-- a blank line means a paragraph break in the student's material"
);
check("omitted material is still marked", rejoined.text.includes("[...]"));

check(
  "rejoined halves are still literally in the source",
  rejoined.text
    .split("[...]")
    .map(flatten)
    .filter(Boolean)
    .every((p) => flatten(runOn).includes(p)),
  "-- trimming and rejoining must reconstruct the sentence, not approximate it"
);

console.log("\nMaterial that resists splitting");
check("an unbroken blob still chunks", chunkSource("word ".repeat(4000)).length > 1);
check(
  "a blob is still held to the budget",
  sampleForPrompt("word ".repeat(4000)).text.length <= PROMPT_BUDGET_CHARS * 1.15
);
check("a sentence longer than a chunk still splits", chunkSource("a".repeat(5000) + ".").length > 1);
check(
  "something with no spaces at all still terminates",
  chunkSource("a".repeat(5000) + ".").every((c) => c.text.length <= 1200)
);

console.log(failed === 0 ? "\nAll good.\n" : `\n${failed} failed.\n`);
process.exit(failed === 0 ? 0 : 1);
