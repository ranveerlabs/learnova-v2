"use client";

import { useEffect, useState } from "react";
import { audioWanted, setAudioWanted } from "./audio";
import { setMusic } from "./music";
import { AudioToggle } from "./ui";

export function AudioControls({ className = "" }: { className?: string }) {
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

  return (
    <div className={`flex shrink-0 items-center gap-2 ${className}`}>
      <AudioToggle on={on} onToggle={flip} />
    </div>
  );
}
