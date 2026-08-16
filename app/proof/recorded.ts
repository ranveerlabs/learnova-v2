/* What the model actually said, the two times it was asked.

   This is a recording, not a fixture. Every prompt and every answer below came
   back from the real route on the date named, and nothing has been shortened,
   reordered or tidied: the invented column is exactly as fluent and exactly as
   wrong as it arrived. Editing it to look worse would be inventing evidence
   about invention, which would be a strange thing to do on this page of all
   pages.

   The page renders this and makes no request of its own. It ran live once and
   that was the wrong call: a demonstration about reliability cannot itself
   depend on a shared, rate-limited key, on several seconds of waiting, and on
   a model choosing to fail the same way twice. Fixed, it loads instantly and
   says the same thing every time somebody opens it.

   Both requests went to deepseek-v4-flash through POST /api/round with
   `stage: "open"`, the same call Round Mode makes when a session begins. The
   only difference between them was whether `notes` carried SOURCE or an empty
   string. */

export const TOPIC = "Tritoflex";

/** When these were taken, for the line on the page that says so. */
export const RECORDED_ON = "15 August 2026";

/** The real thing, in the words of the people who make it. */
export const SOURCE = `Tritoflex is a single-component, spray-applied rubber roofing membrane. It is applied cold with airless spray equipment and cures on the deck to form a seamless elastomeric layer. No torch, no open flame and no hot asphalt kettle is required at any stage, which is what allows it to be installed on occupied buildings such as hospitals and schools. Coverage is typically sixty mils in a single pass over a primed substrate. The cured membrane remains flexible to minus forty degrees and can bridge substrate cracks up to a quarter inch. Because it is seamless there are no laps or seams to fail, which is the most common failure point in sheet systems.`;

export type Shown = {
  prompt: string;
  answer: string;
  /** The span of SOURCE this was traced to. Absent on the ungrounded side,
      where there is nothing for it to point at, and the page draws that
      absence rather than leaving a gap. */
  citation?: string;
};

/** Given nothing but the word "Tritoflex".

    It is roofing material. Not one of these is true, and not one of them reads
    like a guess. */
export const INVENTED: Shown[] = [
  { prompt: "What is Tritoflex primarily classified as?", answer: "A protein" },
  { prompt: "Which structural motif is common in Tritoflex?", answer: "Alpha helix" },
  { prompt: "What is the main role of Tritoflex?", answer: "Signal transduction" },
  { prompt: "How is Tritoflex activity typically regulated?", answer: "Phosphorylation" },
  { prompt: "Tritoflex dysfunction is linked to which condition?", answer: "Cancer" },
];

/** Given the same word, and the paragraph above. */
export const GROUNDED: Shown[] = [
  {
    prompt: "How is Tritoflex applied to the substrate?",
    answer: "Cold with airless spray",
    citation: "applied cold with airless spray equipment",
  },
  {
    prompt: "What thickness is achieved in a single pass?",
    answer: "Sixty mils",
    citation: "Coverage is typically sixty mils in a single pass",
  },
  {
    prompt: "Down to what temperature does the membrane stay flexible?",
    answer: "Minus forty degrees",
    citation: "flexible to minus forty degrees",
  },
  {
    prompt: "What size substrate cracks can it bridge?",
    answer: "Up to a quarter inch",
    citation: "bridge substrate cracks up to a quarter inch",
  },
  {
    prompt: "What is the most common failure point in sheet systems?",
    answer: "Laps or seams",
    citation: "the most common failure point in sheet systems",
  },
];
