"use client";

// one char per pixel, palette maps char to a css var so they flip with the theme
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
  palette: {
    R: "var(--supply-pink)",
    W: "color-mix(in srgb, var(--supply-gold) 14%, #fff)",
  },
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

// the wordmark. same nine row star as the sprite, chevrons either side of it
const LOGO: Sprite = {
  rows: [
    "....BB.....X.....BB....",
    "...BB......X......BB...",
    "..BB......XXX......BB..",
    ".BB....XXXXXXXXX....BB.",
    "BB......XXXXXXX......BB",
    ".BB......XXXXX......BB.",
    "..BB.....XX.XX.....BB..",
    "...BB...XX...XX...BB...",
    "....BB..X.....X..BB....",
  ],
  palette: { B: "var(--ink)", X: "var(--supply-gold)" },
};

export const SPRITES = {
  pencil: PENCIL,
  star: STAR,
  eraser: ERASER,
  clip: CLIP,
  logo: LOGO,
};

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
  const w = rows[0].length; // assumes every row is the same length. they are

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
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width="1"
              height="1"
              fill={palette[ch]}
            />
          ) : null,
        ),
      )}
    </svg>
  );
}

// notes go in a panel inside the window, not on a sheet of paper. the ruled
// leaf had tape, punch holes and a pencil hanging off its right edge, all of
// which sat outside the box and got cut off once screens had a border
export function Looseleaf({
  value,
  onChange,
  placeholder,
  minRows = 6,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  minRows?: number;
}) {
  return (
    <div className="xp-field flex min-w-0 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b-2 border-line bg-sunk px-3 py-1.5">
        <span className="font-pixel text-[0.625rem] uppercase text-ink-soft">
          notes
        </span>
        <span className="font-pixel text-[0.625rem] text-ink-faint">
          {value.length.toLocaleString()} chars
        </span>
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={minRows}
        aria-label="Your source material"
        className="xp-scroll prose-read max-h-[26vh] w-full resize-none bg-page px-4 py-3 text-ink caret-accent placeholder:text-ink-faint focus:outline-none"
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
      className={`inline-block px-2 py-1 font-pixel text-[0.5625rem] leading-none text-[#262626] ${className}`}
      style={{ background: bg, ...style }}
    >
      {children}
    </span>
  );
}
