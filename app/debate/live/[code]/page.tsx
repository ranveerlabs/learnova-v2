"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AudioControls } from "@/app/audio-controls";
import { isBusy, postJSON } from "@/app/client";
import { play } from "@/app/tone";
import {
  Arrow,
  Aside,
  GhostButton,
  Label,
  Leaf,
  Notice,
  PrimaryButton,
  Waiting,
  Working,
  Wordmark,
} from "@/app/ui";
import { PixelTag } from "@/app/paper";
import { Ballot as BallotCard } from "../../ballot";
import { Opening, Said, SpeechRail } from "../../transcript";
import {
  type Ballot,
  MIN_WORDS_TO_JUDGE,
  type Side,
  SPEECH_ORDER,
  wordsSpoken,
} from "../../types";
import { type Departure, useRoom } from "../channel";
import { takeHandoff } from "../handoff";
import {
  asTranscript,
  CODE_LENGTH,
  type Closed,
  type LiveSetup,
  type LiveTurn,
  otherSide,
  readCode,
  type Role,
  toSpeak,
} from "../room";

const SHELL = "mx-auto flex w-full max-w-[54rem] flex-col";

const NARROW: React.CSSProperties = { fontVariationSettings: '"wdth" 88' };

export default function LiveRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: typed } = use(params);
  const code = readCode(typed);

  if (!code) {
    return (
      <div className={SHELL}>
        <Bar />
        <Stopped
          title="That is not a room code"
          said={`A room code is ${CODE_LENGTH} characters. The one in this link is not, so the link has probably been cut short somewhere between the person who sent it and here.`}
        />
      </div>
    );
  }

  return <Room code={code} />;
}

function Bar() {
  return (
    <div className="mb-5 flex shrink-0 items-center justify-between gap-3">
      <Wordmark mode="Live debate" />
      <AudioControls />
    </div>
  );
}

function Room({ code }: { code: string }) {
  const [brought] = useState<LiveSetup | null>(() => takeHandoff(code));
  const [role] = useState(brought ? ("host" as const) : ("guest" as const));

  const room = useRoom({ code, role, setup: brought });

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [judging, setJudging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wasBusy, setWasBusy] = useState(false);

  const setup = room.setup;
  const mySide: Side | null = setup ? (role === "host" ? setup.side : otherSide(setup.side)) : null;

  const next = toSpeak(room.turns);
  const finished = next === null;
  const at = Math.floor(room.turns.length / 2);
  const myTurn = next !== null && mySide !== null && next.side === mySide;

  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [room.turns, room.ballot]);

  const heard = useRef(0);
  useEffect(() => {
    const now = room.turns.length;
    if (now === heard.current + 1) {
      const last = room.turns[now - 1];
      if (mySide && last.side !== mySide) play("speech");
    }
    heard.current = now;
  }, [room.turns, mySide]);

  const gavelled = useRef(false);
  useEffect(() => {
    if (room.ballot && !gavelled.current) {
      gavelled.current = true;
      play("gavel");
    }
  }, [room.ballot]);

  async function send() {
    if (!myTurn || !next || !mySide || !draft.trim() || sending) return;
    const turn: LiveTurn = { side: mySide, speech: next.speech, text: draft.trim() };

    setSending(true);
    setError(null);
    setDraft("");
    try {
      await room.say(turn);
    } finally {
      setSending(false);
    }
  }

  async function judge() {
    if (role !== "host" || !setup || judging || room.ballot) return;

    setJudging(true);
    setError(null);
    setWasBusy(false);
    try {
      const { ballot } = await postJSON<{ ballot: Ballot }>("/api/debate", {
        action: "judge",
        setup,
        turns: asTranscript(room.turns, setup.side),
      });
      await room.publishBallot(ballot);
    } catch (err) {
      setWasBusy(isBusy(err));
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setJudging(false);
    }
  }

  const sent = useRef(false);
  useEffect(() => {
    if (role !== "host" || room.stage !== "open") return;
    if (sent.current || judging || room.ballot) return;
    if (toSpeak(room.turns) !== null) return;
    const mine = wordsSpoken(asTranscript(room.turns, setup?.side ?? "Pro"));
    if (mine === 0) return;
    sent.current = true;
    void judge();
  });

  if (room.stage === "connecting") {
    return (
      <div className={SHELL}>
        <Bar />
        <Waiting title="Opening the room" sub="Finding out who is already in it." />
      </div>
    );
  }

  if (room.stage === "error") {
    return (
      <div className={SHELL}>
        <Bar />
        <Stopped title="The room would not open" said={room.error ?? "Something went wrong."} />
      </div>
    );
  }

  if (room.stage === "taken") {
    return (
      <div className={SHELL}>
        <Bar />
        <Stopped
          title="That code is in use"
          said="Somebody is already in a room with this code, which is rare enough to be worth saying out loud. Open another one and you will get a different code."
        />
      </div>
    );
  }

  if (room.stage === "full") {
    return (
      <div className={SHELL}>
        <Bar />
        <Stopped
          title="That room is full"
          said="Two people are already debating in there. A room holds two, because a debate has two sides."
        />
      </div>
    );
  }

  if (room.stage === "empty") {
    return (
      <div className={SHELL}>
        <Bar />
        <Stopped
          title={`Nobody is in room ${code}`}
          said="Either the code is wrong, or whoever opened the room has closed it. Nothing about a room outlives the people in it, so there is nothing to rejoin — but opening a new one takes about ten seconds."
        />
      </div>
    );
  }

  if (room.stage === "closed") {
    const midRound = toSpeak(room.turns) !== null;
    if (setup && mySide && room.turns.length > 0 && midRound) {
      return (
        <div className={SHELL}>
          <Bar />
          <Unfinished
            setup={setup}
            mine={mySide}
            myRole={role}
            turns={room.turns}
            reason={room.closed ?? "left"}
            departed={room.departed}
          />
        </div>
      );
    }

    return (
      <div className={SHELL}>
        <Bar />
        <Stopped
          title={room.closed === "idle" ? "The room timed out" : "The room closed"}
          said={
            room.closed === "idle"
              ? "Nothing happened in it for ten minutes, so it let go. That is what stops abandoned tabs holding rooms open."
              : room.closed === "done"
                ? "That is the end of the round. Nothing from it was saved anywhere, here or on the server."
                : "You left the room."
          }
        />
      </div>
    );
  }

  if (room.ballot && setup && mySide) {
    return (
      <div className={SHELL}>
        <Bar />
        <BallotCard
          ballot={room.ballot}
          setup={{ ...setup, side: mySide }}
          opponentName="Them"
          onAgain={() => room.close("done")}
          againLabel="Close the room"
        />
      </div>
    );
  }

  if (!setup) {
    return (
      <div className={SHELL}>
        <Bar />
        <Waiting title="Joining the room" sub="Waiting to be told what is being argued." />
      </div>
    );
  }

  if (!room.together && !room.arrived) {
    return (
      <div className={SHELL}>
        <Bar />
        <section className="flex w-full flex-col gap-6 pb-4">
          <Motion setup={setup} mine={mySide!} />
          {role === "host" ? (
            <Share code={code} />
          ) : (
            <Aside>
              You are in the room. Whoever opened it has stepped away — the round starts when they
              are back.
            </Aside>
          )}
          <Leave onLeave={() => room.close("left")} />
        </section>
      </div>
    );
  }

  const transcript = asTranscript(room.turns, mySide!);
  const spokenByMe = wordsSpoken(transcript);
  const spokenByThem = wordsSpoken(asTranscript(room.turns, otherSide(mySide!)));
  const judgeable = spokenByMe >= MIN_WORDS_TO_JUDGE && spokenByThem >= MIN_WORDS_TO_JUDGE;

  return (
    <div className={`${SHELL} gap-4`}>
      <Bar />

      <header className="flex shrink-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <PixelTag tone={mySide === "Pro" ? "mint" : "pink"}>
            you are {mySide === "Pro" ? "for it" : "against it"}
          </PixelTag>
          <p className="mt-2 font-read text-[clamp(1.0625rem,0.9rem+0.6vw,1.375rem)] leading-tight text-ink">
            {setup.motion}
          </p>
        </div>
        <SpeechRail at={at} finished={finished} />
      </header>

      {room.arrived && !room.together && (
        <Aside>
          Your opponent has dropped out of the room. Every speech was given before they went, so the
          transcript is complete and the ballot is still worth reading.
        </Aside>
      )}

      {room.dropped && (
        <Aside>
          You have lost your connection. Nothing is lost while it comes back, and anything they say
          in the meantime will arrive when it does.
        </Aside>
      )}

      {room.desync && (
        <Aside>
          Part of the round did not reach this tab. Asking for it again — the transcript below may
          be a speech short until it lands.
        </Aside>
      )}

      <div
        ref={scroller}
        className="flex max-h-[52vh] min-h-[8rem] flex-col gap-3 overflow-y-auto rounded-[3px] border border-line bg-sunk/40 p-3"
      >
        {transcript.length === 0 && (
          <Opening said={myTurn ? "You open." : "They open. Yours is next."} />
        )}
        {transcript.map((turn, i) => (
          <Said key={i} turn={turn} tierName="Them" />
        ))}
      </div>

      {error && (wasBusy ? <Aside>{error}</Aside> : <Notice>{error}</Notice>)}

      <div className="flex shrink-0 flex-col gap-2">
        {judging ? (
          <Waiting title="Judging the round" sub="Both sides, with no names on them, from the top." />
        ) : finished ? (
          <Closing
            host={role === "host"}
            opponentGone={room.arrived && !room.together}
            judgeable={judgeable}
            spokenByMe={spokenByMe}
            spokenByThem={spokenByThem}
            onJudge={judge}
            onLeave={() => room.close("done")}
          />
        ) : myTurn ? (
          <>
            <Leaf
              key={room.turns.length}
              value={draft}
              onChange={setDraft}
              minRows={3}
              placeholder={`Your ${next!.speech.toLowerCase()}…`}
              onSubmit={send}
              autoFocus
            />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <PrimaryButton onClick={send} disabled={sending || !draft.trim()}>
                {sending ? "Sending…" : "Send"}
                {!sending && (
                  <span aria-hidden className="thrown">
                    →
                  </span>
                )}
              </PrimaryButton>
              <Leave onLeave={() => room.close("left")} />
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-3">
            <Waiting
              title={`Their ${next!.speech.toLowerCase()}`}
              sub="It arrives finished, the way a speech does."
            />
            <Leave onLeave={() => room.close("left")} />
          </div>
        )}
      </div>
    </div>
  );
}

function Motion({ setup, mine }: { setup: LiveSetup; mine: Side }) {
  return (
    <div className="flex flex-col gap-3">
      <Label>
        {setup.tab === "competitive" ? setup.format : "Open debate"} ·{" "}
        {mine === "Pro" ? "You are for it" : "You are against it"}
      </Label>
      <div
        className="sticky flex min-h-[7.5rem] w-fit min-w-[11rem] max-w-[20rem] items-start rounded-[2px] pb-6 pl-5 pr-6 pt-5"
        style={{ ["--tilt" as string]: "-1.3deg" }}
      >
        <p className="font-hand text-[1.5rem] leading-[1.15]">{setup.motion}</p>
      </div>
    </div>
  );
}

function Share({ code }: { code: string }) {
  return (
    <div className="flex flex-col gap-4">
      <p
        className="font-mono text-[clamp(3rem,2rem+6vw,5rem)] font-semibold leading-[1] tracking-[0.14em] text-ink"
        style={{ textIndent: "0.14em" }}
      >
        {code}
      </p>

      <p className="max-w-[40ch] font-sans text-[0.9375rem] leading-[1.6] text-ink-soft">
        They open Learnova, press Debate, choose <span className="text-ink">Friend</span>, and
        type it in.
      </p>

    </div>
  );
}

function Closing({
  host,
  opponentGone,
  judgeable,
  spokenByMe,
  spokenByThem,
  onJudge,
  onLeave,
}: {
  host: boolean;
  opponentGone: boolean;
  judgeable: boolean;
  spokenByMe: number;
  spokenByThem: number;
  onJudge: () => void;
  onLeave: () => void;
}) {
  if (!judgeable) {
    const who =
      spokenByMe < MIN_WORDS_TO_JUDGE && spokenByThem < MIN_WORDS_TO_JUDGE
        ? "Neither of you"
        : spokenByMe < MIN_WORDS_TO_JUDGE
          ? "You"
          : "They";
    return (
      <div className="flex flex-col gap-3">
        <Notice>
          There is not enough here to judge. {who} wrote under {MIN_WORDS_TO_JUDGE} words across the
          round, which is about one real sentence of argument. Nothing was sent to the judge.
        </Notice>
        <div className="flex flex-wrap items-center gap-3">
          <PrimaryButton onClick={onLeave}>
            Close the room <Arrow />
          </PrimaryButton>
        </div>
      </div>
    );
  }

  if (!host) {
    if (opponentGone) {
      return (
        <div className="flex flex-col gap-3">
          <Aside>
            Every speech was given, but the person who opened the room has left, and the ballot is
            theirs to ask for. There will not be one for this round.
          </Aside>
          <Ways />
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-3">
        <Waiting
          title="Waiting for the ballot"
          sub="Whoever opened the room sends the round to the judge."
        />
        <Leave onLeave={onLeave} />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Working label="Sending it to the judge" />
      <Leave onLeave={onLeave} />
    </div>
  );
}

function clock(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function ended(reason: Closed, myRole: Role, departed: Departure | null): string {
  if (reason === "idle") {
    return "Nothing was said in here for ten minutes, so the room let go of itself. Neither of you left — it just went quiet, and an empty room is not a thing this app keeps.";
  }

  const theirs: Role = departed?.role ?? (myRole === "host" ? "guest" : "host");
  const who = theirs === "host" ? "The person who opened the room" : "The person who joined";
  const when = departed ? ` at ${clock(departed.at)}` : "";

  if (reason === "done") {
    return `${who} closed it before the round had finished.`;
  }

  return `${who} left${when}.`;
}

function Unfinished({
  setup,
  mine,
  myRole,
  turns,
  reason,
  departed,
}: {
  setup: LiveSetup;
  mine: Side;
  myRole: Role;
  turns: LiveTurn[];
  reason: Closed;
  departed: Departure | null;
}) {
  const transcript = asTranscript(turns, mine);
  const total = SPEECH_ORDER.length * 2;
  const next = toSpeak(turns);
  const at = Math.floor(turns.length / 2);

  return (
    <section className="flex w-full flex-col gap-6 pb-4">
      <Motion setup={setup} mine={mine} />

      <div className="flex flex-col gap-3">
        <h1 className="max-w-[24ch] font-read text-[clamp(1.5rem,1.2rem+1.4vw,2.125rem)] leading-[1.15] tracking-[-0.015em] text-ink">
          The round did not finish
        </h1>
        <p className="max-w-[54ch] font-sans text-[1rem] leading-[1.65] text-ink-soft">
          {ended(reason, myRole, departed)}
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        <Label>How far it got</Label>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <SpeechRail at={at} finished={false} />
          <span className="font-mono text-[0.8125rem] tabular-nums text-ink-soft">
            {turns.length} of {total} speeches
          </span>
        </div>
        {next && (
          <p className="font-sans text-[0.9375rem] leading-[1.6] text-ink-soft">
            {next.side === mine
              ? `It stopped with your ${next.speech} still to write.`
              : `It stopped waiting for their ${next.speech}.`}
          </p>
        )}
      </div>

      <div className="flex max-h-[38vh] flex-col gap-3 overflow-y-auto rounded-[3px] border border-line bg-sunk/40 p-3">
        {transcript.map((turn, i) => (
          <Said key={i} turn={turn} tierName="Them" />
        ))}
      </div>

      <div className="flex flex-col gap-1 rounded-[3px] border-l-[4px] border-gap-mark bg-gap-tint py-3 pl-4 pr-4">
        <span
          style={NARROW}
          className="font-sans text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-gap-ink"
        >
          No ballot for this one
        </span>
        <p className="font-read text-[1.0625rem] leading-[1.5] text-ink">
          Nothing was sent to the judge, and there is no winner and no score. A ballot weighs one
          finished case against another, and this round has neither: a verdict on it would be
          marking you both on the speeches nobody got to give. Nothing from it was saved anywhere,
          here or on the server.
        </p>
      </div>

      <Ways />
    </section>
  );
}

function Leave({ onLeave }: { onLeave: () => void }) {
  return (
    <GhostButton onClick={onLeave} title="This closes the room for both of you.">
      Leave the room
    </GhostButton>
  );
}

function Stopped({ title, said }: { title: string; said: string }) {
  return (
    <section className="flex w-full flex-col gap-6 pb-4">
      <h1 className="max-w-[20ch] font-read text-[clamp(1.5rem,1.2rem+1.4vw,2.125rem)] leading-[1.15] tracking-[-0.015em] text-ink">
        {title}
      </h1>
      <p className="max-w-[52ch] font-sans text-[1rem] leading-[1.65] text-ink-soft">{said}</p>
      <Ways />
    </section>
  );
}

function Ways() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link
        href="/debate"
        className="btn inline-flex items-center gap-2 self-start rounded-[3px] bg-accent px-5 py-2.5 font-sans text-[0.875rem] font-semibold text-on-accent shadow-[0_1px_2px_rgb(20_26_38/0.12)] hover:bg-accent-hover"
      >
        Start another round
        <span aria-hidden className="rewound">
          ↺
        </span>
      </Link>
    </div>
  );
}
