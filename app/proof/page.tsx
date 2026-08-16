"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AudioControls } from "../audio-controls";
import { isBusy, postJSON } from "../client";
import { PixelSprite, PixelTag } from "../paper";
import { Arrow, Credits, GhostButton, Label, Working } from "../ui";
import { markSource } from "./highlight";
import {
  RECORDED_GROUNDED,
  RECORDED_INVENTED,
  type Shown,
  SOURCE,
  TOPIC,
} from "./recorded";

/* The demonstration.

   Everything else in this app is built for a student. This one screen is built
   for somebody deciding in thirty seconds whether any of it is worth their
   attention, and it makes one argument: an AI study tool will invent material
   with total confidence, you will not notice unless you already knew the
   answer, and that is the worst possible failure for a tool whose entire
   purpose is material you do not know yet.

   The argument is not made in prose. It is made by asking the same model the
   same question twice, live, in front of the reader, changing exactly one
   thing between the two: whether it was given anything to read.

   ── Why Tritoflex ──────────────────────────────────────────────────────────
   Because it is real. Somebody ran a topic-only session on it and was told
   over and over that it is torch-applied. It is sprayed on cold. He caught it
   because he installs the stuff; a student meeting it for the first time would
   have learned the opposite of the truth and been graded as correct for it.

   It also happens to be the perfect case, and not because it is obscure. The
   model does not fail by admitting it has not heard of it. It fails by
   producing a fluent, confident, internally consistent biochemistry: a protein
   with an alpha helix, regulated by phosphorylation, implicated in cancer.
   Every word of that is invented, and none of it looks invented.

   ── Why it runs live ───────────────────────────────────────────────────────
   A screenshot of a model getting something wrong proves nothing; anybody can
   produce one. Watching it happen, now, on a key anyone can point at, is a
   different kind of claim. The recorded answers exist only for when the shared
   key is busy, and when they are used the page says so in words rather than
   passing them off as fresh. A page arguing against confident unmarked output
   does not get to produce any. */

type Panel = {
  state: "loading" | "live" | "recorded" | "failed";
  questions: Shown[];
  note?: string;
};

const WAITING: Panel = { state: "loading", questions: [] };

export default function Proof() {
  const [invented, setInvented] = useState<Panel>(WAITING);
  const [grounded, setGrounded] = useState<Panel>(WAITING);
  const started = useRef(false);

  const run = useCallback(async () => {
    setInvented(WAITING);
    setGrounded(WAITING);

    /* Both at once, and reported the moment each lands rather than when the
       pair does. The ungrounded call is the shorter prompt and usually arrives
       first, which is a better beat than any staging: the invented answers
       turn up promptly and confidently, and the checked ones take longer
       because something is actually being checked. */
    const ask = async (notes: string, set: (p: Panel) => void, fallback: Shown[]) => {
      try {
        const payload = await postJSON<{ questions: Shown[] }>("/api/round", {
          stage: "open",
          topic: TOPIC,
          notes,
          asked: [],
        });
        set({ state: "live", questions: payload.questions.slice(0, 5) });
      } catch (err) {
        set({
          state: "recorded",
          questions: fallback,
          note: isBusy(err)
            ? "Learnova is busy right now, so this is the answer it gave earlier rather than one taken just now."
            : "The live call did not go through, so this is the answer it gave earlier rather than one taken just now.",
        });
      }
    };

    await Promise.all([
      ask("", setInvented, RECORDED_INVENTED),
      ask(SOURCE, setGrounded, RECORDED_GROUNDED),
    ]);
  }, []);

  /* Runs itself. Somebody who opened this link should not have to find a
     button before the page makes its point. */
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run();
  }, [run]);

  const cited = grounded.questions.map((q) => q.citation ?? "").filter(Boolean);

  return (
    <div className="relative z-10 flex h-full min-h-0 flex-1 flex-col overflow-y-auto">
      <main className="mx-auto flex w-full max-w-[78rem] flex-col gap-10 px-5 py-10 sm:px-8 sm:py-14">
        <header className="rise flex flex-col gap-5">
          <div className="flex items-center gap-2">
            <PixelTag className="press-on -rotate-2">watch it catch itself</PixelTag>
            <PixelSprite
              name="star"
              scale={2}
              className="press-on"
              style={{ ["--tilt" as string]: "12deg", ["--i" as string]: 1 }}
            />
            <AudioControls className="ml-auto" />
          </div>

          <h1 className="max-w-[18ch] font-hand text-[clamp(2.75rem,1.8rem+4vw,4.75rem)] leading-[0.92] tracking-tight text-ink">
            The same question, twice.
          </h1>

          {/* Kept to one paragraph. On a laptop the longer version read well;
              on a phone it filled the entire first screen, so the page opened
              on an essay about a demonstration instead of on the
              demonstration. The story is worth exactly the space it takes to
              make the stakes real, which is three sentences. */}
          <p className="max-w-[58ch] font-read text-[1.125rem] leading-[1.6] text-ink-soft">
            <strong className="font-semibold text-ink">Tritoflex</strong> is a rubber roofing
            compound, sprayed on cold. Somebody studying it here was told, over and over, that it is
            applied with a torch, and caught it only because he installs the stuff. Below, the same
            model is asked about it twice, live. One thing changes: whether it was given anything to
            read.
          </p>
        </header>

        <div className="rise grid gap-5 lg:grid-cols-2" style={{ ["--i" as string]: 1 }}>
          <Column
            panel={invented}
            kind="invented"
            heading="Given only the word"
            badge="AI · unchecked"
            sub="Nothing was checked. Every answer here is the model's own, and it has never heard of this."
          />
          <Column
            panel={grounded}
            kind="grounded"
            heading="Given the spec sheet"
            badge="From your notes"
            sub="Every question had to quote the material. The quote was checked on the server before you saw it."
          />
        </div>

        {/* The source, with the quotes lit up in it.

            This is the part that needs no trust. The column on the right can
            claim its citations are real; this hands the reader the paragraph
            and lets them find the words themselves. */}
        <section className="rise flex flex-col gap-3" style={{ ["--i" as string]: 2 }}>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <Label>What it was given to read</Label>
            <span className="font-sans text-[0.75rem] text-ink-faint">
              {cited.length > 0
                ? "Highlighted: the exact spans the questions on the right were traced to."
                : "The questions on the right quote this text."}
            </span>
          </div>

          <p className="prose-read whitespace-pre-wrap rounded-[3px] border border-line bg-page px-5 py-4 font-read text-[1rem] leading-[1.75] text-ink-soft sm:px-6 sm:py-5">
            {markSource(SOURCE, cited).map((piece, i) =>
              piece.cited ? (
                <mark
                  key={i}
                  className="rounded-[2px] bg-solid-tint px-0.5 text-ink"
                  style={{ ["--i" as string]: piece.n ?? 0 }}
                >
                  {piece.text}
                </mark>
              ) : (
                <span key={i}>{piece.text}</span>
              )
            )}
          </p>
        </section>

        <section className="rise flex flex-col gap-4" style={{ ["--i" as string]: 3 }}>
          <p className="max-w-[62ch] font-read text-[1.125rem] leading-[1.6] text-ink">
            Learnova does not claim to have solved this. It claims to know which of the two it is
            doing, and to say so on every screen, including on the marks it puts on your own
            explanation.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            {/* A link wearing the primary button's clothes, rather than a
                button inside a link. Nesting the two puts interactive markup
                inside interactive markup, and costs the thing that makes a
                door a door: middle-click, open in a tab, and the back button. */}
            <Link
              href="/round"
              className="btn inline-flex items-center gap-2 self-start rounded-[3px] bg-accent px-5 py-2.5 font-sans text-[0.875rem] font-semibold text-on-accent shadow-[0_1px_2px_rgb(20_26_38/0.12)] hover:bg-accent-hover hover:shadow-[0_8px_20px_-10px_var(--accent)]"
            >
              Try it yourself <Arrow />
            </Link>
            <GhostButton onClick={run}>Run both again</GhostButton>
            <Link
              href="/"
              className="font-sans text-[0.875rem] text-ink-faint underline underline-offset-4 hover:text-ink-soft"
            >
              Back to the start
            </Link>
          </div>

          <Credits />
        </section>
      </main>
    </div>
  );
}

/** One side of the comparison. */
function Column({
  panel,
  kind,
  heading,
  badge,
  sub,
}: {
  panel: Panel;
  kind: "invented" | "grounded";
  heading: string;
  badge: string;
  sub: string;
}) {
  const grounded = kind === "grounded";

  return (
    <section
      className={`flex min-w-0 flex-col gap-4 rounded-[4px] border-l-[5px] bg-sunk/50 p-5 sm:p-6 ${
        grounded ? "border-solid-mark" : "border-broken-mark"
      }`}
    >
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-read text-[1.25rem] leading-tight text-ink">{heading}</h2>
          <span
            style={{ fontVariationSettings: '"wdth" 88' }}
            className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-[3px] border px-1.5 py-1 font-sans text-[0.5625rem] font-semibold uppercase tracking-[0.08em] sm:px-2 ${
              grounded
                ? "border-solid-mark/40 bg-solid-tint text-solid-ink"
                : "border-line-strong bg-sunk text-ink-soft"
            }`}
          >
            <span aria-hidden>{grounded ? "❝" : "◇"}</span>
            {badge}
          </span>
        </div>
        <p className="font-sans text-[0.8125rem] leading-[1.6] text-ink-faint">{sub}</p>
      </div>

      {panel.state === "loading" ? (
        <div className="py-6">
          <Working label={grounded ? "Reading the source" : "Asking the model"} />
        </div>
      ) : (
        <>
          {/* Said before the answers, not after them, because it changes what
              the answers are evidence of. */}
          {panel.state === "recorded" && panel.note && (
            <p className="rounded-[3px] border border-line bg-page px-3 py-2 font-sans text-[0.75rem] leading-[1.55] text-ink-faint">
              {panel.note}
            </p>
          )}

          <ol className="flex flex-col gap-3">
            {panel.questions.map((q, i) => (
              <li
                key={i}
                style={{ ["--i" as string]: i }}
                className="split-land flex flex-col gap-1.5 rounded-[3px] bg-page px-4 py-3"
              >
                <span className="font-read text-[0.9375rem] leading-snug text-ink-soft">
                  {q.prompt}
                </span>
                <span
                  className={`font-read text-[1.0625rem] leading-snug ${
                    grounded ? "text-solid-ink" : "text-broken-ink"
                  }`}
                >
                  {q.answer}
                </span>
                {q.citation && (
                  <span className="mt-0.5 font-read text-[0.8125rem] italic leading-[1.5] text-ink-faint">
                    “{q.citation}”
                  </span>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
