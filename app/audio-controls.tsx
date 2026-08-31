"use client";

import { useCallback, useEffect, useState } from "react";
import { audioWanted, setAudioWanted } from "./audio";
import { setMusic } from "./music";
import { AudioToggle } from "./ui";

export function AudioControls({ className = "" }: { className?: string }) {
  const [music, setMusicOn] = useState(() => audioWanted().music);
  const [sound, setSound] = useState(() => audioWanted().sound);

  useEffect(() => {
    setMusic(music);
  }, [music]);

  // one button, so both channels move together
  const on = music || sound;
  const flipBoth = useCallback(() => {
    const next = !on;
    setAudioWanted("music", next);
    setAudioWanted("sound", next);
    setMusicOn(next);
    setSound(next);
    setMusic(next);
  }, [on]);

  return (
    <div className={`flex shrink-0 items-center gap-2 ${className}`}>
      <AudioToggle on={on} onToggle={flipBoth} />
    </div>
  );
}
