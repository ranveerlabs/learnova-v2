"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

function readableError(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone blocked. Allow it in browser settings or type instead.";
    case "no-speech":
      return "Nothing heard. Try again or type instead.";
    case "audio-capture":
      return "No microphone found. Type instead.";
    case "network":
      return "Speech input failed. Check your connection or type instead.";
    case "aborted":
      return "";
    default:
      return "Speech stopped. Type instead.";
  }
}

export type Speech = {
  supported: boolean;
  listening: boolean;
  transcript: string;
  interim: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
};

export function useSpeech(): Speech {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognizer = useRef<SpeechRecognizer | null>(null);

  useEffect(() => {
    setSupported(recognizerClass() !== null);
  }, []);

  useEffect(() => {
    return () => {
      recognizer.current?.abort();
      recognizer.current = null;
    };
  }, []);

  const start = useCallback(() => {
    const Recognizer = recognizerClass();
    if (!Recognizer) {
      setError("Speech input isn't available here. Type instead.");
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
