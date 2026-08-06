"use client";

import { BlankField, ChipBoard, ChoiceGrid } from "../ui";
import type { Skin, SkinProps } from "./types";

/* Plain: the presentation the mode was built with.

   Always available, presents every format, and the fallback whenever another
   skin cannot or should not run. It is a thin wrapper over the surfaces in
   app/round/ui.tsx rather than a copy of them, so the plain presentation has
   exactly one implementation and skins cannot drift away from it. */

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
}: SkinProps) {
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

export const plain: Skin = {
  id: "plain",
  name: "Plain",
  presents: ["recognition", "choice", "blank", "assemble"],
  Component: PlainSurface,
};
