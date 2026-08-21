import Link from "next/link";
import { AudioControls } from "./audio-controls";
import { PixelSprite, PixelTag } from "./paper";
import { Credits } from "./ui";

/* The front door of the whole app.

   There are two modes and until now there was no screen that said so. Round
   Mode owned the root and debate was a card near the bottom of it, which made
   one of them the product and the other a feature of it. They are not that.
   One is practice at explaining something and the other is practice at
   defending it, and a person arriving has a real choice to make between them.

   So the root is a door with two handles and nothing else on it. No field, no
   settings, no history, no explanation of the pedagogy. Everything that used
   to crowd this screen belongs to whichever mode it is actually about, and is
   one click away inside it.

   ── What this costs and why it is worth it ────────────────────────────────
   It costs a click before the topic field, and the topic field's whole design
   was "no gate": one input, focused, ten seconds to a question. That promise
   now starts one tap later, and that is the trade. It buys the thing the old
   arrangement could not do at any price: a person who came here to argue
   finds the thing they came for immediately, instead of scrolling past
   somebody else's product to reach it.

   The desk furniture stays. This is the screen that is allowed to have a
   personality, and now it is the screen everybody sees first. */

export default function Landing() {
  return (
    <div className="relative z-10 flex h-full min-h-0 flex-1 flex-col overflow-y-auto">
      <main className="mx-auto flex w-full max-w-[60rem] flex-1 flex-col justify-center gap-10 px-5 py-10 sm:px-8 sm:py-14">
        <div className="rise flex flex-col gap-5">
          <div className="flex items-center gap-2">
            <PixelTag className="press-on -rotate-2">two ways to know it</PixelTag>
            <PixelSprite
              name="star"
              scale={2}
              className="press-on"
              style={{ ["--tilt" as string]: "12deg", ["--i" as string]: 1 }}
            />
            {/* The music starts here, on the first screen, rather than
                waiting for a mode to be chosen. The controls come with it,
                because a track nobody can stop is not a feature. */}
            <AudioControls className="ml-auto" />
          </div>

          <h1 className="font-hand text-[clamp(3.25rem,2rem+5vw,5.5rem)] leading-[0.9] tracking-tight text-ink">
            Learnova
          </h1>

          <p className="max-w-[34ch] font-hand text-[1.5rem] leading-[1.25] text-ink-soft">
            Learn it until you can explain it. Then go and defend it.
          </p>
        </div>

        {/* The two doors.

            Equal weight on purpose. Same size, same treatment, same distance
            from the title, and neither is pre-selected or marked as the usual
            one, because which of them a person wants is a fact about them and
            not a default this screen gets to guess at. */}
        <div className="rise grid gap-4 sm:grid-cols-2" style={{ ["--i" as string]: 1 }}>
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
            line="Pick a side and hold it for four speeches, against the model or against a friend on a four-letter code. Judged ballot at the end."
          />
        </div>

        {/* The "Watch it invent something, then catch itself" strip stood
            here, linking to /proof. Both are gone.

            It was a third way in on a screen whose whole argument is that
            there are two, and it asked somebody who had not yet decided to
            spend ten minutes studying to spend thirty seconds watching
            instead. The two doors above are the screen. */}

        {/* The licence credit for the background track, which both modes play.
            It is here rather than inside either of them now: this is the one
            screen every visit begins on, which makes it the least buried place
            an attribution can sit. */}
        <div className="rise self-start" style={{ ["--i" as string]: 3 }}>
          <Credits />
        </div>
      </main>
    </div>
  );
}

/** One mode, as a scrap pinned to the desk.

    A link rather than a button, so it is a place you go rather than a thing
    that happens: middle-click, open in a tab, and the back button all work
    the way somebody expects a door to work. */
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
      className="stuck sticker group flex flex-col gap-3 rounded-[3px] border-[2.5px] border-sheet-ink bg-sheet p-5 sm:p-6"
    >
      <PixelSprite name={sprite} scale={3} />

      <span className="font-hand text-[2rem] leading-[1] text-sheet-ink">{name}</span>

      <span className="font-sans text-[0.875rem] leading-[1.6] text-sheet-soft">{line}</span>

      <span className="mt-auto inline-flex items-center gap-2 pt-2 font-pixel text-[0.6875rem] leading-none text-sheet-ink">
        start
        <span aria-hidden className="arrow">
          →
        </span>
      </span>
    </Link>
  );
}
