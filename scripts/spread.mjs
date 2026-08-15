/* Whether long material is really spread, and whether spreading it is safe.

   lib/chunk.ts decides what a student's pasted notes look like by the time
   they reach the model. For the page or two most sessions run on it does
   nothing at all; for a chapter it thins the text to an even spread of itself
   so a run covers the whole document rather than its opening pages.

   Two claims are worth not taking on trust. The first is that the spread is
   actually a spread: it would be very easy to write something that says it
   samples evenly and in practice returns the front of the document, and the
   symptom would be a student quietly never being asked about their last five
   pages. The second is the safety property the whole design rests on, which is
   that everything handed to the model is still a literal substring of what the
   student pasted. Citations are checked against the FULL source, so if the
   spread ever paraphrased, joined or tidied anything, a student's own material
   would start failing verification for the crime of being long.

   Pure functions, so this needs no server and no key:

       node --experimental-strip-types scripts/spread.mjs

   The flag is what lets plain node import the TypeScript module directly.
------------------------------------------------------------------------- */

import {
  chunkSource,
  sampleForPrompt,
  PROMPT_BUDGET_CHARS,
} from "../lib/chunk.ts";

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

/* The distribution itself, which is the claim worth measuring rather than
   asserting. Front-loading is the failure this is looking for, so it is not
   enough that some late paragraph survived: the kept indices should reach the
   end of the document and should not bunch in its first half. */
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

console.log("\nMaterial that resists splitting");
check("an unbroken blob still chunks", chunkSource("word ".repeat(4000)).length > 1);
check(
  "a blob is still held to the budget",
  sampleForPrompt("word ".repeat(4000)).text.length <= PROMPT_BUDGET_CHARS * 1.15
);
check("a sentence longer than a chunk still splits", chunkSource("a".repeat(5000) + ".").length > 1);

console.log(failed === 0 ? "\nAll good.\n" : `\n${failed} failed.\n`);
process.exit(failed === 0 ? 0 : 1);
