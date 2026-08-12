"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Arrow, Label, PrimaryButton } from "../ui";
import { bothPools, type Pool } from "./rating";
import { FORMATS, type Format, type Setup, type Side, type Tab, TIERS, type TierId } from "./types";

/* Agreeing what is about to be argued.

   Four decisions and a start button. The competitive tab asks for one more
   than the casual tab does, and that one is the format, which is not optional
   and is not defaulted: a ballot written by Public Forum conventions handed to
   somebody who came here to practise Lincoln-Douglas is worse than no ballot,
   because they will act on it. */

const MOTIONS: Record<Tab, string[]> = {
  competitive: [
    "Resolved: The United States ought to guarantee a universal basic income.",
    "Resolved: In a democracy, civil disobedience is a moral obligation.",
    "Resolved: Public schools should abolish standardised testing.",
  ],
  casual: [
    "Homework should be abolished",
    "Remote work is better than the office",
    "Social media has done more harm than good",
  ],
};

export function Setup({ onBegin }: { onBegin: (setup: Setup) => void }) {
  const [tab, setTab] = useState<Tab>("casual");
  const [motion, setMotion] = useState("");
  const [side, setSide] = useState<Side>("Pro");
  const [format, setFormat] = useState<Format>("Public Forum");
  const [tierId, setTierId] = useState<TierId>("varsity");

  /* Read after mount for the same reason the study record is: local storage
     does not exist on the server, and rendering a rating during the server
     pass would make the first client render disagree with the HTML. */
  const [pools, setPools] = useState<{ competitive: Pool; casual: Pool } | null>(null);
  useEffect(() => {
    setPools(bothPools());
  }, []);

  const pool = pools?.[tab] ?? null;

  return (
    <section className="mx-auto flex w-full max-w-[46rem] flex-col gap-6 py-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Label>Debate</Label>
          <Link
            href="/"
            className="font-sans text-[0.8125rem] text-accent underline decoration-accent/30 underline-offset-4 hover:decoration-accent"
          >
            Back to Round Mode
          </Link>
        </div>
        <h1 className="font-read text-[clamp(1.75rem,1.3rem+1.8vw,2.5rem)] leading-[1.1] tracking-[-0.015em] text-ink">
          Argue it against someone who is trying to win.
        </h1>
      </div>

      {/* The two tabs, and the reason they are two.

          Switching them switches the rubric, the bar and the rating, and the
          line under them says so, because a student who assumes one number is
          being kept has no way to find out otherwise until it is too late. */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {(["casual", "competitive"] as Tab[]).map((option) => (
            <button
              key={option}
              onClick={() => setTab(option)}
              aria-pressed={tab === option}
              className={`btn rounded-[3px] border-2 px-4 py-2 font-sans text-[0.875rem] font-semibold transition-colors ${
                tab === option
                  ? "border-accent bg-accent-wash/60 text-ink"
                  : "border-line-strong text-ink-soft hover:border-accent hover:text-ink"
              }`}
            >
              {option === "casual" ? "Open debate" : "Tournament prep"}
            </button>
          ))}
        </div>
        <p className="font-sans text-[0.8125rem] leading-[1.6] text-ink-soft">
          {tab === "casual"
            ? "Judged on whether the argument holds up. No format rules, no jargon required, and the bar is a general audience."
            : "Judged by the conventions of a named format against a tournament bar. Dropped arguments are treated as conceded."}
          {" "}
          <span className="text-ink-faint">
            The two keep separate ratings and are never averaged together.
          </span>
        </p>
      </div>

      {pool && pool.rounds > 0 && (
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="font-mono text-[1.75rem] font-bold tabular-nums leading-none text-ink">
            {pool.rating}
          </span>
          <span className="font-sans text-[0.8125rem] text-ink-faint">
            {tab === "casual" ? "open" : "tournament"} rating · {pool.won}W {pool.lost}L{" "}
            {pool.drawn}D over {pool.rounds} {pool.rounds === 1 ? "round" : "rounds"}
          </span>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label>{tab === "competitive" ? "Resolution" : "Topic"}</Label>
        <input
          value={motion}
          onChange={(e) => setMotion(e.target.value)}
          placeholder={
            tab === "competitive" ? "Resolved: …" : "Anything two people could disagree about"
          }
          aria-label={tab === "competitive" ? "Resolution" : "Topic"}
          className="leaf w-full rounded-[3px] border border-line bg-page font-read text-[1.0625rem] text-ink caret-accent placeholder:text-ink-faint"
          style={{ padding: "0.75rem 1rem" }}
        />
        <div className="flex flex-wrap gap-2">
          {MOTIONS[tab].map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => setMotion(suggestion)}
              className="chip min-h-[2.25rem] max-w-full truncate rounded-[3px] border border-line px-3 py-1.5 text-left font-sans text-[0.75rem] text-ink-soft hover:border-accent hover:text-ink"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      {tab === "competitive" && (
        <Choice
          label="Format"
          note="Required. The ballot is written by these conventions and no others."
          options={FORMATS.map((f) => ({ id: f, name: f }))}
          value={format}
          onPick={(v) => setFormat(v as Format)}
        />
      )}

      <Choice
        label="Your side"
        options={[
          { id: "Pro", name: tab === "competitive" ? "Pro / Aff" : "For" },
          { id: "Con", name: tab === "competitive" ? "Con / Neg" : "Against" },
        ]}
        value={side}
        onPick={(v) => setSide(v as Side)}
      />

      {/* The opponent's strength, and the rating attached to it.

          Shown rather than hidden because it is what makes the number mean
          anything: a rating earned against one fixed adversary is a win rate
          in disguise. Beating Circuit moves a rating a long way and losing to
          Novice moves it a long way in the other direction, and both of those
          are only fair if the student picked knowing. */}
      <div className="flex flex-col gap-2">
        <Label>Opponent</Label>
        <div className="flex flex-col gap-2">
          {TIERS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTierId(t.id)}
              aria-pressed={tierId === t.id}
              className={`flex w-full items-start gap-3 rounded-[3px] border-2 px-3.5 py-2.5 text-left transition-colors ${
                tierId === t.id
                  ? "border-accent bg-accent-wash/40"
                  : "border-line hover:border-line-strong"
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block font-sans text-[0.9375rem] font-semibold text-ink">
                  {t.name}
                </span>
                <span className="mt-0.5 block font-sans text-[0.8125rem] leading-[1.5] text-ink-soft">
                  {t.brief}
                </span>
              </span>
              <span className="shrink-0 font-mono text-[0.8125rem] tabular-nums text-ink-faint">
                {t.rating}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <PrimaryButton
          onClick={() =>
            onBegin({
              tab,
              motion: motion.trim(),
              side,
              tierId,
              format: tab === "competitive" ? format : undefined,
            })
          }
          disabled={!motion.trim()}
        >
          Start the round <Arrow />
        </PrimaryButton>
      </div>
    </section>
  );
}

function Choice({
  label,
  note,
  options,
  value,
  onPick,
}: {
  label: string;
  note?: string;
  options: { id: string; name: string }[];
  value: string;
  onPick: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {note && <p className="font-sans text-[0.8125rem] text-ink-faint">{note}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => onPick(o.id)}
            aria-pressed={value === o.id}
            className={`btn min-h-[2.5rem] rounded-[3px] border-2 px-3.5 py-1.5 font-sans text-[0.875rem] font-medium transition-colors ${
              value === o.id
                ? "border-accent bg-accent-wash/60 text-ink"
                : "border-line-strong text-ink-soft hover:border-accent hover:text-ink"
            }`}
          >
            {o.name}
          </button>
        ))}
      </div>
    </div>
  );
}
