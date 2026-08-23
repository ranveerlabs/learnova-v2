"use client";

import { Working } from "../ui";
import { SPEECH_ORDER, type Speech, type Turn } from "./types";

/* The two pieces of a round that both debate modes draw identically.

   They were inside `page.tsx` until there was a second screen that needed
   them. Nothing about either one knows whether the other side is a model or
   a person: a speech is a speech, and where the round has got to is where
   the round has got to. Copying them into the live room would have meant two
   transcripts that looked the same on the day they were written. */

/** Where the round has got to.

    Blocks and a name, the same grammar as Round Mode's ladder: a filled block
    is a speech that has been given, an outlined one is being written, an empty
    slot is still ahead. Shape rather than colour alone, for the same reason it
    is over there.

    It replaced "Constructive · 1 of 4", which said the same thing in a way
    that made the reader do the arithmetic to find out how much was left.

    Square and hard-edged rather than dots, and set in the pixel face, because
    this sits at the top of the one screen the mode spends all its time on and
    a row of soft grey dots was the quietest possible way to say how much of
    the round is left. Four blocks filling up is a progress bar somebody can
    read from the far side of the desk. */
export function SpeechRail({ at, finished }: { at: number; finished: boolean }) {
  return (
    <nav aria-label="Speeches" className="flex min-w-0 shrink-0 items-center gap-2.5">
      <span className="flex shrink-0 items-center gap-[3px]">
        {SPEECH_ORDER.map((name, i) => {
          const done = finished || i < at;
          const current = !finished && i === at;
          return (
            <span
              key={name}
              title={name}
              aria-label={`${name}: ${done ? "given" : current ? "current" : "ahead"}`}
              aria-current={current ? "step" : undefined}
              className={`block h-3.5 w-3 rounded-[1px] ${
                done
                  ? "bg-solid-mark"
                  : current
                    ? "listening border-2 border-accent bg-accent-wash"
                    : "border-2 border-line-strong"
              }`}
            />
          );
        })}
      </span>
      <span
        className={`truncate font-pixel text-[0.5625rem] leading-none ${
          finished ? "text-solid-ink" : "text-ink-soft"
        }`}
      >
        {finished ? "Round over" : SPEECH_ORDER[Math.min(at, SPEECH_ORDER.length - 1)]}
      </span>
    </nav>
  );
}

/** One speech in the transcript. The two sides are told apart by which side
    of the transcript they sit on, which edge the rule is on, and the name
    above the words, never by colour alone.

    ── Why the two sides are on opposite sides ──────────────────────────────
    Both speakers used to be the same card at the same width in one stack, so
    a transcript of eight speeches was a column of identical blocks and the
    only thing saying whose was whose was a nine-pixel label. That is a chat
    log, and a debate is not a chat log: it is two people at opposite ends of
    a room taking it in turns, and which end a speech came from is the first
    thing you need to know about it.

    So yours sits against the right edge and theirs against the left, at
    eighty-eight percent width so the offset is visible at a glance rather
    than being an alignment you have to measure. The rule moves to the outside
    edge of each, which is the wall the speaker is standing at. Nothing here
    depends on hue: the label still names the speaker, and the layout says it
    again for anybody reading at speed.

    `speaking` marks the one still being given. It changes nothing about the
    shape of the card, only what sits at the end of the words: the same meter
    the app uses everywhere else for "this is still happening", parked after
    the last sentence that has landed.

    There was a word "speaking" in the label too, and it went. The meter is
    already saying it, in the one mark this app uses for waiting, and a label
    that repeats an indicator is a label that has to be read to learn nothing. */
export function Said({
  turn,
  tierName,
  speaking = false,
}: {
  turn: Turn;
  /** What to call the other side. A tier in single-player, a person in a
      live room, and the card does not care which. */
  tierName: string;
  speaking?: boolean;
}) {
  const mine = turn.speaker === "user";
  return (
    <div
      className={`w-[88%] rounded-[3px] bg-page px-3.5 py-2.5 ${
        mine ? "self-end border-r-[3px] border-accent" : "self-start border-l-[3px] border-line-strong"
      }`}
      role={speaking ? "status" : undefined}
      aria-live={speaking ? "polite" : undefined}
    >
      <p
        className={`mb-1 font-pixel text-[0.5rem] leading-none text-ink-faint ${
          mine ? "text-right" : ""
        }`}
      >
        {mine ? "You" : tierName} · {turn.speech}
      </p>
      <p className="whitespace-pre-wrap font-read text-[1rem] leading-[1.6] text-ink">
        {turn.text}
        {/* The same meter the rest of the app waits with, parked after the
            last sentence that landed. Before the first token there is nothing
            else in the card and it is the only thing in it, which is what
            says the opponent has stood up and is about to speak. */}
        {speaking && (
          <span className="ml-1.5">
            <Working />
          </span>
        )}
      </p>
    </div>
  );
}

/** An empty transcript, in the words that fit who is about to speak. */
export function Opening({ said }: { said: string }) {
  return (
    <p className="m-auto max-w-[34ch] text-center font-sans text-[0.875rem] leading-[1.6] text-ink-faint">
      {said}
    </p>
  );
}

/* There was a gavel here, and the argument for it was that every button
   which ends the arguing carries it and no other button in the mode does.
   That was true of two buttons. Then the ballot started sending itself and
   there was one left — "End the round", the shortcut — and a mark that
   appears on exactly one control is not a vocabulary, it is an ornament on
   that control. The sound stays: `gavel` in tone.ts still lands with the
   verdict, which is the moment that was always worth marking. */

export type { Speech };
