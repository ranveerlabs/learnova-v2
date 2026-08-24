import type { Format, Question } from "../types";

export type Answer = string | number | string[];

export type PresentationProps = {
  question: Question;
  revealed: boolean;
  correct: boolean;
  chosen: number | null;
  value: string;
  onChange: (v: string) => void;
  built: string[];
  onBuild: (chips: string[]) => void;
  onAnswer: (given: Answer) => void;
};

export type Presentation = {
  id: string;
  name: string;
  presents: Format[];
  supports?: (q: Question) => boolean;
  Component: React.ComponentType<PresentationProps>;
};
