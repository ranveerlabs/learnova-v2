"use client";

import { useEffect, useRef, useState } from "react";
import { sourceProblem } from "@/lib/source";
import { SOURCE as DEMO_SOURCE, TOPIC as DEMO_TOPIC } from "./demo-source";
import { Looseleaf, PixelSprite, PixelTag } from "../paper";
import { Notice } from "../ui";
import { openConcepts, studied, type TopicRecord } from "./record";
import { STARTERS } from "./starters";

export function Entry({
  onStart,
  error,
}: {
  onStart: (topic: string, notes: string) => void;
  error: string | null;
}) {
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [notesProblem, setNotesProblem] = useState<string | null>(null);
  const box = useRef<HTMLInputElement>(null);

  const [history, setHistory] = useState<TopicRecord[]>([]);
  useEffect(() => {
    setHistory(studied());
  }, []);

  useEffect(() => {
    box.current?.focus();
  }, []);

  // ?demo fills it with the tritoflex spec sheet, for showing people
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("demo")) return;
    setTopic(DEMO_TOPIC);
    setNotes(DEMO_SOURCE);
    setShowNotes(true);
  }, []);

  function start() {
    const t = topic.trim();
    if (!t) return;

    // checked here as well as on the server, so they see it before the round opens
    const n = notes.trim();
    if (n) {
      const bad = sourceProblem(n);
      if (bad) {
        setNotesProblem(bad);
        setShowNotes(true);
        return;
      }
    }
    setNotesProblem(null);
    onStart(t, n);
  }

  return (
    <section className="mx-auto flex w-full max-w-[52rem] flex-col gap-6 py-2 sm:gap-8">
      <div className="rise flex flex-col gap-5">
        <div className="flex items-center gap-2">
          <PixelTag className="press-on -rotate-2">
            10 seconds to your first question
          </PixelTag>
          <PixelSprite
            name="star"
            scale={2}
            className="press-on"
            style={{ ["--tilt" as string]: "12deg", ["--i" as string]: 1 }}
          />
        </div>

        <h1 className="font-hand text-[clamp(2.75rem,1.8rem+3.6vw,4.25rem)] leading-[0.92] tracking-tight text-ink">
          What are you
          <br />
          studying?
        </h1>

        <p className="max-w-[46ch] font-hand text-[1.5rem] leading-[1.3] text-ink-soft">
          Name it and start guessing. You will be wrong at first, on purpose.
          Then the help gets taken away one step at a time until you are
          explaining it yourself.
        </p>
      </div>

      <div
        className="rise flex flex-col gap-4"
        style={{ ["--i" as string]: 1 }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start();
          }}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <div className="relative flex min-w-0 flex-1 flex-col">
            <input
              ref={box}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Anything. One concept is enough."
              aria-label="What are you studying?"
              className="xp-field w-full px-4 py-3.5 font-read text-[1.25rem] text-ink caret-accent placeholder:text-ink-faint"
              style={{ padding: "1rem 1.125rem" }}
            />
          </div>

          <button
            type="submit"
            disabled={!topic.trim()}
            style={{ ["--tilt" as string]: "-1.4deg" }}
            className="xp-btn xp-btn-go shrink-0 self-start px-6 py-4"
          >
            start
            <span aria-hidden className="arrow">
              →
            </span>
          </button>
        </form>

        {history.length > 0 && (
          <div className="flex flex-col gap-2">
            <p
              style={{ fontVariationSettings: '"wdth" 88' }}
              className="font-pixel text-[0.6875rem] uppercase text-ink-faint"
            >
              Pick up where you left off
            </p>
            <ul className="flex flex-col gap-1.5">
              {history.slice(0, 3).map((r) => (
                <li key={r.key}>
                  <Resume record={r} onStart={(t) => onStart(t, "")} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && <Notice>{error}</Notice>}
      </div>

      <details
        open={showNotes}
        onToggle={(e) =>
          setShowNotes((e.currentTarget as HTMLDetailsElement).open)
        }
        className="rise group flex flex-col gap-3"
        style={{ ["--i" as string]: 2 }}
      >
        <summary className="fold-key xp-btn w-fit cursor-pointer list-none">
          <span
            aria-hidden
            className="inline-block text-[0.75rem] leading-none transition-transform duration-200 group-open:rotate-90"
          >
            ›
          </span>
          I have notes to paste
        </summary>

        <div className="fold-body flex flex-col gap-3 pt-4">
          <Looseleaf
            value={notes}
            onChange={(v) => {
              setNotes(v);
              if (notesProblem) setNotesProblem(null);
            }}
            placeholder="Paste notes, a textbook passage, an article…"
            minRows={6}
          />

          {notesProblem && <Notice>{notesProblem}</Notice>}
        </div>
      </details>
    </section>
  );
}

function ago(when: number) {
  const days = Math.floor((Date.now() - when) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "last week";
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

function Resume({
  record,
  onStart,
}: {
  record: TopicRecord;
  onStart: (topic: string) => void;
}) {
  const open = openConcepts(record);
  const said = open.length
    ? `${open.length} still to explain`
    : "all explained";

  return (
    <button
      onClick={() => onStart(record.topic)}
      className="lift group flex w-full items-center gap-3 border-2 border-line bg-page px-3.5 py-2.5 text-left hover:bg-accent-wash"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate font-read text-[1.0625rem] text-ink">
          {record.topic}
        </span>
        <span className="mt-0.5 block font-sans text-[0.75rem] text-ink-faint">
          {said} · {ago(record.lastRun)}
        </span>
      </span>
      <span
        aria-hidden
        className="arrow shrink-0 font-sans text-[1rem] text-ink-faint group-hover:text-accent"
      >
        →
      </span>
    </button>
  );
}
