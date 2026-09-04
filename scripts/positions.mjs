//   node --experimental-strip-types scripts/positions.mjs --topics 4

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const BASE = flag("base", "http://localhost:3000");
const TOPIC_COUNT = Number(flag("topics", "4"));

const TOPICS = [
  "Photosynthesis",
  "The French Revolution",
  "Supply and demand",
  "Neural networks",
  "Plate tectonics",
  "Roman republican politics",
].slice(0, TOPIC_COUNT);

async function ask(body) {
  const res = await fetch(`${BASE}/api/round`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

function answerPosition(q) {
  if (q.format === "recognition" || q.format === "choice") {
    const of = q.options?.length ?? 0;
    if (of < 2 || typeof q.answerIndex !== "number") return null;
    return { index: q.answerIndex, of };
  }
  if (q.format === "assemble") {
    const tray = q.tray ?? [];
    const first = q.chips?.[0];
    if (!tray.length || first === undefined) return null;
    const index = tray.indexOf(first);
    return index < 0 ? null : { index, of: tray.length };
  }
  return null;
}

const buckets = {
  recognition: [0, 0],
  choice: [0, 0, 0, 0],
  assemble: [0, 0, 0, 0],
  blank: [],
};

const totals = { recognition: 0, choice: 0, assemble: 0, blank: 0 };
const everything = [];

function record(q) {
  totals[q.format] = (totals[q.format] ?? 0) + 1;
  everything.push(q);

  const at = answerPosition(q);
  if (!at) return;

  if (q.format === "assemble") {
    const quarter = Math.min(3, Math.floor((at.index / at.of) * 4));
    buckets.assemble[quarter] += 1;
    return;
  }
  if (buckets[q.format] && at.index < buckets[q.format].length) {
    buckets[q.format][at.index] += 1;
  }
}

const EMPTY = new Set("a an the of in on at to for from by with is are was were be do does did has have had what which who when where why how you your and or that this it its as not no".split(" "));

const norm = (s) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const terms = (s) => new Set(norm(s).split(" ").filter((w) => w.length > 1 && !EMPTY.has(w)));

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / (a.size + b.size - shared);
}

function collisions(questions) {
  let n = 0;
  const sigs = questions.map((q) => ({ a: norm(q.answer), p: terms(q.prompt) }));
  for (let i = 0; i < sigs.length; i++) {
    for (let j = i + 1; j < sigs.length; j++) {
      const same = sigs[i].a === sigs[j].a;
      const overlap = jaccard(sigs[i].p, sigs[j].p);
      if ((same && overlap >= 0.34) || overlap >= 0.6) n++;
    }
  }
  return n;
}

function bar(share) {
  return "█".repeat(Math.round(share * 40));
}

function report(name, counts, labels) {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) {
    console.log(`\n${name}: nothing generated.`);
    return;
  }
  const expected = 1 / counts.length;
  console.log(`\n${name}  (n = ${total}, uniform would be ${(expected * 100).toFixed(1)}% each)`);
  counts.forEach((count, i) => {
    const share = count / total;
    const off = ((share - expected) * 100).toFixed(1);
    console.log(
      `  ${labels[i].padEnd(12)} ${String(count).padStart(4)}  ${(share * 100)
        .toFixed(1)
        .padStart(5)}%  ${off > 0 ? "+" : ""}${off}pp  ${bar(share)}`
    );
  });

  const want = total / counts.length;
  const chi = counts.reduce((sum, c) => sum + Math.pow(c - want, 2) / want, 0);
  const df = counts.length - 1;
  const critical = { 1: 3.84, 2: 5.99, 3: 7.81 }[df] ?? 7.81;
  console.log(
    `  chi-square ${chi.toFixed(2)} on ${df} df; 5% critical value is ${critical}. ` +
      (chi > critical ? "NOT uniform." : "Consistent with uniform.")
  );
}

async function main() {
  console.log(`Generating across ${TOPICS.length} topics against ${BASE}\n`);
  let repeats = 0;

  for (const topic of TOPICS) {
    process.stdout.write(`  ${topic}: warm up`);
    const asked = [];

    const open = await ask({ stage: "open", topic });
    open.questions.forEach(record);
    open.questions.forEach((q) =>
      asked.push({ concept: q.concept, answer: q.answer, prompt: q.prompt, format: q.format })
    );
    const perTopic = [...open.questions];

    for (const round of [1, 2, 3]) {
      process.stdout.write(` · round ${round}`);
      const bank = await ask({
        stage: "round",
        round,
        topic,
        concepts: open.concepts,
        asked,
      });
      bank.questions.forEach(record);
      bank.questions.forEach((q) =>
        asked.push({ concept: q.concept, answer: q.answer, prompt: q.prompt, format: q.format })
      );
      perTopic.push(...bank.questions);
      if (bank.exhausted) process.stdout.write(" (ran dry, escalated)");
    }

    const clashes = collisions(perTopic);
    repeats += clashes;
    console.log(`  → ${perTopic.length} questions, ${clashes} repeats`);
  }

  const n = Object.values(totals).reduce((a, b) => a + b, 0);
  console.log(`\n${"─".repeat(72)}\n${n} questions generated.\n`);
  console.log(
    `  recognition ${totals.recognition}   choice ${totals.choice}   ` +
      `blank ${totals.blank}   assemble ${totals.assemble}`
  );

  report("Recognition, correct option index", buckets.recognition, ["first", "second"]);
  report("Choice, correct option index", buckets.choice, [
    "first",
    "second",
    "third",
    "fourth",
  ]);
  report("Assemble, opening chip's position in the tray", buckets.assemble, [
    "1st quarter",
    "2nd quarter",
    "3rd quarter",
    "4th quarter",
  ]);

  console.log(
    `\nFill in the blank  (n = ${totals.blank})\n` +
      "  No ordered options: the answer is typed from memory with nothing on\n" +
      "  screen to pick from, so there is no position to bias. Its distractors\n" +
      "  do not exist; `accepted` is a list of spellings the checker will take\n" +
      "  and is never shown."
  );

  console.log(`\nRepeated questions across everything generated: ${repeats}`);
  console.log(`${"─".repeat(72)}`);
}

main().catch((e) => {
  console.error(`\ndead: ${e.message}`);
  process.exit(1);
});
