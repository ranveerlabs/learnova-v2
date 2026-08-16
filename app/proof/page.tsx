import Link from "next/link";
import { AudioControls } from "../audio-controls";
import { PixelSprite, PixelTag } from "../paper";
import { Arrow, Credits, Label } from "../ui";
import { markSource } from "./highlight";
import { GROUNDED, INVENTED, RECORDED_ON, type Shown, SOURCE } from "./recorded";

/* The demonstration.

   Everything else in this app is built for a student. This page is built for
   somebody deciding in thirty seconds whether any of it is worth their
   attention, and it makes one argument: an AI study tool will invent material
   with complete confidence, you will not notice unless you already knew the
   answer, and that is the worst possible failure for a tool whose whole purpose
   is material you do not know yet.

   It does not argue that in prose. It shows the same model answering the same
   question twice, with one thing different between them: whether it was given
   anything to read.

   ── Why this is a recording and not a live call ────────────────────────────
   It used to run both calls live, on the theory that watching it happen beats
   being told about it. That theory was wrong for this page. A demonstration
   whose whole point is reliability cannot itself be unreliable, and a live one
   is: the key is shared and rate limited across everybody using it, the wait
   is several seconds of nothing on the one screen that has thirty, and a model
   is free to answer differently on the day and blunt the very contrast the
   page exists to draw.

   So it is fixed. Both answers below are verbatim, they are what the model
   actually said, and the page says when and which model rather than implying
   a freshness it no longer has. That last part is the whole discipline: a page
   complaining about confident unsourced output does not get to produce any.

   ── Why Tritoflex ──────────────────────────────────────────────────────────
   Because it is real, and because of HOW it fails. The model does not decline,
   hedge, or admit it has not heard of it. It returns a fluent, detailed,
   internally consistent biochemistry: a protein with an alpha helix, regulated
   by phosphorylation, implicated in cancer. Every word invented, and nothing
   about it looks invented. Somebody studying it here was told repeatedly that
   it is torch-applied, and caught it only because he installs the stuff. */

export default function Proof() {
  const cited = GROUNDED.map((q) => q.citation ?? "").filter(Boolean);

  return (
    <div className="relative z-10 flex h-full min-h-0 flex-1 flex-col overflow-y-auto">
      <main className="mx-auto flex w-full max-w-[76rem] flex-col gap-9 px-5 py-10 sm:px-8 sm:py-14">
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

          <h1 className="max-w-[16ch] font-hand text-[clamp(2.75rem,1.8rem+4vw,4.75rem)] leading-[0.92] tracking-tight text-ink">
            The same question, twice.
          </h1>

          <p className="max-w-[56ch] font-read text-[1.125rem] leading-[1.6] text-ink-soft">
            <strong className="font-semibold text-ink">Tritoflex</strong> is a rubber roofing
            compound, sprayed on cold. Somebody studying it here was told, over and over, that it is
            applied with a torch, and caught it only because he installs the stuff. Here is the same
            model asked about it twice. One thing changes: whether it was given anything to read.
          </p>
        </header>

        <div className="grid gap-5 lg:grid-cols-2">
          <Column
            kind="invented"
            heading="Given only the word"
            badge="AI · unchecked"
            sub="It has never heard of this. Nothing it says here was checked against anything."
            questions={INVENTED}
          />
          <Column
            kind="grounded"
            heading="Given the spec sheet"
            badge="From your notes"
            sub="Every question had to quote the material, and the quote was checked before you saw it."
            questions={GROUNDED}
          />
        </div>

        {/* The source, with the quotes lit up inside it.

            This is the part that asks for nothing on trust. The column above
            can claim its citations are real; this hands over the paragraph and
            lets a reader find the words themselves, which is the only version
            of the claim worth making on a page about not being taken on faith. */}
        <section className="rise flex flex-col gap-3" style={{ ["--i" as string]: 2 }}>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <Label>The whole of what it was given to read</Label>
            <span className="font-sans text-[0.75rem] text-ink-faint">
              Highlighted: the exact words each question on the right was traced back to.
            </span>
          </div>

          <p className="whitespace-pre-wrap rounded-[3px] border border-line bg-page px-5 py-4 font-read text-[1rem] leading-[1.8] text-ink-soft sm:px-6 sm:py-5">
            {markSource(SOURCE, cited).map((piece, i) =>
              piece.cited ? (
                <mark key={i} className="rounded-[2px] bg-solid-tint px-0.5 text-ink">
                  {piece.text}
                </mark>
              ) : (
                <span key={i}>{piece.text}</span>
              )
            )}
          </p>
        </section>

        <section className="rise flex flex-col gap-5" style={{ ["--i" as string]: 3 }}>
          <p className="max-w-[56ch] font-read text-[1.25rem] leading-[1.5] text-ink">
            Learnova does not claim to have fixed this. It claims to know which of the two it is
            doing, and to say so on every screen, including on the marks it puts on your own
            explanation.
          </p>

          {/* The way on lands in a grounded session, not on an empty field.

              This used to point at a bare /round, whose default is a topic and
              therefore the ungrounded half: somebody who had just read the case
              for grounding was handed the thing the case was against, and had
              to know to open a fold to get any. It carries the spec sheet over
              now, so the first run they play is one with real citations in it.

              The plain door is still here beside it, because a person who wants
              to type their own subject should not have to clear somebody else's
              paragraph out of the box first. */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <Link
              href="/round?demo"
              className="btn inline-flex items-center gap-2 rounded-[3px] bg-accent px-6 py-3 font-sans text-[0.9375rem] font-semibold text-on-accent shadow-[0_1px_2px_rgb(20_26_38/0.12)] hover:bg-accent-hover hover:shadow-[0_8px_20px_-10px_var(--accent)]"
            >
              Play a round on this spec sheet <Arrow />
            </Link>
            <Link
              href="/round"
              className="font-sans text-[0.875rem] text-ink-soft underline underline-offset-4 hover:text-ink"
            >
              Or study something of your own
            </Link>
            <Link
              href="/"
              className="font-sans text-[0.875rem] text-ink-faint underline underline-offset-4 hover:text-ink-soft"
            >
              Back to the start
            </Link>
          </div>

          {/* Where these answers came from, stated rather than implied.

              The page would read as live if it said nothing, and it is not. A
              recording presented as fresh would be exactly the move this page
              was built to complain about. */}
          <p className="max-w-[62ch] font-sans text-[0.75rem] leading-[1.6] text-ink-faint">
            Both columns are verbatim, recorded {RECORDED_ON} from{" "}
            <span className="font-mono">deepseek-v4-flash</span>, through the same route this app
            uses. Nothing changed between the two requests except whether the paragraph above was
            attached.
          </p>

          <Credits />
        </section>
      </main>
    </div>
  );
}

/** One side of the comparison. */
function Column({
  kind,
  heading,
  badge,
  sub,
  questions,
}: {
  kind: "invented" | "grounded";
  heading: string;
  badge: string;
  sub: string;
  questions: Shown[];
}) {
  const grounded = kind === "grounded";

  return (
    <section
      className={`rise flex min-w-0 flex-col gap-4 rounded-[4px] border-l-[5px] bg-sunk/50 p-5 sm:p-6 ${
        grounded ? "border-solid-mark" : "border-broken-mark"
      }`}
      style={{ ["--i" as string]: grounded ? 1.5 : 1 }}
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

      <ol className="flex flex-col gap-2.5">
        {questions.map((q, i) => (
          <li
            key={q.prompt}
            style={{ ["--i" as string]: i }}
            className="note-in flex flex-col gap-1 rounded-[3px] bg-page px-4 py-3"
          >
            <span className="font-read text-[0.9375rem] leading-snug text-ink-soft">{q.prompt}</span>
            <span
              className={`font-read text-[1.0625rem] leading-snug ${
                grounded ? "text-solid-ink" : "text-broken-ink"
              }`}
            >
              {q.answer}
            </span>

            {/* The slot under every answer, filled on one side and visibly
                empty on the other.

                Leaving the left column's answers with nothing beneath them
                would have been accurate and would have argued nothing: a
                reader scanning two columns reads the shorter one as tidier,
                not as unsupported. Drawing the empty slot is what turns the
                absence into the point. It is the same row, in the same place,
                on both sides, and one of them has a source in it. */}
            {q.citation ? (
              <span className="mt-0.5 font-read text-[0.8125rem] italic leading-[1.5] text-solid-ink/80">
                “{q.citation}”
              </span>
            ) : (
              <span className="mt-1 border-t border-dashed border-line-strong pt-1.5 font-sans text-[0.6875rem] uppercase tracking-[0.1em] text-ink-faint">
                nothing to check it against
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
