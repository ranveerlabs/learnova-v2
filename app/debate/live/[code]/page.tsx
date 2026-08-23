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

/* A live room, from the inside.

   This is the same round as `app/debate/page.tsx` with the model taken out
   of the middle of it. The transcript cards, the speech rail, the compose
   box, the ballot and the judge call are all the single-player ones; what is
   different is where the other speech comes from, and everything that can
   happen to a person that cannot happen to a model — they can be late, they
   can leave, they can come back, and they can be in a tunnel.

   Three things this deliberately does not do, each of which was the obvious
   move at some point:

   It does not stream a speech as it is typed. Watching somebody compose an
   argument keystroke by keystroke changes what they write, and a debate
   speech is meant to arrive finished. It publishes on send, like the round
   it is modelled on.

   It does not let both sides call the judge. That is one API call, and two
   of them would produce two different ballots off the same transcript: the
   two people in the room would be looking at different verdicts. The host
   judges and publishes what came back. `mirror` in ./room turns it around
   for the other chair.

   It is counted nowhere. See `book` in ../ballot.tsx for why there is
   no honest number to move it by. */

const SHELL = "mx-auto flex w-full max-w-[54rem] flex-col";

/* Archivo's width axis, run slightly narrow for the small-caps labels. The
   same declaration the ballot and the transcript cards use; it is three
   words long and shared by copy rather than by import everywhere else in
   this app, which is a convention rather than an oversight. */
const NARROW: React.CSSProperties = { fontVariationSettings: '"wdth" 88' };

export default function LiveRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: typed } = use(params);
  const code = readCode(typed);

  /* Validated out here so the room itself never has to hold a code it
     cannot use. A bad code is a mistyped link rather than a failure, and it
     is answered before a connection is opened, because opening one would
     ask Ably for a token scoped to a channel that should not exist. */
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
  /* Whether this tab is the host is decided once, by whether it is the tab
     that just created the room. There is no server to ask and no flag in the
     URL to trust: the host is the browser holding the motion, and everybody
     else is a guest. */
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

  /* A speech landed from the other side. The same quiet tone the model's
     speeches ring, for the same reason: look up, they have finished.

     It rings only on a jump of exactly one, which is what a speech arriving
     looks like. Anything larger is the host sending the whole round at once
     — a guest joining, or catching up after a gap — and a chime for that is
     a chime for reading the backlog rather than for anything that just
     happened. Counting rather than comparing arrays also means a re-render
     cannot ring the same speech twice, and our own never rings, because we
     watched ourselves type it. */
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
    /* Cleared before the publish rather than after it. The turn is already
       in the transcript by the time `say` returns — it appends locally
       first — so leaving the draft in the box would show the same speech
       twice, once written and once said. */
    setDraft("");
    try {
      await room.say(turn);
    } finally {
      setSending(false);
    }
  }

  /** Close the round and publish what the judge said.

      Host only, and the whole reason is in the file header. The transcript
      goes up as the host sees it, which makes the host side `A` — that is
      the contract `render` in the debate route works to, and the reason the
      guest's copy is put through `mirror` on the way in.

      Nothing is counted after it, here or in the single-player version:
      there is no record of rounds played anywhere in the app, and nothing
      about a live room is written down. */
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

  /* The eighth speech lands and the host sends it, without being asked.

     Same change as the single-player mode and for the same reason: a button
     is a question, and after eight speeches there is only one answer. Here
     it also removes a wait that was somebody else's — the guest used to sit
     on "waiting for the ballot" for as long as the host took to notice the
     round was over and press a button.

     Host only, which is the same rule the button obeyed: one API call, one
     caller. The guard is a ref because `judge` sets its state
     asynchronously, and `judgeable` is checked here for the same reason the
     button checked it — a round nobody really argued is not sent. */
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

  /* ── Everything that is not a debate ──────────────────────────────────── */

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
    /* Two endings, and which one you get depends on whether there was a
       round in here worth accounting for.

       A room that ends mid-argument owes the person still holding it more
       than a sentence: they wrote speeches, and the speeches are the only
       thing this mode ever produces. A room that ends with nothing in it —
       a guest who opened the link and shut it again, a host who idled out
       alone — owes them a sentence, because an "account of the round" with
       an empty transcript under it is furniture around a hole.

       `toSpeak` is null exactly when all eight speeches are in, so a
       completed round falls through to `Stopped` too. That is right: a
       completed round's account of itself is the ballot, and if it did not
       get one, the reason is on the screen it came from. */
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
            /* A room can only be closed by something, but the type allows a
               null and the screen must not print "undefined left the room".
               An unexplained ending is a vanished opponent, which is the
               one that happens without anybody sending a reason. */
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

  /* ── The ballot ───────────────────────────────────────────────────────── */

  if (room.ballot && setup && mySide) {
    return (
      <div className={SHELL}>
        <Bar />
        <BallotCard
          ballot={room.ballot}
          /* The setup as this reader lived it. The wire carries the host's
             side, because that is who chose it; a guest handed it unchanged
             would be told they had been arguing the opposite of what they
             spent four speeches arguing. */
          setup={{ ...setup, side: mySide }}
          opponentName="Them"
          onAgain={() => room.close("done")}
          againLabel="Close the room"
        />
      </div>
    );
  }

  /* ── Waiting for the other chair to be filled ─────────────────────────── */

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

  /* ── Arguing ──────────────────────────────────────────────────────────── */

  const transcript = asTranscript(room.turns, mySide!);
  const spokenByMe = wordsSpoken(transcript);
  const spokenByThem = wordsSpoken(asTranscript(room.turns, otherSide(mySide!)));
  /* Both sides, not just the reader's. `worthJudging` asks whether the
     person holding the transcript said enough to be marked, which is the
     right question when the other side is a model that always says plenty.
     Here both sides are people and either of them can be the one who typed
     "no" four times, so the bar has to clear on both. */
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

      {/* They have gone, and the round does not need them any more.

          This is now the only case where a departure leaves you on the
          arguing screen at all: `onLeave` in ../channel.ts ends the room
          outright when there are speeches still owed, because a round that
          cannot continue should say so rather than leave somebody watching
          for a speech nobody is writing. What it deliberately does not end
          is a round where all eight speeches are already in, and this line
          is what that case looks like — every word the judge needs is here,
          so the ballot is still worth having and the button below still
          works. */}
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
          /* Their turn. A waiting screen rather than a greyed-out box: the
             box being available is what invites somebody to start writing
             their next speech before they have read the one being written
             at them, which is the habit this mode exists to break. */
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

/** What is being argued, before there is anybody to argue it with. */
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

/** The link, and the code underneath it.

    Both, because they fail in different places. The link is what somebody
    sitting elsewhere needs and is useless read aloud; the code is what
    somebody across the room needs and is the only half that survives being
    said out loud. The copy button is a convenience on top of a field that
    already shows the whole thing, so a browser that refuses clipboard access
    costs a select-and-copy rather than the feature. */
function Share({ code }: { code: string }) {
  return (
    <div className="flex flex-col gap-4">
      {/* The code, at the size of a thing meant to be read across a room.

          ── The link is gone, and this replaced it ─────────────────────────
          What was here was a URL in a monospace field with a copy button,
          and the code underneath it as a fallback in small type. That was
          the wrong way round for where this actually gets used. A link needs
          a channel between two devices: a chat app, a message, something to
          paste into. Two people at one table have no such channel and do not
          want one, and the fastest path between their screens is one of them
          saying four characters out loud.

          So the fallback became the mechanism and the link went entirely,
          rather than staying as a second option. Two ways to do one thing is
          two paths to keep working and two things for the host screen to
          explain, and the code is what a code is good at. */}
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

      {/* There was a pulsing dot here, and before that a dot with a sentence
          beside it saying the round starts when they join. The sentence went
          first because it described the only thing that could happen next.
          The dot went after it, for the reason the sentence did not survive
          being alone: a bare pulse with nothing to label it is not an
          indicator, it is a mark on the page that moves.

          Nothing replaces it. The screen is a code the size of a headline
          and a line telling somebody what to do with it, and a room that is
          waiting looks exactly like a room that is waiting. */}
    </div>
  );
}

/** The end of the round, which is a different screen depending on the chair,
    on whether anybody actually argued, and on whether both of them are still
    here to see it. */
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
  /** The other chair emptied. Only changes what the guest is told: the host
      keeps their button, because a complete transcript is still judgeable
      by the one person who can send it. */
  opponentGone: boolean;
  judgeable: boolean;
  spokenByMe: number;
  spokenByThem: number;
  onJudge: () => void;
  onLeave: () => void;
}) {
  if (!judgeable) {
    /* Nobody argued, or one of them did not. Said in words with a way out,
       for exactly the reason the single-player version says it in words with
       a way out: at the end of a round this is the only control on the
       screen, and a dead button here is a dead end.

       Which side fell short is named, because in a room with two people in
       it "there is not enough here" with no subject invites each of them to
       assume it was the other. */
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
    /* The guest, waiting on a ballot only the host can ask for — and the
       host is not there any more.

       This is the one dead end a departure can still cause, and it survives
       the change in ../channel.ts on purpose: a round with all eight
       speeches in it is not ended by somebody leaving, because the
       transcript is complete and worth judging. That reasoning holds for
       the host, who can still press the button. It does not hold here. The
       guest has a complete round, no way to send it, and nobody left to
       send it for them, so what they used to get was a meter captioned
       "waiting for the ballot" that would have spun until the idle timer
       collected the room ten minutes later.

       Saying so is the whole fix. Letting the guest judge instead was the
       other candidate and was rejected: it would put a second caller on the
       one API call this mode is careful to make exactly once, and a host
       whose connection came back mid-request would make that concrete. */
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

  /* The host, with the round already on its way to the judge. There is
     nothing to press: see the effect in the room screen. */
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Working label="Sending it to the judge" />
      <Leave onLeave={onLeave} />
    </div>
  );
}

/** The time on a clock, in whatever shape this reader's locale writes one.

    Rendered only after a room has closed, which is only ever an event on the
    client, so there is no server pass for this to disagree with. */
function clock(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** What ended the room, said as one plain sentence.

    Who left is never actually in doubt: a room holds one host and one guest,
    so the other person is whichever of those this reader is not. The
    presence data is used where it survived the leave and the seat is
    inferred where it did not, because a screen that says "somebody" about a
    two-person room is being coy about a fact it has.

    When is the part that can genuinely be missing, and it is left out rather
    than guessed. A `left` arrives as a message from somebody who is still
    connected, so their presence record may not have caught up by the time
    this renders, and a time invented to fill the sentence would be the one
    piece of this screen a person could catch out. */
function ended(reason: Closed, myRole: Role, departed: Departure | null): string {
  if (reason === "idle") {
    return "Nothing was said in here for ten minutes, so the room let go of itself. Neither of you left — it just went quiet, and an empty room is not a thing this app keeps.";
  }

  const theirs: Role = departed?.role ?? (myRole === "host" ? "guest" : "host");
  const who = theirs === "host" ? "The person who opened the room" : "The person who joined";
  const when = departed ? ` at ${clock(departed.at)}` : "";

  /* "left" rather than "left the room", and "closed it" rather than "closed
     the room". Both subjects already end in the word room — the seat is
     named by what the person did with the room — so the obvious phrasing
     lands as "The person who opened the room left the room", which reads
     like a typo. Seen on screen rather than reasoned about. */
  if (reason === "done") {
    return `${who} closed it before the round had finished.`;
  }

  return `${who} left${when}.`;
}

/** A round that stopped partway, and everything that is left of it.

    ── Why this is not a ballot, and must not look like one ─────────────────
    The temptation on this screen is to judge what there is. Three good
    speeches is more than some finished rounds contain, the judge would
    happily return a winner for them, and a verdict is what the reader was
    expecting when they sat down. It would also be worthless, and worse than
    worthless: a ballot is a comparison of two cases that were allowed to
    finish, and marking somebody on a case they were mid-way through
    building scores them on the speeches they never got to give. The one
    person on this screen would be reading a judgement about an absence.

    So there is a verdict-shaped hole here and it is left open, with the
    reason in it. Everything else the round produced is on the page: how far
    it went, and every word either of them wrote, in the same cards the
    argument was read in.

    ── What it shows, and what it does not ──────────────────────────────────
    The whole transcript, both sides, not just the reader's own speeches.
    They were reading their opponent's words a second before this screen
    replaced the one they were on, and taking those away at the moment the
    round ends would be the app deciding they had stopped being allowed to
    see something they already had. `Said` labels the sides anyway.

    There is no way back into the room, deliberately, and `Ways` says why. */
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
      {/* The motion first, on its note, exactly as the ballot opens. This is
          the screen that stands in for the ballot, and somebody arriving on
          it should recognise where they are before they read a word. */}
      <Motion setup={setup} mine={mine} />

      <div className="flex flex-col gap-3">
        <h1 className="max-w-[24ch] font-read text-[clamp(1.5rem,1.2rem+1.4vw,2.125rem)] leading-[1.15] tracking-[-0.015em] text-ink">
          The round did not finish
        </h1>
        <p className="max-w-[54ch] font-sans text-[1rem] leading-[1.65] text-ink-soft">
          {ended(reason, myRole, departed)}
        </p>
      </div>

      {/* How far it got, in the same rail the round was argued under.

          The rail rather than only a count, because it is the mark this mode
          already uses for "where are we", and somebody who watched it fill
          up for three speeches can read where it stopped without parsing a
          fraction. The count sits beside it for the same fact stated
          exactly, and the sentence underneath names the speech that never
          came, which is the one detail neither of the other two carries. */}
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

      {/* Capped shorter than the arguing screen's box. There it was the
          thing you were doing; here it is the record of a thing that
          happened, and a record should not take the whole screen away from
          the sentence explaining why there is no ballot under it. */}
      <div className="flex max-h-[38vh] flex-col gap-3 overflow-y-auto rounded-[3px] border border-line bg-sunk/40 p-3">
        {transcript.map((turn, i) => (
          <Said key={i} turn={turn} tierName="Them" />
        ))}
      </div>

      {/* The gap register, which is this app's colour for something absent
          rather than something wrong. Not the broken-mark red the errors
          use: nobody made a mistake here, and dressing an interrupted round
          as a failure would tell the person left holding it that they had
          done something to deserve it. */}
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

/** Leaving, which ends the room for both people.

    It says so on the button rather than in a confirmation, because a
    confirmation on a two-person room is a modal in front of somebody who
    already knows what leaving means. */
function Leave({ onLeave }: { onLeave: () => void }) {
  return (
    <GhostButton onClick={onLeave} title="This closes the room for both of you.">
      Leave the room
    </GhostButton>
  );
}

/** A room that is not going to happen, and the way on from it.

    Every dead end in this mode ends here rather than in a bare error,
    because all of them are one of two things — a link that has gone stale or
    a room that has ended — and in both cases the thing a person wants next
    is another room. */
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

/** The way on from a room that has ended, and the absence of any other.

    ── One button, and it used to be two ──────────────────────────────────
    There were two: "Open a new room" and "Debate the model instead". They
    were two different places when opening a room lived at `/debate/live`.
    They are one place now, because `/debate` asks which opponent you want as
    its first question, and two buttons with different labels going to the
    same URL is a screen telling you there is a choice here that it will then
    not offer.

    ── What is deliberately not here ────────────────────────────────────────
    No "try to rejoin" and no "wait for them". A room is the people attached
    to the channel; once one of them has gone it is not somewhere that still
    exists and is empty, it is not anywhere. A button that could only ever
    fail would be the one genuinely dishonest control in the mode. The same
    code cannot be reopened either, because the tab that held the motion is
    the tab that left.

    Shared by both endings rather than copied into the second, because two
    copies is how two endings start disagreeing about what a person may do
    next. */
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

