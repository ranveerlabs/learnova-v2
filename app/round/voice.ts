"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* Speech input for Round 4.

   The contract this file exists to enforce: nothing here ever submits
   anything. It produces text and hands it back. The student sees the
   transcript, corrects it if the recogniser misheard them, and submits it
   themselves. Audio never leaves the browser at all: the Web Speech API in
   Chrome and Edge does its recognition against Google's service, so the
   audio goes there rather than to us, and what our server receives is text
   the student read and approved.

   Support is genuinely partial and always will be. Chrome and Edge are good,
   Safari is patchy, Firefox has nothing. So this reports what it can do and
   the interface keeps a typed field visible at all times rather than putting
   the round behind a microphone that may not exist. */

/* ── The shim ─────────────────────────────────────────────────────────────
   None of the SpeechRecognition interfaces are in TypeScript's DOM library,
   because the spec has never left draft. These are the parts actually used
   here, typed narrowly rather than reached for through `any`. */

type SpeechAlternative = { transcript: string; confidence: number };

type SpeechResult = {
  readonly length: number;
  readonly isFinal: boolean;
  [index: number]: SpeechAlternative;
};

type SpeechResultList = {
  readonly length: number;
  [index: number]: SpeechResult;
};

type SpeechResultEvent = {
  readonly resultIndex: number;
  readonly results: SpeechResultList;
};

type SpeechErrorEvent = {
  readonly error: string;
  readonly message?: string;
};

interface SpeechRecognizer {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onerror: ((e: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type RecognizerConstructor = new () => SpeechRecognizer;

type SpeechCapableWindow = Window & {
  SpeechRecognition?: RecognizerConstructor;
  webkitSpeechRecognition?: RecognizerConstructor;
};

function recognizerClass(): RecognizerConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as SpeechCapableWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/* ── Why a particular attempt failed, in words a student can act on ─────── */

function readableError(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Your browser blocked microphone access. Allow it in the address bar, or just type your answer.";
    case "no-speech":
      return "Nothing was picked up. Try again, or type it instead.";
    case "audio-capture":
      return "No microphone was found. Type your answer instead.";
    case "network":
      return "Speech recognition needs a network connection and could not reach it. Type your answer instead.";
    case "aborted":
      return "";
    default:
      return "Speech input stopped unexpectedly. Type your answer instead.";
  }
}

export type Speech = {
  /** Whether this browser can do speech recognition at all. Decided after
      mount, so the server and the first client render agree. */
  supported: boolean;
  listening: boolean;
  /** Everything recognised and settled so far this attempt. */
  transcript: string;
  /** The current in-progress phrase, still being revised as they speak. */
  interim: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  /** Throw away what was captured and start from nothing. */
  reset: () => void;
};

export function useSpeech(): Speech {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognizer = useRef<SpeechRecognizer | null>(null);

  /* Capability is read after mount rather than during render. Deciding it
     during render would make the server's HTML and the browser's first pass
     disagree about whether the microphone exists. */
  useEffect(() => {
    setSupported(recognizerClass() !== null);
  }, []);

  useEffect(() => {
    return () => {
      /* Leaving the round with the microphone still open would keep it open.
         `abort` rather than `stop`: there is no transcript left to deliver. */
      recognizer.current?.abort();
      recognizer.current = null;
    };
  }, []);

  const start = useCallback(() => {
    const Recognizer = recognizerClass();
    if (!Recognizer) {
      setError("This browser cannot do speech input. Type your answer instead.");
      return;
    }

    recognizer.current?.abort();
    const rec = new Recognizer();
    recognizer.current = rec;

    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.lang = typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US";

    rec.onstart = () => {
      setListening(true);
      setError(null);
    };

    rec.onresult = (event) => {
      let settled = "";
      let pending = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) settled += text;
        else pending += text;
      }
      if (settled) {
        setTranscript((prev) => `${prev}${prev && !prev.endsWith(" ") ? " " : ""}${settled.trim()}`);
      }
      setInterim(pending);
    };

    rec.onerror = (event) => {
      const message = readableError(event.error);
      if (message) setError(message);
      setListening(false);
    };

    rec.onend = () => {
      setListening(false);
      /* Anything still in flight when the recogniser stops is the last thing
         they said. Dropping it would silently lose the end of a sentence. */
      setInterim((pending) => {
        if (pending.trim()) {
          setTranscript((prev) => `${prev}${prev && !prev.endsWith(" ") ? " " : ""}${pending.trim()}`);
        }
        return "";
      });
    };

    try {
      rec.start();
    } catch {
      /* Calling start twice throws. Nothing has gone wrong for the student. */
      setListening(false);
    }
  }, []);

  const stop = useCallback(() => {
    recognizer.current?.stop();
  }, []);

  const reset = useCallback(() => {
    recognizer.current?.abort();
    setTranscript("");
    setInterim("");
    setError(null);
    setListening(false);
  }, []);

  return { supported, listening, transcript, interim, error, start, stop, reset };
}

/* ── Sound ────────────────────────────────────────────────────────────────
   Off by default and synthesised rather than loaded, so enabling it costs no
   download and there are no audio assets in the repository.

   Kept short and soft on purpose. A study tool that chimes triumphantly every
   few seconds is unusable in a library, and this mode is fast enough that
   anything longer than about a tenth of a second would still be playing when
   the next question arrives. */

type Tone = "right" | "wrong" | "combo" | "done";

let audio: AudioContext | null = null;

/** The session's one audio context, shared with music.ts.

    One rather than two, because a browser gives a page a small number of them
    and because the gesture that unlocks one should unlock everything: a
    student who clicks start and hears the music but not the answer tones would
    reasonably conclude the sounds are broken. */
export function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    audio ??= new AudioContext();
    return audio;
  } catch {
    return null;
  }
}

const TONES: Record<Tone, { freq: number[]; ms: number; gain: number; type: OscillatorType }> = {
  /* A rising two-note figure. Up means right in every musical culture this
     interface is likely to meet. */
  right: { freq: [660, 990], ms: 90, gain: 0.05, type: "sine" },
  /* Down, quiet, and low. Audible as "not that" without being a buzzer. */
  wrong: { freq: [300, 220], ms: 130, gain: 0.035, type: "sine" },
  /* Higher each time a combo climbs, which the caller varies by tier. */
  combo: { freq: [880, 1320], ms: 110, gain: 0.05, type: "triangle" },
  done: { freq: [523, 784, 1047], ms: 150, gain: 0.055, type: "sine" },
};

/** Play one of the session's sounds. Silent and harmless when the browser
    has no audio, when the context is suspended, or when anything at all goes
    wrong: sound is a garnish and must never be able to break a round. */
export function play(tone: Tone, heat = 0): void {
  const ctx = context();
  if (!ctx) return;

  try {
    if (ctx.state === "suspended") void ctx.resume();

    const spec = TONES[tone];
    const now = ctx.currentTime;
    const step = spec.ms / 1000 / spec.freq.length;

    spec.freq.forEach((base, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = spec.type;
      /* A run that is going well climbs in pitch as well as in numbers. */
      osc.frequency.value = base * (1 + heat * 0.18);

      const at = now + i * step;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(spec.gain, at + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + step);

      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + step + 0.02);
    });
  } catch {
    /* Nothing to do and nothing to say. */
  }
}
