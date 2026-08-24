"use client";

import { useEffect, useRef, useState } from "react";
import { useAutoGrow } from "./ui";

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
    d: "color-mix(in srgb, var(--supply-gold) 76%, #000)",
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
  palette: { R: "var(--supply-pink)", W: "color-mix(in srgb, var(--supply-gold) 14%, #fff)" },
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

export const SPRITES = { pencil: PENCIL, star: STAR, eraser: ERASER, clip: CLIP };

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

export function Tape({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <span aria-hidden className={`tape ${className}`} style={style} />;
}

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

      <Tape className="left-6 top-0 -rotate-6" />
      <Tape className="right-10 top-[-0.15rem] rotate-[5deg]" />

      <PixelSprite
        name="pencil"
        scale={6}
        title="A pencil, resting on the page"
        className={`pointer-events-none absolute right-1 top-8 drop-shadow-[3px_4px_0_rgb(12_16_24/0.3)] lg:-right-7 ${
          scribbling ? "scribbling" : "bob"
        }`}
        style={{ ["--tilt" as string]: "17deg" }}
      />

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
