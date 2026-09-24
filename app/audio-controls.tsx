"use client";

import { useEffect, useState } from "react";
import { audioWanted, setAudioWanted } from "./audio";
import { setMusic } from "./music";
import { AudioToggle } from "./ui";

export function AudioControls() {
  const [on, setOn] = useState(() => {
    const wanted = audioWanted();
    return wanted.music || wanted.sound;
  });

  useEffect(() => {
    setMusic(on);
  }, [on]);

  function flip() {
    const next = !on;
    setAudioWanted("music", next);
    setAudioWanted("sound", next);
    setOn(next);
    setMusic(next);
  }

  return <AudioToggle on={on} onToggle={flip} />;
}
