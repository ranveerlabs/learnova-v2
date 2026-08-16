/* What the model actually said, the two times it was asked.

   Kept so the page has something true to show when the live call cannot be
   made. The shared key is rate limited across everybody using it, and a
   demonstration that goes blank because somebody else is studying is a
   demonstration that does not work; but a recorded answer presented as a live
   one would be the exact dishonesty this page exists to complain about, so the
   page says which it is showing, every time, in words.

   These are verbatim. Both were taken on 15 August 2026 from
   deepseek-v4-flash, through the same route the app uses, with the two
   payloads below and nothing else changed between them. */

export const TOPIC = "Tritoflex";

/** The real thing, in the words of the people who make it. */
export const SOURCE = `Tritoflex is a single-component, spray-applied rubber roofing membrane. It is applied cold with airless spray equipment and cures on the deck to form a seamless elastomeric layer. No torch, no open flame and no hot asphalt kettle is required at any stage, which is what allows it to be installed on occupied buildings such as hospitals and schools. Coverage is typically sixty mils in a single pass over a primed substrate. The cured membrane remains flexible to minus forty degrees and can bridge substrate cracks up to a quarter inch. Because it is seamless there are no laps or seams to fail, which is the most common failure point in sheet systems.`;

export type Shown = {
  prompt: string;
  answer: string;
  citation?: string;
};

/** Given nothing but the word "Tritoflex". Every one of these is invented. */
export const RECORDED_INVENTED: Shown[] = [
  { prompt: "What is Tritoflex primarily classified as?", answer: "A protein" },
  { prompt: "Which structural motif is common in Tritoflex?", answer: "Alpha helix" },
  { prompt: "What is the main role of Tritoflex?", answer: "Signal transduction" },
  { prompt: "How is Tritoflex activity typically regulated?", answer: "Phosphorylation" },
  { prompt: "Tritoflex dysfunction is linked to which condition?", answer: "Cancer" },
];

/** Given the same word, and the paragraph above. */
export const RECORDED_GROUNDED: Shown[] = [
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
