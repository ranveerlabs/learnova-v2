"use client";

import { Component, type ReactNode } from "react";
import { plain } from "./plain";
import type { PresentationProps } from "./types";

type Props = PresentationProps & {
  resetKey: string;
  children: ReactNode;
};

type State = { failed: boolean; forKey: string };

export class PresentationBoundary extends Component<Props, State> {
  state: State = { failed: false, forKey: this.props.resetKey };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  static getDerivedStateFromProps(
    props: Props,
    state: State,
  ): Partial<State> | null {
    if (props.resetKey !== state.forKey)
      return { failed: false, forKey: props.resetKey };
    return null;
  }

  componentDidCatch(e: Error) {
    console.error("presentation:rip, using plain", e);
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
