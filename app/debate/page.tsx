"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { applyRound, type RatingChange } from "@/lib/elo";
import { isBusy, postJSON } from "../client";
import { Arrow, Aside, GhostButton, Label, Leaf, Notice, PrimaryButton } from "../ui";
import { Ballot as BallotCard } from "./ballot";
import { poolFor, recordRound } from "./rating";
import { Setup as SetupScreen } from "./setup";
import {
  type Ballot,
  SPEECH_ORDER,
  type Setup,
  type Speech,
  tier,
  type Turn,
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
   then read the ballot. The rating moves in `lib/elo.ts` and nowhere else. */

type Phase = "setup" | "arguing" | "judging" | "ballot";

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

  /** Which speech is being written. Four each way, alternating, and the
      student always opens: somebody who has just decided what to argue should
      not have to read a speech before they get to make one. */
  const round = Math.floor(turns.length / 2);
  const speech: Speech = SPEECH_ORDER[Math.min(round, SPEECH_ORDER.length - 1)];
  const finished = turns.length >= SPEECH_ORDER.length * 2;

  const transcript = useRef<HTMLDivElement>(null);
  useEffect(() => {
    transcript.current?.scrollTo({ top: transcript.current.scrollHeight, behavior: "smooth" });
  }, [turns, thinking]);

  const begin = useCallback((chosen: Setup) => {
    setSetup(chosen);
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
      rather than losing it along with the round. */
  async function send() {
    if (!setup || !draft.trim() || thinking) return;
    const mine: Turn = { speaker: "user", speech, text: draft.trim() };
    const withMine = [...turns, mine];

    setTurns(withMine);
    setDraft("");
    setError(null);
    setWasBusy(false);

    /* The last speech of the round has nothing to answer it. */
    if (withMine.length >= SPEECH_ORDER.length * 2 - 1) {
      setThinking(true);
      try {
        const { text } = await postJSON<{ text: string }>("/api/debate", {
          action: "reply",
          setup,
          turns: withMine,
          speech,
        });
        setTurns([...withMine, { speaker: "opponent", speech, text }]);
      } catch (err) {
        setWasBusy(isBusy(err));
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setThinking(false);
      }
      return;
    }

    setThinking(true);
    try {
      const { text } = await postJSON<{ text: string }>("/api/debate", {
        action: "reply",
        setup,
        turns: withMine,
        speech,
      });
      setTurns([...withMine, { speaker: "opponent", speech, text }]);
    } catch (err) {
      setWasBusy(isBusy(err));
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setThinking(false);
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
    if (!setup || thinking) return;
    setPhase("judging");
    setError(null);
    setWasBusy(false);

    try {
      const { ballot: verdict } = await postJSON<{ ballot: Ballot }>("/api/debate", {
        action: "judge",
        setup,
        turns,
      });

      const pool = poolFor(setup.tab);
      const moved = applyRound({
        user: pool.rating,
        opponent: tier(setup.tierId).rating,
        outcome: verdict.winner,
        margin: verdict.margin,
      });
      recordRound(setup.tab, { rating: moved.after, result: verdict.winner });

      setBallot(verdict);
      setChange(moved);
      setPhase("ballot");
    } catch (err) {
      setWasBusy(isBusy(err));
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("arguing");
    }
  }

  /* ── Setup ───────────────────────────────────────────────────────────── */
  if (phase === "setup") {
    return <SetupScreen onBegin={begin} />;
  }

  /* ── The ballot ──────────────────────────────────────────────────────── */
  if (phase === "ballot" && ballot && change && setup) {
    return (
      <BallotCard
        ballot={ballot}
        change={change}
        setup={setup}
        onAgain={() => setPhase("setup")}
      />
    );
  }

  /* ── Arguing ─────────────────────────────────────────────────────────── */
  return (
    <section className="mx-auto flex w-full max-w-[58rem] flex-col gap-4">
      <header className="flex shrink-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <Label>
            {setup?.tab === "competitive" ? setup.format : "Open debate"} · you are{" "}
            {setup?.side}
          </Label>
          <p className="mt-1 font-read text-[clamp(1.0625rem,0.9rem+0.6vw,1.375rem)] leading-tight text-ink">
            {setup?.motion}
          </p>
        </div>
        <span className="shrink-0 font-mono text-[0.75rem] tabular-nums text-ink-faint">
          {finished ? "round over" : `${speech} · ${round + 1} of ${SPEECH_ORDER.length}`}
        </span>
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
            You open. Make your case for the {setup?.side} side.
          </p>
        )}

        {turns.map((turn, i) => (
          <Said key={i} turn={turn} tierName={tier(setup!.tierId).name} />
        ))}

        {thinking && (
          <p role="status" className="font-sans text-[0.8125rem] text-ink-faint">
            <span className="listening mr-2 inline-block h-2 w-2 rounded-full bg-accent align-middle" />
            {tier(setup!.tierId).name} is writing a reply…
          </p>
        )}
      </div>

      {error && (wasBusy ? <Aside>{error}</Aside> : <Notice>{error}</Notice>)}

      {/* Write, or close the round. */}
      <div className="flex shrink-0 flex-col gap-3">
        {!finished ? (
          <>
            <Leaf
              value={draft}
              onChange={setDraft}
              minRows={4}
              placeholder={`Your ${speech.toLowerCase()}…`}
            />
            <div className="flex flex-wrap items-center gap-3">
              <PrimaryButton onClick={send} disabled={thinking || !draft.trim()}>
                {thinking ? "Waiting…" : `Send ${speech.toLowerCase()}`} {!thinking && <Arrow />}
              </PrimaryButton>
              {turns.length >= 2 && (
                <GhostButton onClick={judge} disabled={thinking}>
                  End it here and get the ballot
                </GhostButton>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <PrimaryButton onClick={judge}>
              Get the ballot <Arrow />
            </PrimaryButton>
          </div>
        )}
      </div>

      {phase === "judging" && (
        <p role="status" className="shrink-0 font-sans text-[0.875rem] text-ink-soft">
          Judging the round…
        </p>
      )}
    </section>
  );
}

/** One speech in the transcript. The two sides are told apart by which edge
    the rule sits on and by the name above it, never by colour alone. */
function Said({ turn, tierName }: { turn: Turn; tierName: string }) {
  const mine = turn.speaker === "user";
  return (
    <div
      className={`rounded-[3px] border-l-[3px] bg-page px-3.5 py-2.5 ${
        mine ? "border-accent" : "border-line-strong"
      }`}
    >
      <p
        style={{ fontVariationSettings: '"wdth" 88' }}
        className="mb-1 font-sans text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-ink-faint"
      >
        {mine ? "You" : tierName} · {turn.speech}
      </p>
      <p className="whitespace-pre-wrap font-read text-[1rem] leading-[1.6] text-ink">
        {turn.text}
      </p>
    </div>
  );
}
