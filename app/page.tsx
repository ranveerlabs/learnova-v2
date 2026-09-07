import Link from "next/link";
import { AudioControls } from "./audio-controls";
import { PixelSprite } from "./paper";
import { Credits, Win } from "./ui";
import { BuildNote } from "./buildnote";
import { openCount } from "./feed/limits";
import { BUILD } from "@/lib/build";

export default function Landing() {
  return (
    <div className="relative z-10 flex h-full min-h-0 flex-1 flex-col overflow-y-auto p-3 sm:p-8">
      <main className="m-auto flex w-full max-w-[38rem] flex-col gap-8 sm:gap-10">
        <Win
          title="Learnova"
          icon={<PixelSprite name="logo" scale={1} />}
          bodyClassName="flex flex-col gap-5 p-5 sm:p-7"
        >
          <div className="flex items-center gap-4">
            <PixelSprite name="logo" scale={4} title="Learnova" />
            <h1 className="font-pixel text-[clamp(1.5rem,5vw,2.25rem)] leading-none text-ink">
              Learnova
            </h1>
            <AudioControls className="ml-auto" />
          </div>

          <p className="max-w-[34ch] font-hand text-[1.75rem] leading-[1.15] text-ink-soft">
            you guess at it til the hints run out, then you argue for it
          </p>

          <Credits />
        </Win>

        <div className="flex flex-wrap justify-center gap-4 sm:gap-10">
          <Shortcut
            href="/round"
            sprite="pencil"
            name="Round Mode"
            line="less help every round"
          />
          <Shortcut
            href="/debate"
            sprite="clip"
            name="Debate"
            line="four speeches, one side"
          />
        </div>
      </main>

      <BuildNote sha={BUILD.sha} issues={openCount} />
    </div>
  );
}

function Shortcut({
  href,
  sprite,
  name,
  line,
}: {
  href: string;
  sprite: "pencil" | "clip";
  name: string;
  line: string;
}) {
  return (
    <Link
      href={href}
      className="shortcut flex w-[10.5rem] flex-col items-center gap-2 p-3 text-center sm:w-[15rem]"
    >
      <span className="flex h-[5.25rem] items-end">
        <PixelSprite name={sprite} scale={5} />
      </span>

      <span className="label font-pixel text-[0.8125rem] leading-none text-cream">
        {name}
      </span>

      <span className="font-hand text-[1.0625rem] leading-[1.2] text-cream/55">
        {line}
      </span>
    </Link>
  );
}
