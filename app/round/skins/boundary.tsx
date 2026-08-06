"use client";

import { Component, type ReactNode } from "react";
import { plain } from "./plain";
import type { SkinProps } from "./types";

/* If a skin throws, the round carries on in Plain.

   A skin is decoration over a study session. A student mid-round has answers
   and a streak and a run clock behind them, and losing all of that because a
   presentation layer had a bad render would be a far worse failure than the
   presentation being boring. So a throw inside a skin is caught here and the
   question is re-rendered plainly, in place, with the answer still to give.

   This has to be a class component: error boundaries have no hook form. */

type Props = SkinProps & {
  /** Changing this resets the boundary, so one bad question does not pin a
      student to Plain for the rest of the round. */
  resetKey: string;
  children: ReactNode;
};

type State = { failed: boolean; forKey: string };

export class SkinBoundary extends Component<Props, State> {
  state: State = { failed: false, forKey: this.props.resetKey };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey !== state.forKey) return { failed: false, forKey: props.resetKey };
    return null;
  }

  componentDidCatch(error: Error) {
    console.error("Skin failed, falling back to plain:", error);
  }

  render() {
    if (this.state.failed) {
      const { children, resetKey, ...skinProps } = this.props;
      void children;
      void resetKey;
      return <plain.Component {...skinProps} />;
    }
    return this.props.children;
  }
}
