"use client";

import { useCallback, useEffect, useState } from "react";
import { audioWanted, type Channel, setAudioWanted } from "./audio";
import { setMusic } from "./music";
import { MusicToggle, SoundToggle } from "./ui";

export function AudioControls({ className = "" }: { className?: string }) {
  const [music, setMusicOn] = useState(() => audioWanted().music);
  const [sound, setSound] = useState(() => audioWanted().sound);

  useEffect(() => {
    setMusic(music);
  }, [music]);

  const flip = useCallback((channel: Channel, on: boolean) => {
    setAudioWanted(channel, on);
    if (channel === "music") {
      setMusicOn(on);
      setMusic(on);
    } else {
      setSound(on);
    }
  }, []);

  return (
    <div className={`flex shrink-0 items-center gap-2 ${className}`}>
      <MusicToggle on={music} onToggle={() => flip("music", !music)} />
      <SoundToggle on={sound} onToggle={() => flip("sound", !sound)} />
    </div>
  );
}
