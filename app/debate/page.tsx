"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AudioControls } from "../audio-controls";
import { isBusy, postJSON, postStream } from "../client";
import { play } from "../tone";
import { Aside, GhostButton, Leaf, Notice, PrimaryButton, Waiting, Working, Wordmark } from "../ui";
import { PixelTag } from "../paper";
import { Ballot as BallotCard } from "./ballot";
import { DEFAULTS, type Defaults, Setup as SetupScreen } from "./setup";
import { Opening, Said, SpeechRail } from "./transcript";
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
  const speech: Speech = SPEECH_ORDER[Math.min(round, SPEECH_ORDER.length - 1)];
  const finished = turns.length >= SPEECH_ORDER.length * 2;

  const transcript = useRef<HTMLDivElement>(null);
  useEffect(() => {
    transcript.current?.scrollTo({ top: transcript.current.scrollHeight, behavior: "smooth" });
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
        (chunk) => setLive((said) => said + chunk)
      );

      if (!text.trim()) {
        throw new Error("Your opponent lost their train of thought. Send it again.");
      }

      setTurns([...withMine, { speaker: "opponent", speech, text: text.trim() }]);
      play("speech");
    } catch (err) {
      setWasBusy(isBusy(err));
      setError(err instanceof Error ? err.message : "Something went wrong.");
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
      const { ballot: verdict } = await postJSON<{ ballot: Ballot }>("/api/debate", {
        action: "judge",
        setup,
        turns,
      });

      setBallot(verdict);
      setPhase("ballot");
      play("gavel");
    } catch (err) {
      setWasBusy(isBusy(err));
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("arguing");
    }
  }

  const bar = (
    <div className="mb-5 flex shrink-0 items-center justify-between gap-3">
      <Wordmark mode="Debate" />
      <AudioControls />
    </div>
  );

  if (phase === "setup") {
    return (
      <div className={SHELL}>
        {bar}
        <SetupScreen onBegin={begin} initial={last} />
      </div>
    );
  }

  if (phase === "ballot" && ballot && setup) {
    return (
      <div className={SHELL}>
        {bar}
        <BallotCard ballot={ballot} setup={setup} onAgain={() => setPhase("setup")} />
      </div>
    );
  }

  const judging = phase === "judging";
  const opponent = tier(setup!.tierId);
  const judgeable = worthJudging(turns);
  const spoken = wordsSpoken(turns);

  return (
    <div className={`${SHELL} gap-4`}>
      {bar}

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

      <div
        ref={transcript}
        className="flex max-h-[52vh] min-h-[8rem] flex-col gap-3 overflow-y-auto rounded-[3px] border border-line bg-sunk/40 p-3"
      >
        {turns.length === 0 && <Opening said="You open." />}

        {turns.map((turn, i) => (
          <Said key={i} turn={turn} tierName={opponent.name} />
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
            sub="Both sides, with no names on them, from the top."
          />
        ) : !finished ? (
          <>
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
                {thinking ? "Waiting…" : "Send"}
                {!thinking && (
                  <span aria-hidden className="thrown">
                    →
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
          <Working label="Sending it to the judge" />
        ) : (
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
