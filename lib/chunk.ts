const SIZE = 1200;

export const PROMPT_BUDGET_CHARS = 12_000;

export type Chunk = {
  text: string;
  opens: boolean;
  closes: boolean;
};

function cutAt(s: string, cap: number): number {
  const floor = Math.floor(cap * 0.67);
  const win = s.slice(0, cap);

  for (const re of [/[;:]\s/g, /,\s/g, /\s/g]) {
    let best = -1;
    for (const m of win.matchAll(re)) {
      const end = m.index + m[0].length;
      if (end >= floor) best = end;
    }
    if (best > 0) return best;
  }
  return cap;
}

export function chunkSource(src: string): Chunk[] {
  const paras = src
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const out: Chunk[] = [];
  const full = (text: string) => ({ text, opens: true, closes: true }) satisfies Chunk;

  for (const p of paras) {
    if (p.length <= SIZE) {
      out.push(full(p));
      continue;
    }

    const sents = p.match(/[^.!?]+[.!?]+[\])'"’”]*\s*|[^.!?]+$/g) ?? [p];
    let buf = "";

    for (const s of sents) {
      if (buf && buf.length + s.length > SIZE) {
        out.push(full(buf.trim()));
        buf = "";
      }

      if (s.length > SIZE) {
        if (buf.trim()) {
          out.push(full(buf.trim()));
          buf = "";
        }
        let rest = s;
        let first = true;
        while (rest.length > SIZE) {
          const at = cutAt(rest, SIZE);
          out.push({ text: rest.slice(0, at).trim(), opens: first, closes: false });
          rest = rest.slice(at);
          first = false;
        }
        if (rest.trim()) out.push({ text: rest.trim(), opens: false, closes: true });
        continue;
      }

      buf += s;
    }
    if (buf.trim()) out.push(full(buf.trim()));
  }

  return out.filter((c) => c.text.length > 0);
}

export type Sampled = {
  text: string;
  sampled: boolean;
  kept: number;
  total: number;
};

export function sampleForPrompt(src: string, budget = PROMPT_BUDGET_CHARS): Sampled {
  const t = src.trim();
  const cs = chunkSource(t);

  if (t.length <= budget || cs.length <= 1)
    return { text: t, sampled: false, kept: cs.length, total: cs.length };

  const avg = t.length / cs.length;
  const room = Math.max(1, Math.floor(budget / Math.max(1, avg)));
  if (room >= cs.length) return { text: t, sampled: false, kept: cs.length, total: cs.length };

  const step = cs.length / room;
  const pick: number[] = [];
  for (let i = 0; i < room; i++) {
    const at = Math.min(cs.length - 1, Math.floor(i * step));
    if (pick[pick.length - 1] !== at) pick.push(at);
  }

  const parts: string[] = [];
  let prev = -1;
  for (const i of pick) {
    const c = cs[i];

    if (prev === -1) parts.push(c.text);
    else if (i > prev + 1) parts.push("\n\n[...]\n\n", c.text);
    else if (!cs[prev].closes && !c.opens) parts.push(c.text.startsWith(" ") ? c.text : ` ${c.text}`);
    else parts.push("\n\n", c.text);

    prev = i;
  }
  if (prev < cs.length - 1) parts.push("\n\n[...]");
  if (!cs[pick[0]].opens) parts.unshift("[...] ");

  return { text: parts.join("").trim(), sampled: true, kept: pick.length, total: cs.length };
}
