"use client";

import { Component, type ReactNode } from "react";
import { plain } from "./plain";
import type { PresentationProps } from "./types";

/* If a presentation throws, the round carries on plainly.

   A student mid-round has answers and a streak and a run clock behind them,
   and losing all of that because a drawing of a vending machine had a bad
   render would be a far worse failure than the drawing being missing. So a
   throw is caught here and the question is re-rendered in place, with the
   answer still to give and the timer still running against the same question.

   This has to be a class component: error boundaries have no hook form. */

type Props = PresentationProps & {
  /** Changing this resets the boundary, so one bad question does not pin a
      student to Plain for the rest of the round. */
  resetKey: string;
  children: ReactNode;
};

type State = { failed: boolean; forKey: string };

export class PresentationBoundary extends Component<Props, State> {
  state: State = { failed: false, forKey: this.props.resetKey };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey !== state.forKey) return { failed: false, forKey: props.resetKey };
    return null;
  }

  componentDidCatch(error: Error) {
    console.error("Presentation failed, falling back to plain:", error);
  }

  render() {
    if (this.state.failed) {
      const { children, resetKey, ...rest } = this.props;
      void children;
      void resetKey;
      return <plain.Component {...rest} />;
    }
    return this.props.children;
  }
}
