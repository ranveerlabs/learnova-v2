"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AudioControls } from "../audio-controls";
import { isBusy, postJSON, postStream } from "../client";
import { play } from "../tone";
import { Aside, GhostButton, Leaf, Notice, PrimaryButton, Waiting, Working, Wordmark } from "../ui";
import { PixelTag } from "../paper";
import { Ballot as BallotCard } from "./ballot";
import { DEFAULTS, type Defaults, Setup as SetupScreen } from "./setup";
import { Gavel, Opening, Said, SpeechRail } from "./transcript";
import {
  type Ballot,
  MIN_WORDS_TO_JUDGE,
  SPEECH_ORDER,
  type Setup,
  type Speech,
  tier,
  type Turn,
  wordsSpoken,
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
   then read the ballot. What the round is worth is the ballot, and nothing
   outside the round is kept or moved by it.

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

  /* The eighth speech lands and the round goes to the judge.

     There was a "Get the ballot" button here. Every round in the mode ended
     the same way: the last speech arrives, there is nothing left to write,
     nothing left to decide, and the screen asks one more time whether you
     would like the thing you have been working towards for eight speeches.
     A button is a question, and the only answer anybody was ever going to
     give is yes.

     A real round does not work that way either. The final focus ends and the
     judge starts writing; nobody in the room is asked to confirm it.

     Guarded by a ref rather than by `phase`, because `judge` sets the phase
     asynchronously and a re-render in between would fire it twice. Ending
     early still has its own button: that one IS a decision, and it is the
     one place a person is choosing something. */
  const sent = useRef(false);
  useEffect(() => {
    if (!finished || sent.current || phase !== "arguing" || thinking) return;
    if (!worthJudging(turns)) return;
    sent.current = true;
    void judge();
  });

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
      /* A tier is always chosen on this screen. The fallback is for the
         type, which allows an absent one now so that a live 1v1 round can
         say it has no opponent strength — see `Setup` in ./types. */
      tierId: chosen.tierId ?? prev.tierId,
    }));
    setTurns([]);
    setDraft("");
    setBallot(null);
    setError(null);
    /* A new round has its own eighth speech to send. */
    sent.current = false;
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

  /** Close the round: judge it, and show the verdict.

      There used to be arithmetic after the judging, and then a tally after
      the arithmetic. The judge returned a winner and a margin, `applyRound`
      turned them into an elo movement against the tier's declared strength,
      and the ballot printed the new number; later that became a lifetime
      won/lost/drawn record kept on the device. Both are gone, along with
      lib/elo.ts and app/standing.ts. A round is judged, read, and over.

      The margin still comes back on the ballot and is still used: it is what
      the ballot's own wording and the scoresheet are built from. It simply no
      longer scales anything. */
  async function judge() {
    /* The phase check, not just `thinking`, and it is the whole guard. Judging
       does not set `thinking`, so a second click on the ballot button used to
       start a second judge call: two rounds of the model's time and a second
       verdict landing over the first, off one impatient double tap. */
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

      setBallot(verdict);
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
  if (phase === "ballot" && ballot && setup) {
    return (
      <div className={SHELL}>
        {bar}
        <BallotCard ballot={ballot} setup={setup} onAgain={() => setPhase("setup")} />
      </div>
    );
  }

  /* ── Arguing ─────────────────────────────────────────────────────────── */
  const judging = phase === "judging";
  const opponent = tier(setup!.tierId);
  /* The same test the route applies, so the button and the server never
     disagree about whether there is a round here. The count beside it is only
     ever shown at the end, and only when it is the reason there is no ballot. */
  const judgeable = worthJudging(turns);
  const spoken = wordsSpoken(turns);

  return (
    <div className={`${SHELL} gap-4`}>
      {bar}

      {/* The motion and where the round has got to, and nothing else.

          The label used to also name the opponent, which is on every card
          they speak in, and repeat the format, which was chosen a screen ago
          and does not change. What a person actually needs here is what they
          are arguing and which side of it they are on.

          The side is the tag from the slab you pressed, in the same colour it
          was pressed in: mint for it, pink against. That is the one thing on
          this screen a person can lose track of four speeches in, and it now
          carries over from the decision that set it rather than being a fresh
          grey caption that has to be read. */}
      <header className="flex shrink-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <PixelTag tone={setup && setup.side === "Pro" ? "mint" : "pink"}>
            you are {setup && setup.side === "Pro" ? "for it" : "against it"}
          </PixelTag>
          <p className="mt-2 font-read text-[clamp(1.0625rem,0.9rem+0.6vw,1.375rem)] leading-tight text-ink">
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
        {turns.length === 0 && <Opening said="You open." />}

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
              {/* Send: the speech leaves. The arrow goes off the right edge
                  and the next one comes back in from the left, which is the
                  one gesture on this screen that is about what the button
                  does rather than about it being a button. */}
              <PrimaryButton onClick={send} disabled={thinking || !draft.trim()}>
                {thinking ? "Waiting…" : "Send"}
                {!thinking && (
                  <span aria-hidden className="thrown">
                    →
                  </span>
                )}
              </PrimaryButton>
              {/* Ending early is only offered once ending early would work.

                  It used to appear the moment there were two turns and sit
                  there greyed out until the round was worth judging, with a
                  `title` saying why. That is not an explanation on a phone,
                  where there is no hover and therefore no title at all: it is
                  a dead control with nothing to say for itself, on the screen
                  where a student is most likely to think they have finished.

                  This is a shortcut, not the way out, so the honest thing is
                  simply not to offer it yet. Nothing is lost by its absence,
                  because the round continues and the button arrives the moment
                  there is a round to end. What must never happen is a student
                  pressing something that looks available and getting nothing,
                  which is how an app teaches people it is broken. */}
              {turns.length >= 2 && judgeable && (
                <GhostButton onClick={judge} disabled={thinking}>
                  End the round <Gavel />
                </GhostButton>
              )}
            </div>
          </>
        ) : judgeable ? (
          /* Nothing to press. The round is over and it has already gone to
             the judge; what is on screen while it does is `judging`, above.
             This branch is what a full round looks like in the instant
             between the last speech landing and the effect firing. */
          <Working label="Sending it to the judge" />
        ) : (
          /* The round is over and there is not enough in it to mark.

             This is the one place the greyed-out button could not simply be
             removed, because at the end of a round it is the only control on
             the screen: the compose box is gone, every speech has been given,
             and a student looking at a dead button with an invisible tooltip
             has no way forward and no idea why. Four speeches of "no" reaches
             this exactly, and reached a dead end.

             So it says what happened, in words, on the screen, and then hands
             over a way on. Both halves matter. An explanation with no exit is
             still a trap, and an exit with no explanation teaches somebody
             that the round they just played was thrown away for no reason.

             What it deliberately does NOT do is nag during the round. A word
             counter ticking away beside the box was tried and cut, because it
             turns writing an argument into hitting a target. The bar only
             needs mentioning at the one moment it actually decides
             something. */
          <div className="flex flex-col gap-3">
            <Notice>
              There is not enough here to judge. You wrote {spoken}{" "}
              {spoken === 1 ? "word" : "words"} across the round, and a ballot needs at least{" "}
              {MIN_WORDS_TO_JUDGE}, which is about one real sentence of argument. Nothing was sent
              to the judge and your rating has not moved.
            </Notice>
            <div className="flex flex-wrap items-center gap-3">
              <PrimaryButton onClick={() => setPhase("setup")}>
                Start a new round
                <span aria-hidden className="rewound">
                  ↺
                </span>
              </PrimaryButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
