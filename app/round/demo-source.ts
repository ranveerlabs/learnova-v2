/* The worked example the entry screen offers when somebody wants to see what
   a grounded session looks like without pasting anything of their own.

   ── Why this file exists ──────────────────────────────────────────────────
   It used to live in `app/proof/recorded.ts` alongside a recording of what
   the model said the two times it was asked, because the /proof page and the
   entry screen wanted the same paragraph and a second copy would have been a
   second thing to keep true. /proof is gone, so the paragraph moved here
   rather than leaving a routeless folder behind to explain.

   The text is a real product description, in the words of the people who make
   it, and it is the material rather than a lorem-ipsum stand-in on purpose:
   the whole point of a grounded session is that questions are cited against
   something an actual person wrote, and a demonstration built on filler
   demonstrates nothing. */

export const TOPIC = "Tritoflex";

export const SOURCE = `Tritoflex is a single-component, spray-applied rubber roofing membrane. It is applied cold with airless spray equipment and cures on the deck to form a seamless elastomeric layer. No torch, no open flame and no hot asphalt kettle is required at any stage, which is what allows it to be installed on occupied buildings such as hospitals and schools. Coverage is typically sixty mils in a single pass over a primed substrate. The cured membrane remains flexible to minus forty degrees and can bridge substrate cracks up to a quarter inch. Because it is seamless there are no laps or seams to fail, which is the most common failure point in sheet systems.`;
