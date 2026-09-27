"use client";

import { useEffect } from "react";

const selector = 'a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), summary, [tabindex]:not([tabindex="-1"])';

export function KeyboardNavigation() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches || e.detail === 0) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    }

    function onKey(e: KeyboardEvent) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.defaultPrevented) return;

      const active = document.activeElement as HTMLElement | null;
      if (active?.matches("select, [contenteditable]")) return;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
        if (active.selectionStart !== active.selectionEnd) return;
        if (e.key === "ArrowLeft" && active.selectionStart !== 0) return;
        if (e.key === "ArrowRight" && active.selectionEnd !== active.value.length) return;
      }

      const items = Array.from(document.querySelectorAll<HTMLElement>(selector)).filter((el) =>
        el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden",
      );
      if (!items.length) return;

      const index = active ? items.indexOf(active) : -1;
      const step = e.key === "ArrowRight" ? 1 : -1;
      const next = items[index < 0 ? (step > 0 ? 0 : items.length - 1) : (index + step + items.length) % items.length];

      e.preventDefault();
      next.focus();
    }

    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  return null;
}
