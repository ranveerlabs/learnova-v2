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

export type Stage =
  | "connecting"
  | "full"
  | "empty"
  | "taken"
  | "open"
  | "closed"
  | "error";

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

function tabId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

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
  setup: LiveSetup | null;
}): Room {
  const [stage, setStage] = useState<Stage>("connecting");
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
  const round = useRef<LiveTurn[]>([]);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const closeNow = useRef(close);
  closeNow.current = close;

  const stir = useCallback(() => {
    if (idle.current) clearTimeout(idle.current);
    idle.current = setTimeout(() => {
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
      echoMessages: false,
    });

    const channel = client.channels.get(channelFor(code));
    chan.current = channel;

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

    const giveUp = (fallback: string) => {
      void (async () => {
        const said = await explain(fallback);
        if (!live) return;
        setError(said);
        setStage("error");
      })();
    };

    client.connection.on("failed", () => giveUp("The live connection could not be opened."));

    const deadline = setTimeout(() => {
      if (live && stageAt.current === "connecting") giveUp("The live connection timed out.");
    }, 15_000);

    client.connection.on("disconnected", () => live && setDropped(true));
    client.connection.on("suspended", () => live && setDropped(true));
    client.connection.on("connected", () => live && setDropped(false));

    const apply = (msg: { name?: string; data?: unknown }) => {
      stir();
      switch (msg.name) {
        case "player_joined": {
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
          const { at } = msg.data as { at: number };
          if (at === round.current.length) return;
          setDesync(true);
          if (role === "guest") void channel.presence.update({ role } satisfies Member);
          return;
        }
        case "ballot_returned": {
          const { ballot: verdict } = msg.data as { ballot: Ballot };
          setBallot(role === "guest" ? mirror(verdict) : verdict);
          return;
        }
        case "room_closed": {
          const { reason } = msg.data as { reason: Closed };

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
      if (m.clientId === clientId) return;
      stir();
      setTogether(true);
      setArrived(true);
      if (role === "host" && hostSetup) {
        void push({
          name: "player_joined",
          data: { setup: hostSetup, turns: round.current },
        });
      }
    };

    const onLeave = (m: PresenceMessage) => {
      if (m.clientId === clientId) return;
      stir();
      setTogether(false);
      setDeparted({ role: roleOf(m), at: m.timestamp });
    };

    void (async () => {
      try {
        await channel.attach();
        if (!live) return;

        channel.subscribe(apply);
        channel.presence.subscribe(["enter", "update"], onEnter);
        // measured at 15.2s from a tab closing to this firing. it's ably's timing, not ours.
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
      void channel.presence.leave().catch(() => {});
      client.close();
      chan.current = null;
    };
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
