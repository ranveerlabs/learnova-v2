"use client";

import { useCallback, useEffect, useState } from "react";
import type { Ticket } from "@/lib/feed";
import { AudioControls } from "../audio-controls";
import { CHAOS, LIMITS, openCount } from "./limits";
import { Notice, Waiting, Win, Wordmark } from "../ui";

const POLL = 60_000;

export default function Feed() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [stale, setStale] = useState(false);
  const [dead, setDead] = useState<string | null>(null);

  const pull = useCallback(async () => {
    try {
      const r = await fetch("/api/feed");
      const d = await r.json();
      if (!r.ok)
        return setDead(d.error ?? "GitHub is not answering right now.");
      setTickets(d.tickets);
      setStale(d.stale);
      setDead(null);
    } catch {
      setDead("Could not reach the feed.");
    }
  }, []);

  useEffect(() => {
    pull();
    const t = setInterval(pull, POLL);
    return () => clearInterval(t);
  }, [pull]);

  return (
    <div className="relative z-10 flex h-full min-h-0 flex-1 flex-col p-3 sm:p-5">
      <Win
        title="Feed: commits and builds"
        closeHref="/"
        className="mx-auto w-full max-w-[72rem] flex-1"
        bodyClassName="flex flex-col"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b-2 border-line bg-sunk px-4 py-2">
          <Wordmark mode="Feed" />
          <AudioControls />
        </header>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-4 py-4 sm:px-6 lg:grid-cols-[1fr_22rem] lg:overflow-hidden">
          <div className="min-h-0 lg:overflow-y-auto lg:pr-4">
            {dead && !tickets && <Notice>{dead}</Notice>}
            {!tickets && !dead && (
              <Waiting title="Reading the log" sub="github.com" />
            )}

            {tickets && (
              <>
                <p className="mb-4 font-pixel text-[0.625rem] uppercase text-ink-faint">
                  {stale
                    ? "last good answer, github is not talking"
                    : "refreshes every minute"}
                </p>
                <ol className="flex flex-col gap-3">
                  {tickets.map((t) => (
                    <TicketRow key={t.sha} t={t} />
                  ))}
                </ol>
              </>
            )}
          </div>

          <KnownLimits />
        </div>
      </Win>
    </div>
  );
}

// green shipped, gold still going, pink broke
function state(t: Ticket): { word: string; tint: string } {
  const s = t.build?.state;
  if (!s) return { word: "No build", tint: "bg-sunk" };
  if (s === "success") return { word: "Shipped", tint: "bg-supply-mint" };
  if (s === "failure" || s === "error")
    return { word: "Failed", tint: "bg-supply-pink" };
  return { word: s, tint: "bg-supply-gold" };
}

function TicketRow({ t }: { t: Ticket }) {
  const { word, tint } = state(t);

  return (
    <li className="border-2 border-line bg-page">
      <div
        className={`flex flex-wrap items-center gap-x-3 gap-y-1 border-b-2 border-line px-3 py-2 ${tint}`}
      >
        <a
          href={t.url}
          target="_blank"
          rel="noreferrer"
          className="font-pixel text-[0.75rem] text-[#101010] underline decoration-[#101010]/40 underline-offset-4 hover:decoration-[#101010]"
        >
          {t.sha.slice(0, 7)}
        </a>
        <span className="font-pixel text-[0.625rem] uppercase text-[#101010]">
          {word}
        </span>
        <span className="ml-auto font-pixel text-[0.625rem] text-[#101010]">
          {when(t.at)}
        </span>
      </div>

      <div className="px-3 py-2.5">
        <p className="font-read text-[1.0625rem] leading-snug text-ink">
          {t.subject}
        </p>

        {t.body && (
          <details className="group mt-2">
            <summary className="inline-flex w-fit cursor-pointer list-none items-center gap-1.5 font-pixel text-[0.625rem] uppercase text-ink-faint hover:text-ink-soft">
              <span aria-hidden className="inline-block group-open:rotate-90">
                ›
              </span>
              details for nerds
            </summary>
            <pre className="xp-scroll mt-2 max-h-[14rem] overflow-auto whitespace-pre-wrap border-2 border-line bg-sunk px-3 py-2 font-mono text-[0.75rem] leading-[1.6] text-ink-soft">
              {t.body}
            </pre>
          </details>
        )}

        <table className="xp-table mt-3">
          <tbody>
            <tr>
              <th scope="row">Author</th>
              <td>{t.author}</td>
              <th scope="row">Environment</th>
              <td>{t.build?.environment ?? "none"}</td>
            </tr>
            <tr>
              <th scope="row">Committed</th>
              <td>{stamp(t.at)}</td>
              <th scope="row">Built</th>
              <td>
                {t.build ? (
                  t.build.url ? (
                    <a
                      href={t.build.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent underline underline-offset-4"
                    >
                      {stamp(t.build.at)}
                    </a>
                  ) : (
                    stamp(t.build.at)
                  )
                ) : (
                  "not deployed"
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </li>
  );
}

function stamp(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function when(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function KnownLimits() {
  return (
    <aside className="flex min-h-0 flex-col gap-4 lg:overflow-y-auto lg:pr-4">
      <section className="border-2 border-line bg-page">
        <h2 className="flex items-baseline justify-between gap-2 border-b-2 border-line bg-supply-gold px-3 py-2 font-pixel text-[0.6875rem] uppercase text-[#101010]">
          Known limitations
          <span className="text-[0.875rem]">{openCount}</span>
        </h2>
        <ol className="flex flex-col">
          {LIMITS.map((l) => (
            <li
              key={l.what}
              className="border-b border-line/25 px-3 py-2.5 last:border-b-0"
            >
              <p className="font-sans text-[0.8125rem] leading-[1.55] text-ink">
                {l.what}
              </p>
              <p className="mt-1 font-pixel text-[0.5625rem] uppercase text-ink-faint">
                {l.where}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-2 border-line bg-page">
        <h2 className="flex items-baseline justify-between gap-2 border-b-2 border-line bg-supply-pink px-3 py-2 font-pixel text-[0.6875rem] uppercase text-[#101010]">
          Chaos log
          <span className="text-[0.875rem]">{CHAOS.length}</span>
        </h2>
        <ol className="flex flex-col">
          {CHAOS.map((c) => (
            <li
              key={c.fix}
              className="border-b border-line/25 px-3 py-2.5 last:border-b-0"
            >
              <p className="font-sans text-[0.8125rem] leading-[1.55] text-ink">
                {c.what}
              </p>
              <p className="mt-1 font-pixel text-[0.5625rem] uppercase text-ink-faint">
                fixed in {c.fix}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}
