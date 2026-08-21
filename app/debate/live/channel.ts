"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Realtime, type PresenceMessage, type RealtimeChannel } from "ably";
import type { Ballot } from "../types";
import {
  channelFor,
  type Closed,
  IDLE_MS,
  type Joined,
  type LiveSetup,
  type LiveTurn,
  type Member,
  mirror,
  type Role,
  ROOM_SIZE,
  toSpeak,
  type Wire,
} from "./room";

/* The wire, and everything that can go wrong on it.

   One hook, because the connection and the round are not two things here.
   Whether there is an opponent is a presence question, what they said is a
   message question, and whether the round is still happening is both; a
   screen that had to assemble that from three separate hooks would spend
   most of its code deciding which of them to believe.

   The screen gets a state to switch on and three things it can do. Every
   failure this can have is one of the states, including the ones that are
   nobody's fault: a room that is full, a room that nobody is in, a code that
   was already taken, an opponent who closed their laptop. None of them
   throw, because "the other person left" is a normal thing to happen in the
   middle of a debate and a thrown error would take the transcript with
   it. */

export type Stage =
  /** Attaching, and asking the channel who is already there. */
  | "connecting"
  /** Two people are already debating in this room. */
  | "full"
  /** Nobody is in that room. Either the code is wrong or the host has gone. */
  | "empty"
  /** Somebody is already using the code this host just generated. */
  | "taken"
  /** In the room. Whether there is anybody to argue with is `together`. */
  | "open"
  /** The room ended. `closed` says why. */
  | "closed"
  /** The connection could not be made at all. `error` says what happened. */
  | "error";

/** What presence was able to say about somebody leaving.

    Two facts and no more, because two facts are all Ably actually has. The
    role comes out of the presence data the other tab published about itself
    when it entered, and is `null` if that data did not survive the leave —
    which happens, so the screen has to cope rather than assume.

    `at` is Ably's timestamp on the leave message, and it means something
    slightly different for each way of going: for somebody who pressed the
    button it is when they pressed it, and for a connection that died it is
    when Ably gave up waiting, which is a handful of seconds after the tab
    actually closed. The end-of-room screen says which of those it is
    looking at rather than printing a time and letting the reader assume it
    is exact. */
export type Departure = { role: Role | null; at: number };

export type Room = {
  stage: Stage;
  error: string | null;
  closed: Closed | null;
  /** Who went and when, if presence saw it go.

      Null on a room that ended without anybody leaving — an idle timeout —
      and also, briefly, on a room ended by a `room_closed` message that
      arrived before presence caught up. The screen treats a missing
      departure as a missing timestamp rather than a missing person: in a
      two-seat room, who left is never in doubt. */
  departed: Departure | null;
  /** Is the other chair occupied right now. */
  together: boolean;
  /** Has it ever been. What separates "waiting for them to arrive" from
      "they were here and they have gone", which are the same boolean and
      very different sentences. */
  arrived: boolean;
  /** Our own connection is in trouble. Distinct from the opponent leaving,
      and the distinction matters: one of them is our problem to report and
      the other is theirs. */
  dropped: boolean;
  setup: LiveSetup | null;
  turns: LiveTurn[];
  ballot: Ballot | null;
  /** The transcript and the other tab disagree about how far the round has
      got. Recovery is automatic; this is only here so the screen can say
      something rather than silently show a short round. */
  desync: boolean;
  say: (turn: LiveTurn) => Promise<void>;
  publishBallot: (ballot: Ballot) => Promise<void>;
  close: (reason: Closed) => void;
};

/** A name for this tab, for the length of this tab.

    Ably needs a client id to put somebody in a presence set. It is not an
    identity and nothing is kept against it: it is made in memory when the
    room screen mounts, it never reaches storage, and it is gone when the tab
    is. */
function tabId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/** Who is actually in the room, oldest first.

    Sorted so both tabs agree, which is what makes the overflow check below
    decide the same way on both sides of a race. `timestamp` first because it
    is the real answer; `connectionId` after it because two entries can share
    a millisecond and a tie broken differently on each tab would have both of
    them politely leaving. */
function seated(members: PresenceMessage[]): PresenceMessage[] {
  return [...members].sort(
    (a, b) => a.timestamp - b.timestamp || a.connectionId.localeCompare(b.connectionId)
  );
}

function roleOf(m: PresenceMessage): Role | null {
  const data = m.data as Member | undefined;
  return data?.role === "host" || data?.role === "guest" ? data.role : null;
}

export function useRoom({
  code,
  role,
  setup: hostSetup,
}: {
  code: string;
  role: Role;
  /** The host brought a motion with them. The guest is told one. */
  setup: LiveSetup | null;
}): Room {
  const [stage, setStage] = useState<Stage>("connecting");
  /* The same value, readable from a timer. `setStage`'s updater form cannot
     be used to peek at the current stage — React may run an updater more
     than once, so anything with a side effect in it fires more than once
     too. This is the boring way and it is the correct one. */
  const stageAt = useRef<Stage>("connecting");
  stageAt.current = stage;
  const [error, setError] = useState<string | null>(null);
  const [closed, setClosed] = useState<Closed | null>(null);
  const [together, setTogether] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [departed, setDeparted] = useState<Departure | null>(null);
  const [dropped, setDropped] = useState(false);
  const [setup, setSetup] = useState<LiveSetup | null>(hostSetup);
  const [turns, setTurns] = useState<LiveTurn[]>([]);
  const [ballot, setBallot] = useState<Ballot | null>(null);
  const [desync, setDesync] = useState(false);

  const chan = useRef<RealtimeChannel | null>(null);
  /* The round, readable from inside a subscription callback that was built
     once. The host answers an arrival with the transcript so far, and the
     transcript so far is not something a closure from mount time knows. */
  const round = useRef<LiveTurn[]>([]);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Publish, and never throw at the screen.

      A publish that fails is a speech the other person did not hear, which
      is bad, and it is not worth taking the round down over: the sender
      still has their own text on screen and the recovery path (a presence
      update, which makes the host resend everything) is the same one a
      dropped message uses. */
  const push = useCallback(async (event: Wire) => {
    try {
      await chan.current?.publish(event.name, event.data);
    } catch (err) {
      console.error(`Live debate could not publish ${event.name}:`, err);
    }
  }, []);

  const close = useCallback(
    (reason: Closed) => {
      void push({ name: "room_closed", data: { reason } });
      setClosed(reason);
      setStage("closed");
    },
    [push]
  );

  /* Held in a ref so the long-lived idle timer can call the current one
     without the connection effect having to depend on it and tear the whole
     room down every time it is rebuilt. */
  const closeNow = useRef(close);
  closeNow.current = close;

  /** Ten quiet minutes and the room lets go.

      Reset by anything at all happening — a speech, somebody arriving,
      somebody leaving. See IDLE_MS for what this is actually for, which is
      abandoned tabs rather than slow debaters. */
  const stir = useCallback(() => {
    if (idle.current) clearTimeout(idle.current);
    idle.current = setTimeout(() => {
      /* Only a room that is still open can time out.

         This guard is new and it is not defensive tidying: `stir` is called
         from the presence-leave handler, which now also ends the room, so
         without it every abandoned round would sit on its "they stopped
         responding" screen for exactly ten minutes and then silently
         rewrite itself into "the room timed out". The reason a person is
         given for their round ending must not change under them ten minutes
         later. */
      if (stageAt.current === "open") closeNow.current("idle");
    }, IDLE_MS);
  }, []);

  useEffect(() => {
    let live = true;
    const clientId = tabId();
    const client = new Realtime({
      authUrl: "/api/live/token",
      authParams: { code, clientId },
      clientId,
      /* Our own messages do not come back to us. The sender has already
         applied the turn locally — it is their own speech, they are looking
         at it — and an echo would append it a second time. */
      echoMessages: false,
    });

    const channel = client.channels.get(channelFor(code));
    chan.current = channel;

    /** Why the connection failed, in a sentence somebody can act on.

        Ably's own reason is accurate and unreadable ("Error response from
        authUrl: 500"). The token route already writes a good message for
        the one failure that actually happens in practice, which is the key
        not being set, so on a failure we go and read it. One extra request,
        only ever on the path where the feature is already broken. */
    const explain = async (fallback: string) => {
      try {
        const res = await fetch(
          `/api/live/token?code=${encodeURIComponent(code)}&clientId=${clientId}`
        );
        const data = (await res.json()) as { error?: string };
        return data?.error ?? fallback;
      } catch {
        return fallback;
      }
    };

    /** Give up, and say why.

        Shared by the two ways this can end badly, because from the outside
        they are the same thing: no room. */
    const giveUp = (fallback: string) => {
      void (async () => {
        const said = await explain(fallback);
        if (!live) return;
        setError(said);
        setStage("error");
      })();
    };

    client.connection.on("failed", () => giveUp("The live connection could not be opened."));

    /* ── The wait that had no end ──────────────────────────────────────────
       `failed` is not enough, and finding that out is what this timer is
       for. Ably classifies an auth URL that answers 5xx as a temporary
       problem and keeps retrying it, which is right for a server having a
       bad minute and wrong for the failure that actually happens here: the
       key is not set, so every retry until the end of time gets the same
       500. Screenshotting this screen with a placeholder key showed exactly
       that — "Opening the room", forever, with no error and no way on.

       So there is a deadline. Fifteen seconds is far longer than a healthy
       connection needs and short enough that nobody decides the app is
       broken before it admits that it is. It only fires while still
       connecting: once in the room, a lost connection is Ably's to retry and
       shows up as a line on screen rather than an ending. */
    const deadline = setTimeout(() => {
      if (live && stageAt.current === "connecting") giveUp("The live connection timed out.");
    }, 15_000);

    /* Losing the connection is not losing the room. Ably reconnects on its
       own and presence is restored with it, so this only drives a line on
       screen saying the obvious thing rather than any state change. */
    client.connection.on("disconnected", () => live && setDropped(true));
    client.connection.on("suspended", () => live && setDropped(true));
    client.connection.on("connected", () => live && setDropped(false));

    const apply = (msg: { name?: string; data?: unknown }) => {
      stir();
      switch (msg.name) {
        case "player_joined": {
          /* The host's answer to somebody arriving. The guest takes the
             whole round from it rather than merging, because this arrives
             exactly when the two sides might disagree and the host is the
             one who has been here the whole time. */
          if (role !== "guest") return;
          const { setup: theirs, turns: theirTurns } = msg.data as Joined;
          setSetup(theirs);
          round.current = theirTurns;
          setTurns(theirTurns);
          setDesync(false);
          return;
        }
        case "speech_submitted": {
          const turn = msg.data as LiveTurn;
          round.current = [...round.current, turn];
          setTurns(round.current);
          return;
        }
        case "turn_advanced": {
          /* The count as the speaker saw it after speaking. Ably keeps one
             publisher's messages in order, so this matches unless something
             was genuinely lost — in which case the fix is to ask for the
             round again, which a presence update does by making the host
             resend it. The guest asks; the host is the source and has
             nobody to ask. */
          const { at } = msg.data as { at: number };
          if (at === round.current.length) return;
          setDesync(true);
          if (role === "guest") void channel.presence.update({ role } satisfies Member);
          return;
        }
        case "ballot_returned": {
          /* The host judged, because only one of us may: see `judge` in the
             room screen. The ballot is written about the host's transcript,
             so the guest reads it from the other chair. */
          const { ballot: verdict } = msg.data as { ballot: Ballot };
          setBallot(role === "guest" ? mirror(verdict) : verdict);
          return;
        }
        case "room_closed": {
          const { reason } = msg.data as { reason: Closed };
          setClosed(reason);
          setStage("closed");
          return;
        }
      }
    };

    const onEnter = (m: PresenceMessage) => {
      if (m.clientId === clientId) return;
      stir();
      setTogether(true);
      setArrived(true);
      /* The host is the only one who can answer this, and it is the whole
         of the guest's setup: what is being argued, which side is theirs,
         and anything already said. Sent on `update` too, which is what the
         guest uses to ask for the round again after a gap. */
      if (role === "host" && hostSetup) {
        void push({
          name: "player_joined",
          data: { setup: hostSetup, turns: round.current },
        });
      }
    };

    /** They are not there any more.

        ── Why this ends the room, when it used to just note it ─────────────
        It used to set `together` to false and stop, on the reasoning that
        Ably restores presence by itself and a debate should survive somebody
        going through a tunnel. That reasoning was sound about the network
        and wrong about the room. Nothing else ever ended it: a closed tab
        publishes no `room_closed`, because there is nobody left to publish
        it, so the person still sitting there watched a "waiting for their
        rebuttal" meter for a speech that was never coming, for the full ten
        minutes it took the idle timer to notice. A hang is a worse answer
        than an ending.

        A presence leave is also a stronger signal than it looks. Ably does
        not emit one for a blip: a connection that comes back inside the
        recovery window never left the presence set at all, so what reaches
        here has already survived the retries. By the time this runs, they
        are genuinely gone.

        ── The two things it refuses to do ─────────────────────────────────
        It does not end a round that had already finished. Every speech
        given is a complete transcript, and a complete transcript can still
        be judged; the person left holding it should get their ballot rather
        than a notice about somebody who has no further part to play. That
        is the `toSpeak` check, which is null exactly when all eight
        speeches are in.

        It does not overwrite a reason we already have. Somebody who presses
        the button publishes `room_closed` while still connected and only
        drops out of presence later, so both paths fire for one departure
        and the message is the truthful one — it knows the leaving was a
        decision, and this handler cannot tell that from a dead router. */
    const onLeave = (m: PresenceMessage) => {
      if (m.clientId === clientId) return;
      stir();
      setTogether(false);

      /* Recorded before any of the guards below, and deliberately outside
         them. Even when the room has already been closed by their
         `room_closed` message, this presence leave is the only thing
         carrying a timestamp, and the screen wants to say when. */
      setDeparted({ role: roleOf(m), at: m.timestamp });

      if (stageAt.current !== "open") return;
      if (toSpeak(round.current) === null) return;

      setClosed((already) => already ?? "gone");
      setStage("closed");
    };

    void (async () => {
      try {
        await channel.attach();
        if (!live) return;

        /* Subscribed before entering, deliberately. The host answers an
           arrival the instant it sees one, so a guest who enters presence
           first and subscribes second can be told the motion before it is
           listening for it, and then sit on an empty screen waiting for a
           message that already happened. */
        channel.subscribe(apply);
        channel.presence.subscribe(["enter", "update"], onEnter);
        channel.presence.subscribe(["leave", "absent"], onLeave);

        const before = seated(await channel.presence.get());
        if (!live) return;

        if (role === "host") {
          /* A code collision, or a link opened twice. About one in three
             hundred million either way, and it is left as a wall rather than
             a silent retry: a host who is quietly moved to a different code
             has already copied the old one. */
          if (before.length > 0) {
            setStage("taken");
            return;
          }
        } else {
          if (before.length >= ROOM_SIZE) {
            setStage("full");
            return;
          }
          /* Nobody home. This is as close to "no such room" as this design
             can honestly get — there is no register to be missing from, so
             a code that was never issued and a room whose host has left are
             the same observation. */
          if (!before.some((m) => roleOf(m) === "host")) {
            setStage("empty");
            return;
          }
        }

        await channel.presence.enter({ role } satisfies Member);
        if (!live) return;

        /* The race the count above cannot see: two people opening the same
           link within the same round trip both read one member and both
           enter. Re-read afterwards, and whoever is third or later by the
           ordering both tabs compute identically stands back down. */
        const after = seated(await channel.presence.get());
        if (!live) return;
        const mine = after.findIndex((m) => m.clientId === clientId);
        if (mine >= ROOM_SIZE) {
          await channel.presence.leave();
          if (!live) return;
          setStage("full");
          return;
        }

        const others = after.filter((m) => m.clientId !== clientId);
        setTogether(others.length > 0);
        setArrived(others.length > 0);
        setStage("open");
        stir();

        /* A guest that arrived to find the host already sitting there gets
           no `enter` event for them, because they entered first. Asking is
           an update on our own presence, which the host answers the same way
           it answers an arrival. */
        if (role === "guest" && others.length > 0) {
          await channel.presence.update({ role } satisfies Member);
        }
      } catch (err) {
        if (!live) return;
        console.error("Live debate could not join the room:", err);
        const said = await explain("Could not join that room. Try the link again.");
        if (!live) return;
        setError(said);
        setStage("error");
      }
    })();

    return () => {
      live = false;
      clearTimeout(deadline);
      if (idle.current) clearTimeout(idle.current);
      channel.unsubscribe();
      channel.presence.unsubscribe();
      /* Leaving presence is what tells the other person we have gone, and
         closing the client is what stops the room existing once we both
         have. Ably would work both out from the dropped transport a few
         seconds later; doing it here makes "they left" land immediately
         rather than after a pause somebody would read as a freeze. */
      void channel.presence.leave().catch(() => {});
      client.close();
      chan.current = null;
    };
    /* Built once per room. `hostSetup` is chosen before this screen mounts
       and does not change under it; re-running on it would tear down a live
       connection mid-round. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, role]);

  const say = useCallback(
    async (turn: LiveTurn) => {
      round.current = [...round.current, turn];
      setTurns(round.current);
      stir();
      await push({ name: "speech_submitted", data: turn });
      await push({ name: "turn_advanced", data: { at: round.current.length } });
    },
    [push, stir]
  );

  const publishBallot = useCallback(
    async (verdict: Ballot) => {
      setBallot(verdict);
      await push({ name: "ballot_returned", data: { ballot: verdict } });
    },
    [push]
  );

  return {
    stage,
    error,
    closed,
    departed,
    together,
    arrived,
    dropped,
    setup,
    turns,
    ballot,
    desync,
    say,
    publishBallot,
    close,
  };
}
