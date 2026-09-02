"use client";

import { BlankField, ChipBoard, ChoiceGrid } from "../ui";
import type { Presentation, PresentationProps } from "./types";

// the floor everything else stands on. reached three ways, never by preference
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
