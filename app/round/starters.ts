/* The topics offered on the entry screen.

   Here rather than inside entry.tsx because two places need them now and they
   have to be the same two lists: the chips a student can click, and the banks
   the server warms so that clicking one does not cost a wait. A starter that
   drifts out of step with the warmer is a chip that looks like the others and
   is four seconds slower, which is worse than not warming anything. */
export const STARTERS = [
  "Photosynthesis",
  "The French Revolution",
  "Supply and demand",
  "Neural networks",
];
