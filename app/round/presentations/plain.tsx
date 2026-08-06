"use client";

import { BlankField, ChipBoard, ChoiceGrid } from "../ui";
import type { Presentation, PresentationProps } from "./types";

/* Plain: the presentation with no scenery.

   It is not a setting and it is not in the rotation. There is no toggle that
   turns it on, because "how much of a game would you like your studying to be"
   is not a question a student should have to answer before they can start, and
   because a preference offered next to the real presentations quietly implies
   the real presentations are optional. They are how rounds look.

   What Plain is, is the floor. Three things stand on it:

   1. A presentation that throws is caught by the boundary and re-rendered as
      this, in place, with the answer still to give. A bad render in a drawing
      of a vending machine must not cost a student their round.
   2. A question no presentation can honestly draw falls back to this. Options
      too long to fit on a balloon are a real case, and the honest answer is
      to render them as text rather than to squeeze them.
   3. Anyone who asks for it can have it for the rest of the session, through
      the control in ui.tsx that only assistive technology and the keyboard
      ever reach. A screen reader user is not well served by a patch board,
      and the way out has to exist without being a menu item that invites
      everyone else to opt out of the product.

   It is a thin wrapper over the surfaces in app/round/ui.tsx rather than a
   copy of them, so the plain rendering has exactly one implementation and
   cannot drift. */

function PlainSurface({
  question,
  revealed,
  correct,
  chosen,
  value,
  onChange,
  built,
  onBuild,
  onAnswer,
}: PresentationProps) {
  if (question.format === "recognition" || question.format === "choice") {
    return (
      <ChoiceGrid
        question={question}
        chosen={chosen}
        revealed={revealed}
        onPick={(i) => onAnswer(i)}
      />
    );
  }

  if (question.format === "blank") {
    return (
      <BlankField
        question={question}
        value={value}
        revealed={revealed}
        correct={correct}
        onChange={onChange}
        onSubmit={() => onAnswer(value)}
      />
    );
  }

  if (question.format === "assemble") {
    return (
      <ChipBoard
        question={question}
        built={built}
        revealed={revealed}
        correct={correct}
        onBuild={onBuild}
        onSubmit={() => onAnswer(built)}
      />
    );
  }

  return null;
}

export const plain: Presentation = {
  id: "plain",
  name: "Plain",
  presents: ["recognition", "choice", "blank", "assemble"],
  Component: PlainSurface,
};
