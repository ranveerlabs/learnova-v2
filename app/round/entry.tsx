"use client";

import { useEffect, useRef, useState } from "react";
import { sourceProblem } from "@/lib/source";
import { Looseleaf, PixelSprite, PixelTag } from "../paper";
import { Notice } from "../ui";
import { openConcepts, studied, type TopicRecord } from "./record";
import { STARTERS } from "./starters";

/* The front door.

   One field, no gate, and the fastest possible path from a topic to a
   question on screen. The old session opened by asking for a wall of pasted
   notes, which is a real barrier at the exact moment a student has the least
   patience for one. Notes are still the better session, so they are offered,
   but they are never the price of entry.

   The desk furniture is kept from the Teach-Back front door on purpose: this
   is the same app, and the one screen allowed to have a personality is still
   allowed to have it. */

/* Starting points, for the student who wants to try this before deciding
   what to study. Tapping one fills the field and leaves the cursor in it, so
   it is a starting point rather than a menu.

   The list itself lives in starters.ts, because the server warms these same
   four topics so that tapping one costs no wait. */

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
  const field = useRef<HTMLInputElement>(null);

  /* What this browser has studied before, read after mount rather than during
     render. The record lives in local storage, which does not exist on the
     server, so reading it while rendering would make the first client render
     disagree with the HTML that arrived and React would throw the whole tree
     away. An empty list on the first frame is also the honest default: a
     student with no history sees exactly the front door they saw before. */
  const [history, setHistory] = useState<TopicRecord[]>([]);
  useEffect(() => {
    setHistory(studied());
  }, []);

  useEffect(() => {
    field.current?.focus();
  }, []);

  function start() {
    const t = topic.trim();
    if (!t) return;

    /* The topic is ungated by design. Notes are not: a grounded session is
       only honest if there was something real to ground it in, and the same
       floor the rest of the app uses decides that. Pasting nothing is
       always fine, and simply means the session is AI-generated and says so. */
    const trimmed = notes.trim();
    if (trimmed) {
      const problem = sourceProblem(trimmed);
      if (problem) {
        setNotesProblem(problem);
        setShowNotes(true);
        return;
      }
    }
    setNotesProblem(null);
    onStart(t, trimmed);
  }

  /* The front door has more on it than a round does, because pasting notes
     opens a textarea ten rows tall. It does not arrange its own scrolling for
     that: the shell in page.tsx owns the viewport lock and gives every screen
     that is not a live question a panel to scroll inside. This one just says
     how wide it is and gets out of the way. */
  return (
    <section className="mx-auto flex w-full max-w-[52rem] flex-col gap-6 py-2 sm:gap-8">
      <div className="rise flex flex-col gap-5">
        <div className="flex items-center gap-2">
          <PixelTag className="press-on -rotate-2">10 seconds to your first question</PixelTag>
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
          Name it and start guessing. You will be wrong at first, on purpose. Then the help gets
          taken away one step at a time until you are explaining it yourself.
        </p>
      </div>

      <div className="rise flex flex-col gap-4" style={{ ["--i" as string]: 1 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start();
          }}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <div className="relative flex min-w-0 flex-1 flex-col">
            <input
              ref={field}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Anything. One concept is enough."
              aria-label="What are you studying?"
              className="leaf w-full rounded-[3px] border border-line bg-page font-read text-[1.25rem] text-ink caret-accent placeholder:text-ink-faint"
              style={{ padding: "1rem 1.125rem" }}
            />
            <span
              aria-hidden
              className="sweep pointer-events-none absolute inset-x-0 bottom-0 h-[2px] rounded-b-[3px] bg-accent"
            />
          </div>

          <button
            type="submit"
            disabled={!topic.trim()}
            style={{ ["--tilt" as string]: "-1.4deg" }}
            className="stuck sticker inline-flex shrink-0 items-center gap-2 self-start rounded-[3px] border-[2.5px] border-sheet-ink bg-supply-gold px-6 py-4 font-pixel text-[0.8125rem] leading-none text-[#22262e] disabled:cursor-not-allowed disabled:border-line-strong disabled:bg-sunk disabled:text-ink-faint"
          >
            start
            <span aria-hidden className="arrow">→</span>
          </button>
        </form>

        {/* Where the last run got to.

            This is the whole reason the record exists, and it is the first
            thing a returning student should be able to act on, so it sits
            directly under the field rather than at the foot of the screen.
            What each row leads with is not how well they did, it is what is
            still unsaid: the point of coming back is the three concepts they
            could recognise and could not explain, and a row that showed a
            score would be inviting them to admire a number instead. */}
        {history.length > 0 && (
          <div className="flex flex-col gap-2">
            <p
              style={{ fontVariationSettings: '"wdth" 88' }}
              className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.15em] text-ink-faint"
            >
              Pick up where you left off
            </p>
            <ul className="flex flex-col gap-1.5">
              {history.slice(0, 3).map((record) => (
                <li key={record.key}>
                  <Resume record={record} onStart={(t) => onStart(t, "")} />
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span className="font-sans text-[0.75rem] text-ink-faint">or try</span>
          {STARTERS.map((starter) => (
            <button
              key={starter}
              onClick={() => {
                setTopic(starter);
                field.current?.focus();
              }}
              /* A starting point has to be tappable by a thumb, not only
                 clickable by a cursor. At the old height these were a
                 twenty-six pixel target, which on a phone is a coin toss
                 between filling the field and hitting the one next to it. */
              className="chip min-h-[2.25rem] rounded-[3px] border border-line px-3 py-1.5 font-sans text-[0.8125rem] text-ink-soft hover:border-accent hover:text-ink"
            >
              {starter}
            </button>
          ))}
        </div>

        {error && <Notice>{error}</Notice>}
      </div>

      {/* Notes are the better session and are offered as such, not demanded.
          Folded away by default so the front door stays one field. */}
      <div className="rise flex flex-col gap-3" style={{ ["--i" as string]: 2 }}>
        {!showNotes ? (
          <button
            onClick={() => setShowNotes(true)}
            className="self-start font-sans text-[0.875rem] font-medium text-accent underline decoration-accent/30 decoration-1 underline-offset-4 transition-colors hover:decoration-accent"
          >
            I have notes to paste
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-4">
              <p
                style={{ fontVariationSettings: '"wdth" 88' }}
                className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.15em] text-ink-faint"
              >
                Your material, optional
              </p>
              <button
                onClick={() => {
                  setShowNotes(false);
                  setNotes("");
                  setNotesProblem(null);
                }}
                className="font-sans text-[0.75rem] text-ink-faint underline underline-offset-4 hover:text-ink-soft"
              >
                Skip this
              </button>
            </div>

            <p className="max-w-[62ch] font-sans text-[0.875rem] leading-[1.6] text-ink-soft">
              Paste it and every question comes with the line from your own notes that it came
              from, checked word for word on the server. Leave it empty and the questions are
              written by an AI model instead, which the session will say on every screen.
            </p>

            <Looseleaf
              value={notes}
              onChange={(v) => {
                setNotes(v);
                if (notesProblem) setNotesProblem(null);
              }}
              placeholder="Paste notes, a textbook passage, an article…"
              minRows={10}
            />

            {notesProblem && <Notice>{notesProblem}</Notice>}
          </div>
        )}
      </div>

      <Credits />
    </section>
  );
}

/** Roughly how long ago, in the words somebody would actually use.

    Rough on purpose. The record keeps a timestamp because ordering needs one,
    but "today" and "3 days ago" is the entire resolution this screen has any
    use for, and a precise date would read as a log entry rather than as a
    memory of having studied. */
function ago(when: number): string {
  const days = Math.floor((Date.now() - when) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "last week";
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

/** One topic this browser has studied, and what is still unsaid on it.

    Starting is one tap rather than filling the field, which is the difference
    between this and the starter chips beside it. A starter is a suggestion
    about what to study and wants the cursor left in the box; this is a topic
    the student already chose and already worked on, and asking them to choose
    it a second time is a step with nothing in it.

    It does not carry their notes back. Nothing they wrote is kept, so a run
    resumed here is written from the topic and the provenance badge will say
    so on every screen, the same as any other topic-only session. */
function Resume({ record, onStart }: { record: TopicRecord; onStart: (topic: string) => void }) {
  const open = openConcepts(record);
  const said =
    open.length === 0
      ? "all explained"
      : `${open.length} still to explain`;

  return (
    <button
      onClick={() => onStart(record.topic)}
      className="lift group flex w-full items-center gap-3 rounded-[3px] border border-line bg-page px-3.5 py-2.5 text-left hover:border-accent"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate font-read text-[1.0625rem] text-ink">{record.topic}</span>
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

/* ── Credit where it is required ──────────────────────────────────────────
   The background track is used under Creative Commons BY 4.0, and attribution
   is a condition of that licence rather than a courtesy. It is also in
   CREDITS.md and in README.md, but neither of those is reachable by a student
   who is only ever going to see the app, so it is here too.

   Closed by default and one click from open, at the foot of the screen every
   session begins on. That is as far from buried as a credit can be without
   taking space from the one field this screen exists for. The text is
   reproduced exactly as the licence requires: it is not reworded, wrapped in
   friendlier language, or abbreviated. */

function Credits() {
  return (
    <details className="rise group self-start" style={{ ["--i" as string]: 3 }}>
      <summary
        style={{ fontVariationSettings: '"wdth" 88' }}
        className="inline-flex cursor-pointer list-none items-center gap-1.5 font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-ink-faint transition-colors hover:text-ink-soft"
      >
        <span aria-hidden className="inline-block transition-transform group-open:rotate-90">
          ›
        </span>
        Credits
      </summary>

      <div className="mt-3 border-l-2 border-line-strong pl-3.5">
        <p className="font-sans text-[0.8125rem] leading-[1.7] text-ink-soft">
          &ldquo;8bit Dungeon Level&rdquo; Kevin MacLeod (incompetech.com)
          <br />
          Licensed under Creative Commons: By Attribution 4.0
          <br />
          <a
            href="http://creativecommons.org/licenses/by/4.0/"
            target="_blank"
            rel="noreferrer"
            className="text-accent underline decoration-accent/30 underline-offset-4 hover:decoration-accent"
          >
            http://creativecommons.org/licenses/by/4.0/
          </a>
        </p>
      </div>
    </details>
  );
}
