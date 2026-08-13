"use client";

import { useCallback, useEffect, useState } from "react";
import { audioWanted, type Channel, setAudioWanted } from "./audio";
import { setMusic } from "./music";
import { MusicToggle, SoundToggle } from "./ui";

/* The two audio controls, and the only thing that starts the music.

   One component on every screen of the app, including the landing page. That
   last part is the whole reason it exists: the music used to be started by
   whichever mode you were in, so the first screen anybody saw was silent and
   had no control on it either, and the honest reading of that is "the music
   does not play". It plays from the moment somebody touches the front door.

   ── Why the music starts here rather than at a button ────────────────────
   `setMusic` is asked for on mount, which a browser will refuse on a page
   nobody has touched yet. That refusal is not a failure and there is nothing
   to tell anybody about it: music.ts takes it as the signal to wait for the
   first real gesture on the document, whatever it turns out to be. On the
   landing that gesture is usually the click on a mode, and because moving
   between routes is a navigation inside the same document, the track carries
   straight on into the mode rather than restarting.

   The state is seeded from audio.ts and written back to it on every flip, so
   a person who mutes in one mode stays muted in the other and on the way
   back. This component is mounted and unmounted constantly as routes change;
   the setting is not allowed to be. */
export function AudioControls({ className = "" }: { className?: string }) {
  const [music, setMusicOn] = useState(() => audioWanted().music);
  const [sound, setSound] = useState(() => audioWanted().sound);

  useEffect(() => {
    setMusic(music);
  }, [music]);

  /** Flip one channel, and tell the rest of the app synchronously.

      The write to audio.ts happens in the click rather than in an effect, and
      for music the call to music.ts does too. React batches state, so an
      effect does not run until after the click has finished propagating, and
      music.ts is meanwhile listening on window for the first gesture on the
      page. Without the synchronous write, somebody whose very first action is
      hitting mute gets a blip of the track they were switching off: the window
      listener fires with the old value still in place, starts it, and the
      effect pauses it a frame later. */
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
