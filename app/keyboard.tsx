"use client";

import { useEffect } from "react";

const selector = 'a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), summary, [tabindex]:not([tabindex="-1"])';

export function KeyboardNavigation() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.key.startsWith("Arrow") || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.defaultPrevented) return;

      const active = document.activeElement as HTMLElement | null;
      if (active?.matches("select, [contenteditable]")) return;
      if (active?.matches("input, textarea") && (e.key === "ArrowLeft" || e.key === "ArrowRight")) return;
      if (active instanceof HTMLTextAreaElement) {
        const before = active.value.slice(0, active.selectionStart);
        const after = active.value.slice(active.selectionEnd);
        if (e.key === "ArrowUp" && before.includes("\n")) return;
        if (e.key === "ArrowDown" && after.includes("\n")) return;
      }

      const items = Array.from(document.querySelectorAll<HTMLElement>(selector)).filter((el) =>
        el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden",
      );
      if (!items.length) return;

      const here = active && items.includes(active) ? active : null;
      const axis = e.key === "ArrowLeft" || e.key === "ArrowRight" ? "x" : "y";
      const sign = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
      let next = items[sign > 0 ? 0 : items.length - 1];

      if (here) {
        const rect = here.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const ranked = items
          .filter((el) => el !== here)
          .map((el) => {
            const r = el.getBoundingClientRect();
            const dx = r.left + r.width / 2 - x;
            const dy = r.top + r.height / 2 - y;
            const main = axis === "x" ? dx : dy;
            const cross = axis === "x" ? dy : dx;
            return { el, main, score: Math.abs(main) + Math.abs(cross) * 2 };
          })
          .filter((item) => item.main * sign > 4)
          .sort((a, b) => a.score - b.score);
        next = ranked[0]?.el ?? items[(items.indexOf(here) + sign + items.length) % items.length];
      }

      e.preventDefault();
      next.focus();
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return null;
}
