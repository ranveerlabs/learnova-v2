"use client";

import { useEffect, useRef, useState } from "react";
import { useAutoGrow } from "./ui";

/* ═══ The desk ════════════════════════════════════════════════════════════
   Furniture for the source screen only: a sheet of looseleaf, the tape that
   holds it down, and the school supplies lying around it.

   The sprites are hand-plotted rather than drawn from an icon set, because a
   drawn-by-hand pencil is the whole point. Each is a grid of characters and a
   palette, rendered one rect per pixel with no smoothing, so they stay crisp
   at any scale and stay editable as pictures rather than as paths.

   The deal used to be "nothing in this file reaches the explain or result
   screens: the front door is playful, the marking is not". That held while
   the only playful surface was Round Mode's source screen, and it stopped
   holding when the landing became three scraps pinned to a desk and debate
   was asked to look like the rest of the app rather than like a form. It is
   now drawn narrower and it is still a real line: sprites may mark CONTROLS
   anywhere — a door, a side, the button that closes a round — and may not
   decorate a JUDGEMENT. Nothing in here goes near a mark on a student's own
   words, which is where the original rule was actually aimed. */

type Sprite = { rows: string[]; palette: Record<string, string> };

const PENCIL: Sprite = {
  rows: [
    ".PPPPP.",
    ".PPPPP.",
    ".MMMMM.",
    ".YYdYY.",
    ".YYdYY.",
    ".YYdYY.",
    ".YYdYY.",
    ".YYdYY.",
    ".YYdYY.",
    ".YYdYY.",
    ".YYdYY.",
    ".YYdYY.",
    ".YYdYY.",
    ".WWWWW.",
    "..WWW..",
    "..WkW..",
    "...k...",
  ],
  palette: {
    P: "var(--supply-pink)",
    M: "var(--supply-metal)",
    Y: "var(--supply-gold)",
    d: "#d9a125",
    W: "var(--supply-wood)",
    k: "var(--supply-graphite)",
  },
};

const STAR: Sprite = {
  rows: [
    "....X....",
    "....X....",
    "...XXX...",
    "XXXXXXXXX",
    ".XXXXXXX.",
    "..XXXXX..",
    "..XX.XX..",
    ".XX...XX.",
    ".X.....X.",
  ],
  palette: { X: "var(--supply-gold)" },
};

const ERASER: Sprite = {
  rows: [
    "..RRRRRRR..",
    ".RRRRRRRRR.",
    "RRRRRRRRRRR",
    "RRWWWWWWWRR",
    "RRWWWWWWWRR",
    "RRRRRRRRRRR",
    ".RRRRRRRRR.",
    "..RRRRRRR..",
  ],
  palette: { R: "var(--supply-pink)", W: "#fdf6ea" },
};

const CLIP: Sprite = {
  rows: [
    ".CCCCC.",
    "CC...CC",
    "C.....C",
    "C.CCC.C",
    "C.C.C.C",
    "C.C.C.C",
    "C.C.C.C",
    "C.C.C.C",
    "C.C.C.C",
    "CCC.C.C",
    "....C.C",
    "....CCC",
  ],
  palette: { C: "var(--supply-metal)" },
};

/* The gavel, for the two buttons that close a round.

   It is the object debate mode is actually about and the app already had a
   sound for it — `gavel` in tone.ts, the two low knocks the ballot lands on —
   with nothing on screen to go with it. Drawn head-up and handle-down-right
   so it pivots at the hand: see the `knock` keyframes in globals.css, which
   swing it about that corner rather than spinning it about its middle. */
const GAVEL: Sprite = {
  rows: [
    "WWWWWWW..",
    "WkWWWkW..",
    "WkWWWkW..",
    "WWWWWWW..",
    "...WW....",
    "....WW...",
    ".....WW..",
    "......WW.",
    ".......WW",
  ],
  palette: { W: "var(--supply-wood)", k: "var(--supply-graphite)" },
};

export const SPRITES = { pencil: PENCIL, star: STAR, eraser: ERASER, clip: CLIP, gavel: GAVEL };

export function PixelSprite({
  name,
  scale = 3,
  className = "",
  style,
  title,
}: {
  name: keyof typeof SPRITES;
  scale?: number;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}) {
  const { rows, palette } = SPRITES[name];
  const h = rows.length;
  const w = rows[0].length;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w * scale}
      height={h * scale}
      className={`pixel ${className}`}
      style={style}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {rows.flatMap((row, y) =>
        [...row].map((ch, x) =>
          palette[ch] ? (
            <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={palette[ch]} />
          ) : null
        )
      )}
    </svg>
  );
}

/** A torn strip of masking tape, angled and placed by the caller. */
export function Tape({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <span aria-hidden className={`tape ${className}`} style={style} />;
}

/** The punched edge of a sheet pulled from a binder. */
export function PunchHoles() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-y-0 left-[0.9rem] flex flex-col justify-between py-[13%]"
    >
      {[0, 1, 2].map((i) => (
        <span key={i} className="punch" />
      ))}
    </span>
  );
}

/** True while the value is actively changing, so the pencil can scribble. */
export function useScribbling(value: string, quietAfter = 480) {
  const [scribbling, setScribbling] = useState(false);

  useEffect(() => {
    if (!value) return;
    setScribbling(true);
    const t = setTimeout(() => setScribbling(false), quietAfter);
    return () => clearTimeout(t);
  }, [value, quietAfter]);

  return scribbling;
}

/** The sheet you paste onto: punched, taped down, ruled, with a pencil lying
    across the corner that scribbles while you write.

    The writing surface keeps the same `.leaf` ruling as the rest of the app,
    so the alignment work holds; only the colours are swapped underneath it,
    and the left padding is widened to clear the margin rule and the holes. */
export function Looseleaf({
  value,
  onChange,
  placeholder,
  minRows = 15,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  minRows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useAutoGrow(ref, value, minRows);
  const scribbling = useScribbling(value);

  return (
    <div className="relative pt-3">
      <div className="sheet drop-in">
        <PunchHoles />
        <span aria-hidden className="sheet-margin" />

        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={minRows}
          aria-label="Your source material"
          className="leaf leaf-paper prose-read on-paper relative w-full resize-none overflow-hidden bg-transparent"
        />
      </div>

      {/* Held down at the corners. The strips sit above the sheet so they
          overlap the torn top edge, the way tape actually does. */}
      <Tape className="left-6 top-0 -rotate-6" />
      <Tape className="right-10 top-[-0.15rem] rotate-[5deg]" />

      {/* The pencil lies across the corner of the sheet and gets to work when
          you do. It is the one thing on this screen that reacts to writing.

          How far it hangs off the sheet depends on there being anything to
          hang off into. On a desk there is a margin either side of the paper
          and the pencil lies half on and half off it, which is where a pencil
          would be. On a phone the sheet is the full width of the screen, there
          is no desk beside it, and seven units of overhang put half the pencil
          past the edge of the viewport, where it was cut down its length.

          The overhang comes back at `lg` rather than at `sm`, because `sm` is
          not where the desk appears. The sheet stops growing at 52rem, and
          until the window is wider than that plus its gutters the sheet is
          still the full width of the screen with nothing either side of it: a
          phone held sideways is 844 wide, comfortably past `sm`, and had the
          pencil hanging four pixels off the edge. */}
      <PixelSprite
        name="pencil"
        scale={6}
        title="A pencil, resting on the page"
        /* `right-1` and not `right-0`: the pencil is tilted seventeen degrees,
           so the box it actually occupies is about fourteen pixels wider than
           the box it is laid out in, and the browser clips against the first
           of those. */
        className={`pointer-events-none absolute right-1 top-8 drop-shadow-[3px_4px_0_rgb(12_16_24/0.3)] lg:-right-7 ${
          scribbling ? "scribbling" : "bob"
        }`}
        style={{ ["--tilt" as string]: "17deg" }}
      />

      {/* An eraser left on the desk, clear of the paper rather than on it. */}
      <PixelSprite
        name="eraser"
        scale={4}
        className="bob pointer-events-none absolute -bottom-7 right-10 drop-shadow-[2px_3px_0_rgb(12_16_24/0.28)]"
        style={{ ["--tilt" as string]: "-9deg", ["--i" as string]: 2 }}
      />

      <PixelSprite
        name="star"
        scale={3}
        className="press-on pointer-events-none absolute -left-1 bottom-8 lg:-left-4"
        style={{ ["--tilt" as string]: "-14deg", ["--i" as string]: 3 }}
      />
    </div>
  );
}

/** A small label-maker strip. Used for the eyebrow and for step numbers. */
export function PixelTag({
  children,
  tone = "gold",
  className = "",
  style,
}: {
  children: React.ReactNode;
  tone?: "gold" | "mint" | "pink";
  className?: string;
  style?: React.CSSProperties;
}) {
  const bg = {
    gold: "var(--supply-gold)",
    mint: "var(--supply-mint)",
    pink: "var(--supply-pink)",
  }[tone];

  return (
    <span
      className={`inline-block rounded-[2px] px-2 py-1 font-pixel text-[0.5625rem] leading-none text-[#262626] ${className}`}
      style={{ background: bg, ...style }}
    >
      {children}
    </span>
  );
}
