import Link from "next/link";
import { AudioControls } from "./audio-controls";
import { PixelSprite, PixelTag } from "./paper";
import { Credits, Win } from "./ui";
import { BuildNote } from "./buildnote";
import { openCount } from "./feed/limits";
import { BUILD } from "@/lib/build";

export default function Landing() {
  return (
    <div className="relative z-10 flex h-full min-h-0 flex-1 flex-col p-4 sm:p-8">
      <Win
        title="Learnova"
        className="mx-auto w-full max-w-[60rem] flex-1"
        bodyClassName="p-5 sm:p-8"
      >
        <main className="flex w-full flex-col justify-center gap-10">
          <div className="rise flex flex-col gap-5">
            <div className="flex items-center gap-2">
              <PixelTag className="press-on -rotate-2">
                two ways to know it
              </PixelTag>
              <PixelSprite
                name="star"
                scale={2}
                className="press-on"
                style={{ ["--tilt" as string]: "12deg", ["--i" as string]: 1 }}
              />
              <AudioControls className="ml-auto" />
            </div>

            <h1 className="font-pixel text-[clamp(2rem,1.2rem+3.2vw,3.25rem)] leading-[1.1] text-ink">
              Learnova
            </h1>

            <p className="max-w-[34ch] font-hand text-[1.5rem] leading-[1.25] text-ink-soft">
              Learn it until you can explain it. Then go and defend it.
            </p>
          </div>

          <div
            className="rise grid gap-4 sm:grid-cols-2"
            style={{ ["--i" as string]: 1 }}
          >
            <Door
              href="/round"
              sprite="pencil"
              tilt="-1.2deg"
              name="Round Mode"
              line="Name a topic and start guessing. Five rounds take the help away one step at a time, until you are explaining it with nothing on screen."
            />
            <Door
              href="/debate"
              sprite="clip"
              tilt="1.4deg"
              name="Debate"
              line="Pick a side and hold it for four speeches, against model or against friend on a four-letter code. Judged ballot at the end."
            />
          </div>

          <div className="rise self-start" style={{ ["--i" as string]: 3 }}>
            <Credits />
          </div>
        </main>
      </Win>

      <BuildNote sha={BUILD.sha} issues={openCount} />
    </div>
  );
}

function Door({
  href,
  sprite,
  tilt,
  name,
  line,
}: {
  href: string;
  sprite: "pencil" | "clip";
  tilt: string;
  name: string;
  line: string;
}) {
  return (
    <Link
      href={href}
      style={{ ["--tilt" as string]: tilt }}
      className="stuck sticker group flex flex-col gap-3 border-[2.5px] border-sheet-ink bg-cream p-5 sm:p-6"
    >
      <PixelSprite name={sprite} scale={3} />

      <span className="font-hand text-[2rem] leading-[1] text-sheet-ink">
        {name}
      </span>

      <span className="font-sans text-[0.875rem] leading-[1.6] text-sheet-soft">
        {line}
      </span>

      <span className="mt-auto inline-flex items-center gap-2 pt-2 font-pixel text-[0.6875rem] leading-none text-sheet-ink">
        start
        <span aria-hidden className="arrow">
          →
        </span>
      </span>
    </Link>
  );
}
