"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
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
} from "@/app/ui";
import { Ballot as BallotCard } from "../../ballot";
import { Opening, Said, SpeechRail } from "../../transcript";
import {
  type Ballot,
  MIN_WORDS_TO_JUDGE,
  type Side,
  SPEECHES,
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

export default function LiveRoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: typed } = use(params);
  const code = readCode(typed);

  if (!code) {
    return (
      <div className={SHELL}>
        <Stopped
          title="That is not a room code"
          said={`Room codes have exactly ${CODE_LENGTH} characters. Check the link and try again.`}
        />
      </div>
    );
  }

  return <Room code={code} />;
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
  const mySide: Side | null = setup
    ? role === "host"
      ? setup.side
      : otherSide(setup.side)
    : null;

  const next = toSpeak(room.turns);
  const finished = next === null;
  const at = Math.floor(room.turns.length / 2);
  const myTurn = next !== null && mySide !== null && next.side === mySide;

  const tape = useRef<HTMLDivElement>(null);
  useEffect(() => {
    tape.current?.scrollTo({
      top: tape.current.scrollHeight,
      behavior: "smooth",
    });
  }, [room.turns, room.ballot]);

  const heard = useRef(0);
  useEffect(() => {
    const n = room.turns.length;
    if (n === heard.current + 1) {
      const last = room.turns[n - 1];
      if (mySide && last.side !== mySide) play("speech");
    }
    heard.current = n;
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
    const turn: LiveTurn = {
      side: mySide,
      speech: next.speech,
      text: draft.trim(),
    };

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
    } catch (e) {
      setWasBusy(isBusy(e));
      setError(e instanceof Error ? e.message : "The ballot request failed.");
    } finally {
      setJudging(false);
    }
  }

  const sent = useRef(false);
  useEffect(() => {
    if (role !== "host" || room.stage !== "open") return;
    if (sent.current || judging || room.ballot) return;
    if (toSpeak(room.turns) !== null) return;
    if (wordsSpoken(asTranscript(room.turns, setup?.side ?? "Pro")) === 0)
      return;
    sent.current = true;
    void judge();
  });

  if (room.stage === "connecting") {
    return (
      <div className={SHELL}>
        <Waiting
          title="Opening the room"
          sub="Checking the room."
        />
      </div>
    );
  }

  if (room.stage === "error") {
    return (
      <div className={SHELL}>
        <Stopped
          title="The room would not open"
          said={room.error ?? "The room could not be opened."}
        />
      </div>
    );
  }

  if (room.stage === "taken") {
    return (
      <div className={SHELL}>
        <Stopped
          title="That code is in use"
          said="Another room is using this code. Open a new room to get a different code."
        />
      </div>
    );
  }

  if (room.stage === "full") {
    return (
      <div className={SHELL}>
        <Stopped
          title="That room is full"
          said="Two people are already in this room."
        />
      </div>
    );
  }

  if (room.stage === "empty") {
    return (
      <div className={SHELL}>
        <Stopped
          title={`Nobody is in room ${code}`}
          said="The code is wrong or the room has closed. Check the code or open a new room."
        />
      </div>
    );
  }

  if (room.stage === "closed") {
    const midRound = toSpeak(room.turns) !== null;
    if (setup && mySide && room.turns.length > 0 && midRound) {
      return (
        <div className={SHELL}>
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
        <Stopped
          title={
            room.closed === "idle" ? "The room timed out" : "The room closed"
          }
          said={
            room.closed === "idle"
              ? "The room closed after ten minutes without activity."
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
        <Waiting
          title="Joining the room"
          sub="Waiting for the debate setup."
        />
      </div>
    );
  }

  if (!room.together && !room.arrived) {
    return (
      <div className={SHELL}>
        <section className="flex w-full flex-col gap-6 pb-4">
          <Motion setup={setup} mine={mySide!} />
          {role === "host" ? (
            <Share code={code} />
          ) : (
            <Aside>
              The host is away. The round starts when they return.
            </Aside>
          )}
          <Leave onLeave={() => room.close("left")} />
        </section>
      </div>
    );
  }

  const transcript = asTranscript(room.turns, mySide!);
  const spokenByMe = wordsSpoken(transcript);
  const spokenByThem = wordsSpoken(
    asTranscript(room.turns, otherSide(mySide!)),
  );
  const judgeable =
    spokenByMe >= MIN_WORDS_TO_JUDGE && spokenByThem >= MIN_WORDS_TO_JUDGE;

  return (
    <div className={`${SHELL} gap-4`}>
      <header className="flex shrink-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <span className={`side-tag ${mySide === "Pro" ? "side-tag-pro" : "side-tag-con"}`}>
            you are {mySide === "Pro" ? "for it" : "against it"}
          </span>
          <p className="mt-2 font-read text-[clamp(1.0625rem,0.9rem+0.6vw,1.375rem)] leading-tight text-ink">
            {setup.motion}
          </p>
        </div>
        <SpeechRail at={at} finished={finished} />
      </header>

      {room.arrived && !room.together && (
        <Aside>
          Your opponent has dropped out of the room. Every speech was given
          before they went, so the transcript is complete and the ballot is
          still worth reading.
        </Aside>
      )}

      {room.dropped && (
        <Aside>
          Connection lost. New messages will appear after it reconnects.
        </Aside>
      )}

      {room.desync && (
        <Aside>
          A speech may be missing while the room resyncs.
        </Aside>
      )}

      <div
        ref={tape}
        className="flex max-h-[52vh] min-h-[8rem] flex-col gap-3 overflow-y-auto border border-line bg-sunk/40 p-3"
      >
        {transcript.length === 0 && (
          <Opening said={myTurn ? "You open." : "They open. Yours is next."} />
        )}
        {transcript.map((t, i) => (
          <Said key={i} turn={t} tierName="Them" />
        ))}
      </div>

      {error && (wasBusy ? <Aside>{error}</Aside> : <Notice>{error}</Notice>)}

      <div className="flex shrink-0 flex-col gap-2">
        {judging ? (
          <Waiting
            title="Judging the round"
            sub="Reviewing both sides without names."
          />
        ) : finished ? (
          <Closing
            host={role === "host"}
            opponentGone={room.arrived && !room.together}
            judgeable={judgeable}
            spokenByMe={spokenByMe}
            spokenByThem={spokenByThem}
            onLeave={() => room.close("done")}
          />
        ) : myTurn ? (
          <>
            <Leaf
              key={room.turns.length}
              value={draft}
              onChange={setDraft}
              minRows={3}
              placeholder={`Your ${next!.speech.toLowerCase()}...`}
              onSubmit={send}
              autoFocus
            />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <PrimaryButton onClick={send} disabled={sending || !draft.trim()}>
                {sending ? "Sending..." : "Send"}
                {!sending && (
                  <span aria-hidden className="thrown">
                    -&gt;
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
              sub="Waiting for the other speaker."
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
        {setup.tab === "competitive" ? setup.format : "Open debate"} /{""}
        {mine === "Pro" ? "You are for it" : "You are against it"}
      </Label>
      <div
        className="sticky flex min-h-[7.5rem] w-fit min-w-[11rem] max-w-[20rem] items-start pb-6 pl-5 pr-6 pt-5"
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
        On another device, open Learnova, choose Debate, then{" "}
        <span className="text-ink">Friend</span>, and enter this code.
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
  onLeave,
}: {
  host: boolean;
  opponentGone: boolean;
  judgeable: boolean;
  spokenByMe: number;
  spokenByThem: number;
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
          There is not enough to judge. {who} wrote under {MIN_WORDS_TO_JUDGE}{" "}
          words, so nothing was sent to the judge.
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
            The host left before requesting the ballot, so this round will not
            have one.
          </Aside>
          <Ways />
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-3">
        <Waiting
          title="Waiting for the ballot"
          sub="The host requests it."
        />
        <Leave onLeave={onLeave} />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Working label="Requesting a ballot" />
      <Leave onLeave={onLeave} />
    </div>
  );
}

const clock = (at: number) =>
  new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function ended(reason: Closed, myRole: Role, departed: Departure | null) {
  if (reason === "idle") {
    return "The room closed after ten minutes without activity.";
  }

  const theirs: Role = departed?.role ?? (myRole === "host" ? "guest" : "host");
  const who =
    theirs === "host"
      ? "The person who opened the room"
      : "The person who joined";
  const when = departed ? ` at ${clock(departed.at)}` : "";

  if (reason === "done")
    return `${who} closed it before the round had finished.`;
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
  const total = SPEECHES.length * 2;
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

      <div className="flex max-h-[38vh] flex-col gap-3 overflow-y-auto border border-line bg-sunk/40 p-3">
        {transcript.map((t, i) => (
          <Said key={i} turn={t} tierName="Them" />
        ))}
      </div>

      <div className="flex flex-col gap-1 border-l-[4px] border-gap-mark bg-gap-tint py-3 pl-4 pr-4">
        <span
          style={NARROW}
          className="font-sans text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-gap-ink"
        >
          No ballot
        </span>
        <p className="font-read text-[1.0625rem] leading-[1.5] text-ink">
          The round did not finish, so it was not sent to the judge. There is no
          winner or score. Nothing from the room was saved here or on the server.
        </p>
      </div>

      <Ways />
    </section>
  );
}

function Leave({ onLeave }: { onLeave: () => void }) {
  return (
    <GhostButton
      onClick={onLeave}
      title="The other person can stay in the room."
    >
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
      <p className="max-w-[52ch] font-sans text-[1rem] leading-[1.65] text-ink-soft">
        {said}
      </p>
      <Ways />
    </section>
  );
}

function Ways() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link
        href="/debate"
        className="btn inline-flex items-center gap-2 self-start bg-accent px-5 py-2.5 font-sans text-[0.875rem] font-semibold text-on-accent shadow-[0_1px_2px_rgb(20_26_38/0.12)] hover:bg-accent-hover"
      >
        Start another round
        <span aria-hidden className="rewound">
          ↺
        </span>
      </Link>
    </div>
  );
}
