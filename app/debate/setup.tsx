"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Label, PrimaryButton, useAutoGrow } from "../ui";
import { handOff } from "./live/handoff";
import { ALPHABET, CODE_LENGTH, makeCode, readCode } from "./live/room";
import {
  FORMATS,
  type Format,
  type Setup,
  type Side,
  type Tab,
  TIERS,
  type TierId,
} from "./types";

export type Defaults = { tab: Tab; format: Format; tierId: TierId };

export const DEFAULTS: Defaults = {
  tab: "casual",
  format: "Public Forum",
  tierId: "novice",
};

export type Against = "model" | "friend";

export function Setup({
  onBegin,
  initial,
}: {
  onBegin: (setup: Setup) => void;
  initial: Defaults;
}) {
  const router = useRouter();
  const [against, setAgainst] = useState<Against>("model");
  const [tab, setTab] = useState<Tab>(initial.tab);
  const [motion, setMotion] = useState("");
  const [format, setFormat] = useState<Format>(initial.format);
  const [tierId, setTierId] = useState<TierId>(initial.tierId);
  const live = against === "friend";

  const [going, setGoing] = useState(false);

  const box = useRef<HTMLTextAreaElement>(null);
  useAutoGrow(box, motion, 2);
  useEffect(() => {
    box.current?.focus();
  }, []);

  const ready = motion.trim().length > 0;

  function begin(side: Side) {
    if (!ready || going) return;

    const chosen: Setup = {
      tab,
      motion: motion.trim(),
      side,
      tierId: live ? undefined : tierId,
      format: tab === "competitive" ? format : undefined,
    };

    if (!live) return onBegin(chosen);

    setGoing(true);
    const { tierId: _tier, ...forRoom } = chosen;
    const code = makeCode();
    handOff(code, forRoom);
    router.push(`/debate/live/${code}`);
  }

  return (
    <section className="flex w-full flex-col gap-6 pb-4">
      <h1 className="text-[1.75rem] leading-tight">What are you arguing about?</h1>
      <div>
        <Opponent value={against} onPick={setAgainst} />
      </div>

      <div className="flex flex-col items-start gap-4">
        <div
          className="note sticky flex min-h-[8.5rem] w-full max-w-[34rem] p-4"
        >
          <textarea
            ref={box}
            value={motion}
            onChange={(e) => {
              setMotion(e.target.value);
            }}
            onKeyDown={(e) => {
              if (
                e.key !== "Enter" ||
                e.shiftKey ||
                e.metaKey ||
                e.ctrlKey ||
                e.altKey
              )
                return;
              e.preventDefault();
              begin("Pro");
            }}
            rows={2}
            placeholder="e.g. schools should start later"
            aria-label="What are you arguing about?"
            className="block w-full resize-none overflow-hidden border-0 bg-transparent p-0 font-hand text-[1.125rem] leading-[1.55] text-ink caret-accent placeholder:text-ink-faint"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:max-w-[34rem] sm:grid-cols-2">
        <SideSlab
          onClick={() => begin("Pro")}
          disabled={!ready || going}
          tone="pro"
          word="For it"
        />
        <SideSlab
          onClick={() => begin("Con")}
          disabled={!ready || going}
          tone="con"
          word="Against it"
        />
      </div>

      {live && (
        <div>
          <Join />
        </div>
      )}

      <div>
        <Options
          open={tab !== DEFAULTS.tab || (!live && tierId !== DEFAULTS.tierId)}
          tab={tab}
          onTab={setTab}
          format={format}
          onFormat={setFormat}
          tierId={tierId}
          onTier={setTierId}
          live={live}
        />
      </div>
    </section>
  );
}

function SideSlab({
  word,
  tone,
  ...props
}: {
  word: string;
  tone: "pro" | "con";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`side-choice side-choice-${tone}`}
    >
      {word}
    </button>
  );
}

function Opponent({
  value,
  onPick,
}: {
  value: Against;
  onPick: (v: Against) => void;
}) {
  const options: {
    id: Against;
    name: string;
    title: string;
  }[] = [
    {
      id: "model",
      name: "Model",
      title:
        "Four speeches against an opponent that argues to win. Judged ballot at the end.",
    },
    {
      id: "friend",
      name: "Friend",
      title:
        "Opens a room with a short code. They type the code, take the other side, and the round is judged the same way.",
    },
  ];

  return (
    <div
      role="group"
      aria-label="Who you are arguing against"
      className="flex flex-wrap gap-2"
    >
      {options.map((o) => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            onClick={() => onPick(o.id)}
            aria-pressed={on}
            title={o.title}
            className={`term-btn ${
              on
                ? "border-accent bg-accent-wash text-ink"
                : "text-ink-soft"
            }`}
          >
            {o.name}
          </button>
        );
      })}
    </div>
  );
}

function Join() {
  const [code, setCode] = useState("");
  const router = useRouter();
  const good = readCode(code);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (good) router.push(`/debate/live/${good}`);
      }}
      className="flex flex-col gap-2 border-t border-line pt-5"
    >
      <Label>Or join a room somebody opened</Label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={code}
          onChange={(e) =>
            setCode(
              e.target.value
                .toUpperCase()
                .split("")
                .filter((c) => ALPHABET.includes(c))
                .join("")
                .slice(0, CODE_LENGTH),
            )
          }
          placeholder={"-".repeat(CODE_LENGTH)}
          aria-label="Room code"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="leaf w-[7.5rem] border border-line bg-page text-center font-mono text-[1.375rem] uppercase tracking-[0.3em] text-ink caret-accent placeholder:tracking-[0.3em] placeholder:text-ink-faint"
          style={{ padding: "0.625rem 0.5rem 0.625rem 0.8rem" }}
        />
        <PrimaryButton type="submit" disabled={!good}>
          Join
        </PrimaryButton>
      </div>
    </form>
  );
}

function Options({
  open,
  tab,
  onTab,
  format,
  onFormat,
  tierId,
  onTier,
  live,
}: {
  open: boolean;
  tab: Tab;
  onTab: (t: Tab) => void;
  format: Format;
  onFormat: (f: Format) => void;
  tierId: TierId;
  onTier: (t: TierId) => void;
  live: boolean;
}) {
  const [startOpen] = useState(open);

  return (
    <details
      open={startOpen}
      className="group flex flex-col gap-4 border-t border-line pt-4"
    >
      <summary
        className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm text-ink-soft hover:text-ink"
      >
        <span
          aria-hidden
          className="inline-block transition-transform group-open:rotate-90"
        >
          &gt;
        </span>
        {live
          ? "Tournament formats"
          : "Tournament formats and opponent strength"}
      </summary>

      <div className="mt-4 flex flex-col gap-5">
        <Choice
          label="Judged as"
          options={[
            {
              id: "casual",
              name: "Open debate",
              title:
                "No format rules. Judged on whether the argument holds up.",
            },
            {
              id: "competitive",
              name: "Tournament prep",
              title:
                "Judged by the format's conventions, at a tournament bar. A dropped argument is conceded.",
            },
          ]}
          value={tab}
          onPick={(v) => onTab(v as Tab)}
        />

        {tab === "competitive" && (
          <Choice
            label="Format"
            options={FORMATS.map((f) => ({
              id: f,
              name: f,
              title:
                "The ballot is written by these conventions and no others.",
            }))}
            value={format}
            onPick={(v) => onFormat(v as Format)}
          />
        )}

        {!live && (
          <Choice
            label="Opponent"
            options={TIERS.map((t) => ({
              id: t.id,
              name: t.name,
              title: t.brief,
            }))}
            value={tierId}
            onPick={(v) => onTier(v as TierId)}
          />
        )}
      </div>
    </details>
  );
}

function Choice({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: { id: string; name: string; title?: string }[];
  value: string;
  onPick: (id: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => onPick(o.id)}
            aria-pressed={value === o.id}
            title={o.title}
            className={`key inline-flex min-h-[2.5rem] items-center border-2 border-line px-3.5 py-1.5 font-pixel text-[0.6875rem] ${
              value === o.id
                ? "translate-x-[2px] translate-y-[2px] bg-accent-wash text-ink"
                : "bg-page text-ink-soft shadow-[2px_2px_0_var(--line)] hover:bg-accent-wash"
            }`}
          >
            {o.name}
          </button>
        ))}
      </div>
    </div>
  );
}
