"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { isBusy, postJSON, postStream } from "../client";
import { play } from "../tone";
import {
  Aside,
  GhostButton,
  Leaf,
  Notice,
  PrimaryButton,
  Waiting,
  Working,
  } from "../ui";
import { Ballot as BallotCard } from "./ballot";
import { DEFAULTS, type Defaults, Setup as SetupScreen } from "./setup";
import { Opening, Said, SpeechRail } from "./transcript";
import {
  type Ballot,
  MIN_WORDS_TO_JUDGE,
  SPEECHES,
  type Setup,
  type Speech,
  tier,
  type Turn,
  wordsSpoken,
  worthJudging,
} from "./types";

type Phase = "setup" | "arguing" | "judging" | "ballot";

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
  const [live, setLive] = useState("");

  const round = Math.floor(turns.length / 2);
  const speech: Speech = SPEECHES[Math.min(round, SPEECHES.length - 1)];
  const finished = turns.length >= SPEECHES.length * 2;

  const tape = useRef<HTMLDivElement>(null);
  useEffect(() => {
    tape.current?.scrollTo({
      top: tape.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns, thinking, live]);

  const sent = useRef(false);
  useEffect(() => {
    if (!finished || sent.current || phase !== "arguing" || thinking) return;
    if (!worthJudging(turns)) return;
    sent.current = true;
    void judge();
  });

  const [last, setLast] = useState<Defaults>(DEFAULTS);

  const begin = useCallback((chosen: Setup) => {
    setSetup(chosen);
    setLast((prev) => ({
      tab: chosen.tab,
      format: chosen.format ?? prev.format,
      tierId: chosen.tierId ?? prev.tierId,
    }));
    setTurns([]);
    setDraft("");
    setBallot(null);
    setError(null);
    sent.current = false;
    setPhase("arguing");
  }, []);

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
        (c) => setLive((prev) => prev + c),
      );

      if (!text.trim())
        throw new Error(
          "The opponent returned an empty response. Try again.",
        );

      setTurns([
        ...withMine,
        { speaker: "opponent", speech, text: text.trim() },
      ]);
      play("speech");
    } catch (e) {
      setWasBusy(isBusy(e));
      setError(
        e instanceof Error ? e.message : "That did not go through. Try again.",
      );
    } finally {
      setThinking(false);
      setLive("");
    }
  }

  async function judge() {
    if (!setup || phase !== "arguing") return;

    setPhase("judging");
    setError(null);
    setWasBusy(false);

    try {
      const { ballot: b } = await postJSON<{ ballot: Ballot }>("/api/debate", {
        action: "judge",
        setup,
        turns,
      });

      setBallot(b);
      setPhase("ballot");
      play("gavel");
    } catch (e) {
      setWasBusy(isBusy(e));
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setPhase("arguing");
    }
  }


  if (phase === "setup") {
    return (
      <div className={SHELL}>
        <SetupScreen onBegin={begin} initial={last} />
      </div>
    );
  }

  if (phase === "ballot" && ballot && setup) {
    return (
      <div className={SHELL}>
        <BallotCard
          ballot={ballot}
          setup={setup}
          onAgain={() => setPhase("setup")}
        />
      </div>
    );
  }

  const judging = phase === "judging";
  const opponent = tier(setup!.tierId);
  const judgeable = worthJudging(turns);
  const spoken = wordsSpoken(turns);

  return (
    <div className={`${SHELL} gap-4`}>

      <header className="flex shrink-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <span className={`side-tag ${setup?.side === "Pro" ? "side-tag-pro" : "side-tag-con"}`}>
            you are {setup && setup.side === "Pro" ? "for it" : "against it"}
          </span>
          <p className="mt-2 font-read text-[clamp(1.0625rem,0.9rem+0.6vw,1.375rem)] leading-tight text-ink">
            {setup?.motion}
          </p>
        </div>
        <SpeechRail at={round} finished={finished} />
      </header>

      <div
        ref={tape}
        className="flex max-h-[52vh] min-h-[8rem] flex-col gap-3 overflow-y-auto border border-line bg-sunk/40 p-3"
      >
        {turns.length === 0 && <Opening said="You open." />}

        {turns.map((t, i) => (
          <Said key={i} turn={t} tierName={opponent.name} />
        ))}

        {thinking && (
          <Said
            turn={{ speaker: "opponent", speech, text: live }}
            tierName={opponent.name}
            speaking
          />
        )}
      </div>

      {error && (wasBusy ? <Aside>{error}</Aside> : <Notice>{error}</Notice>)}

      <div className="flex shrink-0 flex-col gap-2">
        {judging ? (
          <Waiting
            title="Judging the round"
            sub="Reviewing both sides without names."
          />
        ) : !finished ? (
          <>
            <Leaf
              key={turns.length}
              value={draft}
              onChange={setDraft}
              minRows={3}
              placeholder={`Your ${speech.toLowerCase()}...`}
              onSubmit={send}
              autoFocus
            />

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <PrimaryButton
                onClick={send}
                disabled={thinking || !draft.trim()}
              >
                {thinking ? "Waiting..." : "Send"}
                {!thinking && (
                  <span aria-hidden className="thrown">
                    -&gt;
                  </span>
                )}
              </PrimaryButton>
              {turns.length >= 2 && judgeable && (
                <GhostButton onClick={judge} disabled={thinking}>
                  End the round
                </GhostButton>
              )}
            </div>
          </>
        ) : judgeable ? (
          <Working label="Requesting a ballot" />
        ) : (
          <div className="flex flex-col gap-3">
            <Notice>
              There is not enough to judge. You wrote {spoken}{" "}
              {spoken === 1 ? "word" : "words"}. A ballot requires at least{" "}
              {MIN_WORDS_TO_JUDGE}, so nothing was sent to the judge.
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
