"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { applyRound, type RatingChange } from "@/lib/elo";
import { AudioControls } from "../audio-controls";
import { isBusy, postJSON, postStream } from "../client";
import { play } from "../tone";
import {
  Arrow,
  Aside,
  GhostButton,
  Label,
  Leaf,
  Notice,
  PrimaryButton,
  Waiting,
  Wordmark,
  Working,
} from "../ui";
import { recordDebate, standing } from "../standing";
import { Ballot as BallotCard } from "./ballot";
import { DEFAULTS, type Defaults, Setup as SetupScreen } from "./setup";
import {
  type Ballot,
  SPEECH_ORDER,
  type Setup,
  type Speech,
  tier,
  type Turn,
  worthJudging,
} from "./types";

/* Debate mode.

   A second mode rather than a sixth round, and the reason is who it is for.
   Round Mode's ladder ends at "say it in your own words", which is the top of
   what a study session can ask. This asks something else of somebody else: it
   is practice at holding a position against an opponent who is trying to take
   it off you, and the competitive half of it is aimed at people preparing for
   real tournaments with real formats. Those are not the same product and
   pretending they were would have made both of them vaguer.

   The shape is: agree what is being argued, argue it for four speeches each,
   then read the ballot. The rating moves in `lib/elo.ts` and nowhere else.

   This file is the shell and the traffic. What the opponent sounds like is
   decided in app/api/debate/route.ts and enforced in the scrub beside it. */

type Phase = "setup" | "arguing" | "judging" | "ballot";

/** One width for the whole mode.

    The three screens used to set their own, at 46, 58 and 52 rem, which was
    invisible until the header strip became one strip across all three: a bar
    that changes width when the screen under it changes is a bar that looks
    like it moved. */
const SHELL = "mx-auto flex w-full max-w-[54rem] flex-col";

export default function DebatePage() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [setup, setSetup] = useState<Setup | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wasBusy, setWasBusy] = useState(false);
  const [ballot, setBallot] = useState<Ballot | null>(null);
  const [change, setChange] = useState<RatingChange | null>(null);
  /** The speech being given right now, as far as it has got. Held apart from
      `turns` because it is not a turn yet: it is not in the transcript, it is
      not in the prompt, and if the stream dies half way through it never
      becomes one. */
  const [live, setLive] = useState("");

  /* The audio controls own the music and the tones now, on every screen of
     the app. `play` below consults the same setting itself, so nothing here
     has to carry a `sound` flag around to guard it. */

  /** Which speech is being written. Four each way, alternating, and the
      student always opens: somebody who has just decided what to argue should
      not have to read a speech before they get to make one. */
  const round = Math.floor(turns.length / 2);
  const speech: Speech = SPEECH_ORDER[Math.min(round, SPEECH_ORDER.length - 1)];
  const finished = turns.length >= SPEECH_ORDER.length * 2;

  const transcript = useRef<HTMLDivElement>(null);
  useEffect(() => {
    transcript.current?.scrollTo({ top: transcript.current.scrollHeight, behavior: "smooth" });
  }, [turns, thinking, live]);

  /** What the last round was set up as.

      Kept here rather than in the setup screen, because the setup screen is
      unmounted between rounds and remembers nothing. Without it, finishing a
      tournament round in Lincoln-Douglas against Circuit and pressing "Another
      round" put you back on Open debate against Varsity, where the rating on
      display is the casual one: the format was silently discarded and the
      number just earned appeared to vanish. Somebody practising a format is
      practising it more than once. */
  const [last, setLast] = useState<Defaults>(DEFAULTS);

  const begin = useCallback((chosen: Setup) => {
    setSetup(chosen);
    /* Updated from the previous value rather than by reading `last` here: this
       callback is built once, so naming `last` inside it would capture the
       value it had on the first render and hold that forever. */
    setLast((prev) => ({
      tab: chosen.tab,
      /* A casual round carries no format, and must not wipe the one a
         tournament round set. */
      format: chosen.format ?? prev.format,
      tierId: chosen.tierId,
    }));
    setTurns([]);
    setDraft("");
    setBallot(null);
    setChange(null);
    setError(null);
    setPhase("arguing");
  }, []);

  /** Send the speech that has been written, then let the opponent answer it.

      The student's turn is committed to the transcript before the request
      goes out, so a reply that fails leaves their speech where they wrote it
      rather than losing it along with the round.

      ── The opponent speaks rather than replies ──────────────────────────
      The answer arrives a sentence at a time and goes on screen as it lands,
      which is the single biggest thing separating this from a form that
      submits. What was there before was ten to twenty seconds of a pulsing
      dot followed by a finished block of text, and that is not what being
      argued at is like: somebody speaking to you starts before they have
      finished thinking, and you read them while they do it.

      Nothing is rewritten once it is on screen. The route holds each sentence
      back until it is complete and cleans it there, so what lands is final. */
  async function send() {
    if (!setup || !draft.trim() || thinking || phase !== "arguing") return;

    const mine: Turn = { speaker: "user", speech, text: draft.trim() };
    const withMine = [...turns, mine];

    setTurns(withMine);
    setDraft("");
    setError(null);
    setWasBusy(false);
    setThinking(true);
    setLive("");

    try {
      const text = await postStream(
        "/api/debate",
        { action: "reply", setup, turns: withMine, speech },
        (chunk) => setLive((said) => said + chunk)
      );

      /* An empty body means the reply was packaging and nothing else, or the
         stream died before it said anything. Either way there is no speech to
         put in the transcript and the student needs to know why the round did
         not move. */
      if (!text.trim()) {
        throw new Error("Your opponent lost their train of thought. Send it again.");
      }

      setTurns([...withMine, { speaker: "opponent", speech, text: text.trim() }]);
      /* They have finished speaking. A nudge to look up, nothing more: this
         fires four times a round and is the quietest thing in tone.ts. */
      play("speech");
    } catch (err) {
      setWasBusy(isBusy(err));
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setThinking(false);
      setLive("");
    }
  }

  /** Close the round: judge it, then move the rating.

      The two are deliberately in this order and deliberately separate. The
      model returns a winner, a margin and ten dimension scores; the rating is
      then computed here, from the rating we already held and the tier's
      declared strength, by arithmetic the model never sees and cannot get
      wrong. Asking it to do both in one breath would produce a number that
      looks like a rating and is a guess. */
  async function judge() {
    /* The phase check, not just `thinking`, and it is the whole guard. Judging
       does not set `thinking`, so a second click on the ballot button used to
       start a second judge call, and a second judge call means a second
       `recordDebate`: the same debate charged to the elo twice, off one
       impatient double tap, with nothing on screen to say it happened. */
    if (!setup || phase !== "arguing") return;

    setPhase("judging");
    setError(null);
    setWasBusy(false);

    try {
      const { ballot: verdict } = await postJSON<{ ballot: Ballot }>("/api/debate", {
        action: "judge",
        setup,
        turns,
      });

      const moved = applyRound({
        user: standing().rating,
        opponent: tier(setup.tierId).strength,
        outcome: verdict.winner,
        margin: verdict.margin,
      });
      recordDebate(moved.after, verdict.winner);

      setBallot(verdict);
      setChange(moved);
      setPhase("ballot");
      /* The gavel. The one moment in the mode that has been earned rather
         than clicked, and it used to land in silence. */
      play("gavel");
    } catch (err) {
      setWasBusy(isBusy(err));
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("arguing");
    }
  }

  /* The strip across the top of all three screens. Same width, same height,
     same place, so switching screens does not move it. */
  const bar = (
    <div className="mb-5 flex shrink-0 items-center justify-between gap-3">
      {/* The wordmark is the way back to the landing, so there is no second
          link beside it saying the same thing. */}
      <Wordmark mode="Debate" />
      <AudioControls />
    </div>
  );

  /* ── Setup ───────────────────────────────────────────────────────────── */
  if (phase === "setup") {
    return (
      <div className={SHELL}>
        {bar}
        <SetupScreen onBegin={begin} initial={last} />
      </div>
    );
  }

  /* ── The ballot ──────────────────────────────────────────────────────── */
  if (phase === "ballot" && ballot && change && setup) {
    return (
      <div className={SHELL}>
        {bar}
        <BallotCard
          ballot={ballot}
          change={change}
          setup={setup}
          onAgain={() => setPhase("setup")}
        />
      </div>
    );
  }

  /* ── Arguing ─────────────────────────────────────────────────────────── */
  const judging = phase === "judging";
  const opponent = tier(setup!.tierId);
  /* The same test the route applies, so the button and the server never
     disagree about whether there is a round here. */
  const judgeable = worthJudging(turns);

  return (
    <div className={`${SHELL} gap-4`}>
      {bar}

      {/* The motion and where the round has got to, and nothing else.

          The label used to also name the opponent, which is on every card
          they speak in, and repeat the format, which was chosen a screen ago
          and does not change. What a person actually needs here is what they
          are arguing and which side of it they are on. */}
      <header className="flex shrink-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <Label>You are {setup && setup.side === "Pro" ? "for it" : "against it"}</Label>
          <p className="mt-1 font-read text-[clamp(1.0625rem,0.9rem+0.6vw,1.375rem)] leading-tight text-ink">
            {setup?.motion}
          </p>
        </div>
        <SpeechRail at={round} finished={finished} />
      </header>

      {/* The round so far, scrolling inside itself and capped against the
          viewport rather than against the page.

          The cap is the whole trick. Left to grow, the transcript pushes the
          box you write in further down the screen with every speech, so by the
          fourth one the student is scrolling up to read what was said and back
          down to answer it. Capped, the compose box stays where it was and the
          argument scrolls past it, which is the shape every messaging app
          arrived at for the same reason. Half the viewport on a phone still
          shows two speeches. */}
      <div
        ref={transcript}
        className="flex max-h-[52vh] min-h-[8rem] flex-col gap-3 overflow-y-auto rounded-[3px] border border-line bg-sunk/40 p-3"
      >
        {turns.length === 0 && (
          <p className="m-auto max-w-[34ch] text-center font-sans text-[0.875rem] leading-[1.6] text-ink-faint">
            You open.
          </p>
        )}

        {turns.map((turn, i) => (
          <Said key={i} turn={turn} tierName={opponent.name} />
        ))}

        {/* The speech happening right now.

            The same card the finished ones use, so a speech does not jump or
            change shape at the moment it ends. Before the first sentence
            lands it is the card with the pulse in it and nothing else, which
            is what says the opponent has stood up and is about to speak. */}
        {thinking && (
          <Said
            turn={{ speaker: "opponent", speech, text: live }}
            tierName={opponent.name}
            speaking
          />
        )}
      </div>

      {error && (wasBusy ? <Aside>{error}</Aside> : <Notice>{error}</Notice>)}

      {/* Write, or close the round.

          Enter sends and Shift+Enter starts a new line, which is what every
          messaging app does and therefore what everybody's hands already
          expect. It was Ctrl+Enter, on the reasoning that a speech has
          paragraphs in it and Enter should mean Enter; that reasoning was
          about a document, and this is a conversation. A speech that needs a
          second paragraph can still have one.

          The box is three rows rather than four for the same reason: it is a
          message box, not a page. */}
      <div className="flex shrink-0 flex-col gap-2">
        {/* Judging takes the compose area rather than sitting beside it.

            This is the longest wait in the app: a whole transcript read and a
            structured ballot written, and the only thing that used to say so
            was a disabled button whose label had changed to "Judging…". A
            button that does not move is a caption. It is also the one wait
            where there is genuinely nothing for the student to do, which is
            what makes taking the space right rather than a bigger spinner:
            the box they were typing in is no longer a box they can type in,
            and leaving it there greyed out invites them to try. */}
        {judging ? (
          <Waiting
            title="Judging the round"
            sub="Both sides, with no names on them, from the top."
          />
        ) : !finished ? (
          <>
            {/* Keyed on the turn count so it remounts when the opponent
                stops speaking, which is what puts the cursor back in the box
                without anybody reaching for it. There is nothing to lose in
                the remount: the draft lives out here and has just been
                cleared. Between a speech landing and being able to type the
                answer there should be no step at all. */}
            <Leaf
              key={turns.length}
              value={draft}
              onChange={setDraft}
              minRows={3}
              placeholder={`Your ${speech.toLowerCase()}…`}
              onSubmit={send}
              autoFocus
            />

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <PrimaryButton onClick={send} disabled={thinking || !draft.trim()}>
                {thinking ? "Waiting…" : "Send"} {!thinking && <Arrow />}
              </PrimaryButton>
              {/* Ending the round is only offered once there is a round to
                  end. The server refuses to judge a transcript nobody argued
                  in, and a button that offers a thing the server will decline
                  is a button that teaches people the app is broken. The title
                  says why it is greyed rather than leaving them to guess. */}
              {turns.length >= 2 && (
                <GhostButton
                  onClick={judge}
                  disabled={thinking || !judgeable}
                  title={judgeable ? undefined : "Make an argument first, then the ballot has something to mark."}
                >
                  End the round
                </GhostButton>
              )}
            </div>
          </>
        ) : (
          <PrimaryButton
            onClick={judge}
            disabled={!judgeable}
            title={judgeable ? undefined : "Make an argument first, then the ballot has something to mark."}
          >
            Get the ballot <Arrow />
          </PrimaryButton>
        )}
      </div>
    </div>
  );
}

/** Where the round has got to.

    Dots and a name, the same grammar as Round Mode's ladder: a filled square
    is a speech that has been given, a ring is the one being written, a faint
    dot is still ahead. Shape rather than colour alone, for the same reason it
    is over there.

    It replaced "Constructive · 1 of 4", which said the same thing in a way
    that made the reader do the arithmetic to find out how much was left. */
function SpeechRail({ at, finished }: { at: number; finished: boolean }) {
  return (
    <nav aria-label="Speeches" className="flex min-w-0 shrink-0 items-center gap-2.5">
      <span className="flex shrink-0 items-center gap-1.5">
        {SPEECH_ORDER.map((name, i) => {
          const done = finished || i < at;
          const current = !finished && i === at;
          return (
            <span
              key={name}
              title={name}
              aria-label={`${name}: ${done ? "given" : current ? "current" : "ahead"}`}
              aria-current={current ? "step" : undefined}
              className="grid h-2.5 w-2.5 place-items-center"
            >
              {done ? (
                <span className="block h-2.5 w-2.5 rounded-[2px] bg-solid-mark" />
              ) : current ? (
                <span className="block h-2.5 w-2.5 rounded-full border-[2px] border-accent" />
              ) : (
                <span className="block h-1.5 w-1.5 rounded-full bg-line-strong" />
              )}
            </span>
          );
        })}
      </span>
      <span
        style={{ fontVariationSettings: '"wdth" 88' }}
        className={`truncate font-sans text-[0.625rem] font-semibold uppercase tracking-[0.12em] ${
          finished ? "text-solid-ink" : "text-ink-soft"
        }`}
      >
        {finished ? "Round over" : SPEECH_ORDER[Math.min(at, SPEECH_ORDER.length - 1)]}
      </span>
    </nav>
  );
}

/** One speech in the transcript. The two sides are told apart by which edge
    the rule sits on and by the name above it, never by colour alone.

    `speaking` marks the one still being given. It changes nothing about the
    shape of the card, only what sits at the end of the words: the same meter
    the app uses everywhere else for "this is still happening", parked after
    the last sentence that has landed.

    There was a word "speaking" in the label too, and it went. The meter is
    already saying it, in the one mark this app uses for waiting, and a label
    that repeats an indicator is a label that has to be read to learn nothing. */
function Said({
  turn,
  tierName,
  speaking = false,
}: {
  turn: Turn;
  tierName: string;
  speaking?: boolean;
}) {
  const mine = turn.speaker === "user";
  return (
    <div
      className={`rounded-[3px] border-l-[3px] bg-page px-3.5 py-2.5 ${
        mine ? "border-accent" : "border-line-strong"
      }`}
      role={speaking ? "status" : undefined}
      aria-live={speaking ? "polite" : undefined}
    >
      <p
        style={{ fontVariationSettings: '"wdth" 88' }}
        className="mb-1 font-sans text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-ink-faint"
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
