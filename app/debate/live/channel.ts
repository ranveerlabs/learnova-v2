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

export type Stage = "connecting" | "full" | "empty" | "taken" | "open" | "closed" | "error";

export type Departure = { role: Role | null; at: number };

export type Room = {
  stage: Stage;
  error: string | null;
  closed: Closed | null;
  departed: Departure | null;
  together: boolean;
  arrived: boolean;
  dropped: boolean;
  setup: LiveSetup | null;
  turns: LiveTurn[];
  ballot: Ballot | null;
  desync: boolean;
  say: (turn: LiveTurn) => Promise<void>;
  publishBallot: (ballot: Ballot) => Promise<void>;
  close: (reason: Closed) => void;
};

// a name for this tab, for the life of this tab
const newId = () => crypto.randomUUID().replace(/-/g, "");

// oldest first, so both tabs agree who got here first
const seated = (ms: PresenceMessage[]) =>
  [...ms].sort((a, b) => a.timestamp - b.timestamp || a.connectionId.localeCompare(b.connectionId));

function roleOf(m: PresenceMessage): Role | null {
  const d = m.data as Member | undefined;
  return d?.role === "host" || d?.role === "guest" ? d.role : null;
}

export function useRoom({
  code,
  role,
  setup: mine,
}: {
  code: string;
  role: Role;
  setup: LiveSetup | null;
}): Room {
  const [stage, setStage] = useState<Stage>("connecting");
  // same value, readable from a timer. setStage's updater form can't be read from outside react
  const stageNow = useRef<Stage>("connecting");
  stageNow.current = stage;

  const [error, setError] = useState<string | null>(null);
  const [closed, setClosed] = useState<Closed | null>(null);
  const [together, setTogether] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [departed, setDeparted] = useState<Departure | null>(null);
  const [dropped, setDropped] = useState(false);
  const [setup, setSetup] = useState<LiveSetup | null>(mine);
  const [turns, setTurns] = useState<LiveTurn[]>([]);
  const [ballot, setBallot] = useState<Ballot | null>(null);
  const [desync, setDesync] = useState(false);

  const chan = useRef<RealtimeChannel | null>(null);
  const round = useRef<LiveTurn[]>([]);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);

  // never throws at the screen
  const push = useCallback(async (e: Wire) => {
    try {
      await chan.current?.publish(e.name, e.data);
    } catch (err) {
      console.error(`wire:${e.name} failed`, err);
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

  const closeNow = useRef(close);
  closeNow.current = close;

  const poke = useCallback(() => {
    if (idle.current) clearTimeout(idle.current);
    idle.current = setTimeout(() => {
      if (stageNow.current === "open") closeNow.current("idle");
    }, IDLE_MS);
  }, []);

  useEffect(() => {
    let live = true;
    const id = newId();
    const client = new Realtime({
      authUrl: "/api/live/token",
      authParams: { code, clientId: id },
      clientId: id,
      echoMessages: false,
    });

    const channel = client.channels.get(channelFor(code));
    chan.current = channel;

    // ably won't tell us why auth failed, so ask the route directly
    const why = async (fb: string) => {
      try {
        const res = await fetch(`/api/live/token?code=${encodeURIComponent(code)}&clientId=${id}`);
        const d = (await res.json()) as { error?: string };
        return d?.error ?? fb;
      } catch {
        return fb;
      }
    };

    const bail = (fb: string) => {
      void (async () => {
        const said = await why(fb);
        if (!live) return;
        setError(said);
        setStage("error");
      })();
    };

    client.connection.on("failed", () => bail("The live connection could not be opened."));

    const deadline = setTimeout(() => {
      if (live && stageNow.current === "connecting") bail("The live connection timed out.");
    }, 15_000);

    client.connection.on("disconnected", () => live && setDropped(true));
    client.connection.on("suspended", () => live && setDropped(true));
    client.connection.on("connected", () => live && setDropped(false));

    const onMsg = (msg: { name?: string; data?: unknown }) => {
      poke();
      switch (msg.name) {
        case "player_joined": {
          if (role !== "guest") return;
          const { setup: theirs, turns: theirs2 } = msg.data as Joined;
          setSetup(theirs);
          round.current = theirs2;
          setTurns(theirs2);
          setDesync(false);
          return;
        }
        case "speech_submitted": {
          const t = msg.data as LiveTurn;
          round.current = [...round.current, t];
          setTurns(round.current);
          return;
        }
        case "turn_advanced": {
          // their count vs ours, a disagreement means a speech went missing
          const { at } = msg.data as { at: number };
          if (at === round.current.length) return;
          setDesync(true);
          if (role === "guest") void channel.presence.update({ role } satisfies Member);
          return;
        }
        case "ballot_returned": {
          const { ballot: b } = msg.data as { ballot: Ballot };
          setBallot(role === "guest" ? mirror(b) : b);
          return;
        }
        case "room_closed": {
          const { reason } = msg.data as { reason: Closed };
          // somebody left, room lives on
          if (reason === "left") {
            setTogether(false);
            return;
          }
          setClosed(reason);
          setStage("closed");
          return;
        }
      }
    };

    const onEnter = (m: PresenceMessage) => {
      if (m.clientId === id) return;
      poke();
      setTogether(true);
      setArrived(true);
      if (role === "host" && mine)
        void push({ name: "player_joined", data: { setup: mine, turns: round.current } });
    };

    const onLeave = (m: PresenceMessage) => {
      if (m.clientId === id) return;
      poke();
      setTogether(false);
      setDeparted({ role: roleOf(m), at: m.timestamp });
    };

    void (async () => {
      try {
        await channel.attach();
        if (!live) return;

        channel.subscribe(onMsg);
        channel.presence.subscribe(["enter", "update"], onEnter);
        // measured at 15.2s from a tab closing to this firing, ably's timing
        channel.presence.subscribe(["leave", "absent"], onLeave);

        const before = seated(await channel.presence.get());
        if (!live) return;

        if (role === "host") {
          if (before.length > 0) {
            setStage("taken");
            return;
          }
        } else {
          if (before.length >= ROOM_SIZE) {
            setStage("full");
            return;
          }
          if (!before.some((m) => roleOf(m) === "host")) {
            setStage("empty");
            return;
          }
        }

        await channel.presence.enter({ role } satisfies Member);
        if (!live) return;

        // two people can pass the check at the same instant, so check again after entering
        const after = seated(await channel.presence.get());
        if (!live) return;
        if (after.findIndex((m) => m.clientId === id) >= ROOM_SIZE) {
          await channel.presence.leave();
          if (!live) return;
          setStage("full");
          return;
        }

        const others = after.filter((m) => m.clientId !== id);
        setTogether(others.length > 0);
        setArrived(others.length > 0);
        setStage("open");
        poke();

        if (role === "guest" && others.length > 0)
          await channel.presence.update({ role } satisfies Member);
      } catch (e) {
        if (!live) return;
        console.error("room:join rip", e);
        const said = await why("Could not join that room. Check the code and try again.");
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
      void channel.presence.leave().catch(() => {});
      client.close();
      chan.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, role]);

  const say = useCallback(
    async (t: LiveTurn) => {
      round.current = [...round.current, t];
      setTurns(round.current);
      poke();
      await push({ name: "speech_submitted", data: t });
      await push({ name: "turn_advanced", data: { at: round.current.length } });
    },
    [push, poke]
  );

  const publishBallot = useCallback(
    async (b: Ballot) => {
      setBallot(b);
      await push({ name: "ballot_returned", data: { ballot: b } });
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
