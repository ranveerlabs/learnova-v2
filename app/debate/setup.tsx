"use client";

import { useEffect, useRef, useState } from "react";
import { Elo } from "../elo";
import { standing, type Ladder } from "../standing";
import { Arrow, Label, PrimaryButton } from "../ui";
import {
  FORMATS,
  type Format,
  type Setup,
  type Side,
  type Tab,
  TIERS,
  type TierId,
} from "./types";

/* Agreeing what is about to be argued.

   ── One field and two buttons ─────────────────────────────────────────────
   This screen used to ask five questions before anybody could argue: which
   tab, what motion, which format, which side, which opponent. Every one of
   them had a good reason, and all five together were a form standing between
   somebody and the thing they came to do. Round Mode's front door settled
   this argument years earlier and settled it the other way: one field, no
   gate, and the better-but-heavier option folded away underneath.

   So the whole of the required path is now: type what you are arguing about,
   press the side you want. The side is not a separate control at all. It is
   which button you press, because you were going to press a button anyway and
   a question answered by an action you were already taking costs nothing.

   Everything else has a defensible default and lives in the fold: open debate,
   Varsity, and Public Forum if the fold is ever opened. Somebody preparing for
   a real tournament is exactly the person who will open a fold labelled
   "tournament formats", and they only have to do it once per round.

   What went, and why it is not missed: a coin-flip button for the side, which
   was authentic and was also a third button answering a question the other two
   already answer. */

/** Somewhere to start, for anybody who came to try this rather than with a
    motion already in mind.

    One list rather than one per tab. The competitive set was three full
    resolutions in tournament wording, each long enough to wrap the chip onto a
    second line, and the wording was doing no work: what makes a round a
    tournament round is the format and the rubric, both chosen elsewhere. Short
    enough to read at a glance is the whole job of a suggestion. */
const SUGGESTIONS = [
  "Homework should be abolished",
  "Remote work beats the office",
  "Social media did more harm than good",
];

/** What the fold was left set to last time.

    This screen is unmounted between rounds and remembers nothing on its own,
    so without it somebody drilling Lincoln-Douglas against Circuit got Public
    Forum against Varsity back on the second round, silently. Held by the page
    and handed back in, because the page is the thing that survives a round. */
export type Defaults = { tab: Tab; format: Format; tierId: TierId };

/** Novice, and this changed.

    It was Varsity, on the reasoning that Varsity was rated level with a
    beginner and a level first round is the only one whose result carries
    information either way. That was a good argument about a rating and a bad
    one about a person. Somebody opening this screen for the first time has
    never written a speech; the opponent they meet first should be the one
    whose brief says it misses some of what you said, not the one whose brief
    says it will punish a dropped argument.

    The rating argument no longer holds either. Varsity moved off level when
    the tiers were retuned, so a beginner is now a 43% underdog against it,
    and Novice is the tier that actually sits near a new player.

    Anybody who wants a harder round opens the fold, which is one click and
    stays open for the rest of the session. Nobody preparing for a tournament
    is going to be stopped by that; a fifteen-year-old who loses their first
    four rounds is going to be stopped by losing their first four rounds. */
export const DEFAULTS: Defaults = {
  tab: "casual",
  format: "Public Forum",
  tierId: "novice",
};

/** What is behind the number, for the tooltip.

    Both sources named, because one rating covering two quite different
    activities is the sort of thing somebody will want to check rather than
    take on trust, and "where did that come from" has a real answer. */
function record(book: Ladder): string {
  const parts: string[] = [];
  if (book.debates > 0) {
    parts.push(
      `${book.won}W ${book.lost}L ${book.drawn}D over ${book.debates} ${
        book.debates === 1 ? "debate" : "debates"
      }`
    );
  }
  if (book.runs > 0) {
    parts.push(`${book.runs} Round Mode ${book.runs === 1 ? "run" : "runs"}`);
  }

  const source = parts.length ? `${parts.join(", and ")}. ` : "";
  return `${source}One elo for both modes, on this device.`;
}

export function Setup({
  onBegin,
  initial,
}: {
  onBegin: (setup: Setup) => void;
  initial: Defaults;
}) {
  const [tab, setTab] = useState<Tab>(initial.tab);
  const [motion, setMotion] = useState("");
  const [format, setFormat] = useState<Format>(initial.format);
  const [tierId, setTierId] = useState<TierId>(initial.tierId);

  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    field.current?.focus();
  }, []);

  /* Read after mount for the same reason the study record is: local storage
     does not exist on the server, and rendering a rating during the server
     pass would make the first client render disagree with the HTML. */
  const [book, setBook] = useState<Ladder | null>(null);
  useEffect(() => {
    setBook(standing());
  }, []);

  const ready = motion.trim().length > 0;

  function begin(side: Side) {
    if (!ready) return;
    onBegin({
      tab,
      motion: motion.trim(),
      side,
      tierId,
      format: tab === "competitive" ? format : undefined,
    });
  }

  return (
    <section className="flex w-full flex-col gap-6 pb-4">
      <h1 className="max-w-[18ch] font-read text-[clamp(1.75rem,1.3rem+1.8vw,2.5rem)] leading-[1.1] tracking-[-0.015em] text-ink">
        Argue it against someone who is trying to win.
      </h1>

      {/* The one required field, and the two ways out of it.

          A form rather than loose elements, so Enter works. Enter takes the
          first submit button, which is "Argue for": somebody who types a
          motion and hits return has said what they think, and the affirmative
          is the side that reads as agreeing with a sentence you just wrote. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          begin("Pro");
        }}
        className="flex flex-col gap-3"
      >
        <input
          ref={field}
          value={motion}
          onChange={(e) => setMotion(e.target.value)}
          placeholder="What are you arguing about?"
          aria-label="What are you arguing about?"
          className="leaf w-full rounded-[3px] border border-line bg-page font-read text-[1.125rem] text-ink caret-accent placeholder:text-ink-faint"
          style={{ padding: "0.875rem 1.125rem" }}
        />

        <div className="flex flex-wrap items-center gap-3">
          <PrimaryButton type="submit" disabled={!ready}>
            Argue for <Arrow />
          </PrimaryButton>
          <PrimaryButton type="button" onClick={() => begin("Con")} disabled={!ready}>
            Argue against <Arrow />
          </PrimaryButton>
        </div>
      </form>

      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => {
              setMotion(suggestion);
              field.current?.focus();
            }}
            className="chip min-h-[2.25rem] max-w-full truncate rounded-[3px] border border-line px-3 py-1.5 text-left font-sans text-[0.75rem] text-ink-soft hover:border-accent hover:text-ink"
          >
            {suggestion}
          </button>
        ))}
      </div>

      {/* The rating.

          One number for both modes now, so it says so in the tooltip rather
          than on the screen: what a person needs from this on the way into a
          round is where they stand, and the accounting behind it is for
          whoever goes looking. Starting at zero says "everyone starts here"
          without a sentence.

          "Elo", not "rating". It is an Elo and calling it one says more in
          four letters than "rating" says in six: anybody who has met a rated
          game knows immediately that the number is relative to the opposition
          and that beating somebody stronger is worth more. */}
      {book && <Elo rating={book.rating} title={record(book)} />}

      {/* Open already if anything in it has been changed from the default,
          so a returning tournament debater can see their format is still set
          rather than having to open a fold to find out. */}
      <Options
        open={tab !== DEFAULTS.tab || tierId !== DEFAULTS.tierId}
        tab={tab}
        onTab={setTab}
        format={format}
        onFormat={setFormat}
        tierId={tierId}
        onTier={setTierId}
      />
    </section>
  );
}

/** Everything that has a good default.

    Closed unless somebody wants it, and it announces what is inside rather
    than saying "options", because the two people who need it are somebody
    preparing for a named format and somebody who wants a harder opponent, and
    both should be able to tell from the summary line that this is their door.

    It stays open once opened, which is the browser's own behaviour for a
    details element and the right one here: anybody who set a format is going
    to want to see it still set on the next round. */
function Options({
  open,
  tab,
  onTab,
  format,
  onFormat,
  tierId,
  onTier,
}: {
  open: boolean;
  tab: Tab;
  onTab: (t: Tab) => void;
  format: Format;
  onFormat: (f: Format) => void;
  tierId: TierId;
  onTier: (t: TierId) => void;
}) {
  /* Frozen at mount, so this decides whether the fold STARTS open and never
     argues with somebody who then closes it. React only touches a DOM
     property when the value it renders changes, and this one never does. */
  const [startOpen] = useState(open);

  return (
    <details open={startOpen} className="group flex flex-col gap-4 border-t border-line pt-4">
      <summary
        style={{ fontVariationSettings: '"wdth" 88' }}
        className="inline-flex cursor-pointer list-none items-center gap-1.5 font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-ink-faint transition-colors hover:text-ink-soft"
      >
        <span aria-hidden className="inline-block transition-transform group-open:rotate-90">
          ›
        </span>
        Tournament formats and opponent strength
      </summary>

      {/* Three questions, three rows of buttons, no prose at all.

          Every one of these carried a line explaining it: what the two tabs
          judge differently, that the ballot follows the chosen format and no
          other, and what the selected opponent does to you. All three were
          accurate and all three were text on a screen somebody opened to press
          a button. The labels carry it, and what is left of the explanation is
          on the buttons themselves as a title. */}
      <div className="mt-4 flex flex-col gap-5">
        <Choice
          label="Judged as"
          options={[
            {
              id: "casual",
              name: "Open debate",
              title: "No format rules. Judged on whether the argument holds up.",
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
              title: "The ballot is written by these conventions and no others.",
            }))}
            value={format}
            onPick={(v) => onFormat(v as Format)}
          />
        )}

        {/* Novice is the default. See DEFAULTS above for why it stopped being
            Varsity. */}
        <Choice
          label="Opponent"
          options={TIERS.map((t) => ({ id: t.id, name: t.name, title: t.brief }))}
          value={tierId}
          onPick={(v) => onTier(v as TierId)}
        />
      </div>
    </details>
  );
}

/** A question with two to four answers, as a row of buttons.

    Every choice inside the fold is one of these, including the opponent, which
    used to be its own stack of cards with a paragraph in each. One shape for
    one kind of question is most of what took the clutter off this screen; the
    explanation each one used to print is the button's `title` now, which is
    where an explanation belongs when the label already says enough. */
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
            className={`btn inline-flex min-h-[2.5rem] items-center rounded-[3px] border-2 px-3.5 py-1.5 font-sans text-[0.875rem] font-medium transition-colors ${
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
