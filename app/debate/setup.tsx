"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Record } from "../tally";
import { PixelSprite } from "../paper";
import { type Book, standing } from "../standing";
import { Label, PrimaryButton, useAutoGrow } from "../ui";
import { handOff } from "./live/handoff";
import { ALPHABET, CODE_LENGTH, makeCode, readCode } from "./live/room";
import {
  FORMATS,
  type Format,
  type Setup,
  type Side,
  type Tab,
  TIERS,
  type TierId,
} from "./types";

/* Agreeing what is about to be argued.

   ── One field and two buttons ─────────────────────────────────────────────
   This screen used to ask five questions before anybody could argue: which
   tab, what motion, which format, which side, which opponent. Every one of
   them had a good reason, and all five together were a form standing between
   somebody and the thing they came to do. Round Mode's front door settled
   this argument years earlier and settled it the other way: one field, no
   gate, and the better-but-heavier option folded away underneath.

   So the whole of the required path is now: type what you are arguing about,
   press the side you want. The side is not a separate control at all. It is
   which button you press, because you were going to press a button anyway and
   a question answered by an action you were already taking costs nothing.

   Everything else has a defensible default and lives in the fold: open debate,
   Varsity, and Public Forum if the fold is ever opened. Somebody preparing for
   a real tournament is exactly the person who will open a fold labelled
   "tournament formats", and they only have to do it once per round.

   What went, and why it is not missed: a coin-flip button for the side, which
   was authentic and was also a third button answering a question the other two
   already answer.

   ── Why it is a note and two slabs now ────────────────────────────────────
   The shape above was right and the drawing of it was not. Every control on
   the screen was the same grey pill at the same size — the opponent toggle,
   the two sides, the suggestions, the fold's three rows — so a screen with
   one required field and one required decision on it read as a form with six
   questions. That is the complaint this mode kept getting, and no amount of
   cutting prose was going to answer it, because the prose was not the problem.

   Two changes, and nothing else moved:

   The motion is written on a sticky note. It is the object a person actually
   uses for this — you write down what the argument is about before you argue
   it — and it is the same note that comes back at the top of the ballot at
   the end, so the thing you wrote is the thing you are judged on and it looks
   like it the whole way through. It also does the heading's job: a page with
   a blank note on it does not need a line of type above the field telling you
   there is a field.

   The two sides are slabs, in the desk palette the rest of the app stickers
   things with, and they lean apart when you reach for them. Deliberately NOT
   the marking colours: mint and pink are the stationery set, and green over
   red would say one side of a motion is the correct one. Nothing on this
   screen knows which side is right, which is the entire point of the mode. */

/** What the fold was left set to last time.

    This screen is unmounted between rounds and remembers nothing on its own,
    so without it somebody drilling Lincoln-Douglas against Circuit got Public
    Forum against Varsity back on the second round, silently. Held by the page
    and handed back in, because the page is the thing that survives a round. */
export type Defaults = { tab: Tab; format: Format; tierId: TierId };

/** Novice, and this changed.

    It was Varsity, on the reasoning that Varsity was rated level with a
    beginner and a level first round is the only one whose result carries
    information either way. That was a good argument about a rating and a bad
    one about a person. Somebody opening this screen for the first time has
    never written a speech; the opponent they meet first should be the one
    whose brief says it misses some of what you said, not the one whose brief
    says it will punish a dropped argument.

    The rating argument no longer holds either. Varsity moved off level when
    the tiers were retuned, so a beginner is now a 43% underdog against it,
    and Novice is the tier that actually sits near a new player.

    Anybody who wants a harder round opens the fold, which is one click and
    stays open for the rest of the session. Nobody preparing for a tournament
    is going to be stopped by that; a fifteen-year-old who loses their first
    four rounds is going to be stopped by losing their first four rounds. */
export const DEFAULTS: Defaults = {
  tab: "casual",
  format: "Public Forum",
  tierId: "novice",
};

/** Who you are arguing against. The first question, and now the only one
    that is asked before the motion.

    ── What this replaced, and why ──────────────────────────────────────────
    Playing a person used to be a different route. This screen had a `live`
    flag, `/debate/live` had its own copy of the screen to set it, and the
    way you found any of it was a line of prose under the suggestions saying
    "got somebody to argue with?". Three places, one of which was a link
    somebody had to read, for a choice that is the first thing anybody makes.

    It is two buttons now, in the row where the mode already asks its other
    two-answer questions, above the field rather than below it. Nothing else
    on the screen moves when you press them: the same motion note, the same
    two side slabs, the same format fold. What changes is where the side you
    press sends you, and that is the whole of the difference between the two. */
export type Against = "model" | "friend";

export function Setup({
  onBegin,
  initial,
}: {
  onBegin: (setup: Setup) => void;
  initial: Defaults;
}) {
  const router = useRouter();
  const [against, setAgainst] = useState<Against>("model");
  const [tab, setTab] = useState<Tab>(initial.tab);
  const [motion, setMotion] = useState("");
  const [format, setFormat] = useState<Format>(initial.format);
  const [tierId, setTierId] = useState<TierId>(initial.tierId);
  const live = against === "friend";

  /* One flight only. `router.push` is not instant and the side buttons are
     exactly the sort of thing an impatient person presses twice; without
     this the second press mints a second code and the host lands in a room
     whose code they have already read out. */
  const [going, setGoing] = useState(false);

  const field = useRef<HTMLTextAreaElement>(null);
  useAutoGrow(field, motion, 2);
  useEffect(() => {
    field.current?.focus();
  }, []);

  /* The typewriter that wrote a suggestion onto the note a character at a
     time went with the suggestions themselves. It existed only to make the
     chips feel like handwriting; with nothing left to write, the interval,
     its ref and the two `stopWriting` calls that guarded it are all gone. */

  /* Read after mount for the same reason the study record is: local storage
     does not exist on the server, and rendering a rating during the server
     pass would make the first client render disagree with the HTML. */
  const [book, setBook] = useState<Book | null>(null);
  useEffect(() => {
    setBook(standing());
  }, []);

  const ready = motion.trim().length > 0;

  /** One press, two destinations.

      Against the model this starts the round in place, which is what it has
      always done. Against a friend it mints a code, leaves the motion where
      the room screen will pick it up, and goes there. Same press, same
      question answered — which side do you want — and the only thing the
      toggle above decides is who is in the other chair. */
  function begin(side: Side) {
    if (!ready || going) return;

    const chosen: Setup = {
      tab,
      motion: motion.trim(),
      side,
      /* Left off entirely in a live room rather than sent as a default. The
         field means "how hard the model argues", and there is no model. */
      tierId: live ? undefined : tierId,
      format: tab === "competitive" ? format : undefined,
    };

    if (!live) {
      onBegin(chosen);
      return;
    }

    setGoing(true);
    const { tierId: _tier, ...forRoom } = chosen;
    const code = makeCode();
    handOff(code, forRoom);
    router.push(`/debate/live/${code}`);
  }

  return (
    <section className="flex w-full flex-col gap-6 pb-4">
      {/* The first question, and the only one above the note.

          It was a labelled row of two grey pills, which is the shape the
          fold uses for questions nobody has to answer. This one is answered
          by everybody, so it is drawn as what it is: two people you could be
          arguing with, told apart by the object beside them rather than by
          which of two identical rectangles is filled in. */}
      <Opponent value={against} onPick={setAgainst} />

      {/* The one required field, on the object it belongs on.

          Enter starts the round for the affirmative and Shift+Enter is a
          newline, which is the same pair every other writing surface in the
          app uses. Somebody who types a motion and hits return has said what
          they think, and the affirmative is the side that reads as agreeing
          with a sentence you just wrote. */}
      <div className="flex flex-col items-start gap-4">
        {/* The same proportions the ballot's note is drawn at, because it is
            the same note: roughly square, wide enough for a motion and short
            enough that a one-line motion does not flatten it into a banner. */}
        <div
          className="note sticky flex min-h-[7.5rem] w-full max-w-[20rem] rounded-[2px] pb-7 pl-5 pr-6 pt-5"
          style={{ ["--tilt" as string]: "-1.1deg" }}
        >
          <textarea
            ref={field}
            value={motion}
            onChange={(e) => {
              setMotion(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
              e.preventDefault();
              begin("Pro");
            }}
            rows={2}
            placeholder="What are you arguing about?"
            aria-label="What are you arguing about?"
            className="block w-full resize-none overflow-hidden border-0 bg-transparent p-0 font-hand text-[1.5rem] leading-[1.15] text-[#262626] caret-[#262626] placeholder:text-[#7c6f4f]"
          />
        </div>

        {/* Three suggested motions sat here, writing themselves onto the note
            a character at a time. The gesture was the best thing on the
            screen and it was still answering a question nobody asked: the
            note is blank and says so, and anybody arguing about something
            already knows what it is. */}
      </div>

      {/* The two sides.

          Side by side and the same size, because the screen has no opinion
          about which one you should take, and leaning apart on hover, which
          is the one gesture that is about what these two buttons are rather
          than about being buttons. `--swing` is what makes them lean opposite
          ways; see globals.css.

          No arrow on either. An arrow on a pair of equals has to point
          somewhere, and every direction available says something untrue: at
          each other reads as a collision, both to the right makes one of them
          the way on and the other a detour. */}
      <div className="grid gap-3 sm:max-w-[30rem] sm:grid-cols-2">
        <SideSlab
          onClick={() => begin("Pro")}
          disabled={!ready || going}
          paper="var(--supply-mint)"
          tilt="-1.4deg"
          swing="-2.4deg"
          word="For it"
        />
        <SideSlab
          onClick={() => begin("Con")}
          disabled={!ready || going}
          paper="var(--supply-pink)"
          tilt="1.2deg"
          swing="2.4deg"
          word="Against it"
        />
      </div>

      {/* The one line of prose on this screen, and only in the live case.

          It is here because the side slabs answer a different question in a
          room than they do in a round: pressing "Against it" alone decides
          what the other person is doing too, and they are not here to be
          asked. Finding that out after reading somebody a code is finding it
          out too late. */}
      {live && (
        <p className="max-w-[46ch] font-sans text-[0.9375rem] leading-[1.6] text-ink-soft">
          Whoever joins takes the other side, and you both write four speeches before it goes to the
          judge. Nothing is saved and nothing about it is counted.
        </p>
      )}

      {/* The other half of playing a person: joining one.

          Beneath the note rather than beside it, because the two are not
          alternatives of equal weight on this screen. Somebody who has been
          given a code is not going to miss a box with their code's shape in
          it; somebody opening a room should not have to read past a join
          field to reach the thing they came for.

          Only in friend mode. In model mode there is no room to join and a
          code box would be a control for a feature that is not switched on. */}
      {live && <Join />}

      {/* What you have played.

          It was an elo with a rung, a rail and a ladder behind it, and it is
          a record now: see standing.ts for why the number went. Round Mode's
          runs are not in it, because they are not debates and this is the
          debate screen; they are counted in Round Mode's own words on Round
          Mode's own results screen.

          Not in a live room. A live round is counted nowhere, and a record
          shown on the way in is a record the reader assumes is at stake. */}
      {book && !live && <Record book={book} />}

      {/* Open already if anything in it has been changed from the default,
          so a returning tournament debater can see their format is still set
          rather than having to open a fold to find out. */}
      <Options
        open={tab !== DEFAULTS.tab || (!live && tierId !== DEFAULTS.tierId)}
        tab={tab}
        onTab={setTab}
        format={format}
        onFormat={setFormat}
        tierId={tierId}
        onTier={setTierId}
        live={live}
      />
    </section>
  );
}

/** One of the two sides of the motion, as a slab you press.

    A `.stuck .sticker` like the doors on the landing and the start button in
    Round Mode, so the biggest decision in the mode is drawn in the same
    object the app already uses for "this is the thing to press". The word is
    in the pixel face at a size you can read from across a table, because the
    two of these are the only controls on the screen that do anything.

    Disabled until there is a motion, and greyed rather than hidden: the pair
    is the answer to "what do I do on this screen", and a screen whose only
    controls appear once you have typed is a screen with nothing on it. */
function SideSlab({
  word,
  paper,
  tilt,
  swing,
  ...props
}: {
  word: string;
  /** The stationery colour, not a marking colour. See the header. */
  paper: string;
  tilt: string;
  /** Which way it cocks when reached for. Opposite signs on the pair. */
  swing: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      style={{ ["--tilt" as string]: tilt, ["--swing" as string]: swing, background: paper }}
      className="stuck sticker flex min-h-[4.5rem] items-center justify-center rounded-[3px] border-[2.5px] border-sheet-ink px-5 py-4 font-pixel text-[0.9375rem] leading-none text-[#262626] disabled:cursor-not-allowed disabled:border-line-strong disabled:bg-sunk disabled:text-ink-faint"
    >
      {word}
    </button>
  );
}

/** Who is in the other chair, as the two objects rather than two words.

    The pressed one sits down into the desk instead of lighting up: a switch
    that is in has moved, and movement is a state you can read at a glance and
    without colour. The sprite is what tells them apart at speed — a clip for
    a transcript the model reads, a star for the person you called over. */
function Opponent({ value, onPick }: { value: Against; onPick: (v: Against) => void }) {
  const options: { id: Against; name: string; sprite: "clip" | "star"; title: string }[] = [
    {
      id: "model",
      name: "The model",
      sprite: "clip",
      title:
        "Four speeches against an opponent that argues to win. Judged ballot, and the result goes on your record.",
    },
    {
      id: "friend",
      name: "A friend",
      sprite: "star",
      title:
        "Opens a room with a short code. They type the code, take the other side, and the round is judged the same way.",
    },
  ];

  return (
    <div role="group" aria-label="Who you are arguing against" className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            onClick={() => onPick(o.id)}
            aria-pressed={on}
            title={o.title}
            className={`btn inline-flex items-center gap-2 rounded-[3px] border-2 px-3 py-2 font-pixel text-[0.625rem] leading-none transition-colors ${
              on
                ? "translate-y-[2px] border-sheet-ink bg-accent-wash text-ink shadow-[inset_0_2px_0_rgb(20_26_38/0.18)]"
                : "border-line-strong text-ink-soft shadow-[0_2px_0_var(--line-strong)] hover:border-accent hover:text-ink"
            }`}
          >
            <PixelSprite name={o.sprite} scale={2} />
            {o.name}
          </button>
        );
      })}
    </div>
  );
}

/** Somebody read you a code. Type it here.

    ── Why this is the whole joining mechanism ──────────────────────────────
    There used to be a link. The host copied a URL, sent it over a chat app,
    and the guest tapped it. That is one tap for the guest and it is the
    wrong shape for where this actually gets used: two people at one table,
    or a room with a projector, where there is no chat between them and the
    fastest path from one screen to the other is a person's voice. A link
    cannot be read out. Four characters can.

    So the link is gone rather than kept as a second option. Two ways to do
    one thing is two things to explain, two paths to keep working, and a host
    screen that has to offer both. The code is what a code is good at.

    Upper-cased as it is typed, and validated with the same `readCode` the
    room screen uses, so a typo is answered here rather than by a room that
    turns out not to exist. */
function Join() {
  const [code, setCode] = useState("");
  const router = useRouter();
  const good = readCode(code);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (good) router.push(`/debate/live/${good}`);
      }}
      /* Colour-coded, because this is the one thing on the screen that is
         not opening a room, and it used to be the same gold as the two side
         slabs that are. See --supply-ice. */
      className="flex flex-col gap-2 border-t border-supply-ice/35 pt-5"
    >
      <Label className="text-supply-ice">Or join a room somebody opened</Label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={code}
          onChange={(e) =>
            /* Filtered rather than merely validated on submit: a character
               that can never be part of a code should not be able to appear
               in the box at all, which turns "that is not a code" from an
               error into something that cannot be typed. */
            setCode(
              e.target.value
                .toUpperCase()
                .split("")
                .filter((ch) => ALPHABET.includes(ch))
                .join("")
                .slice(0, CODE_LENGTH)
            )
          }
          placeholder={"–".repeat(CODE_LENGTH)}
          aria-label="Room code"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="leaf w-[7.5rem] rounded-[3px] border border-supply-ice/55 bg-page text-center font-mono text-[1.375rem] uppercase tracking-[0.3em] text-ink caret-supply-ice placeholder:tracking-[0.3em] placeholder:text-ink-faint"
          style={{ padding: "0.625rem 0.5rem 0.625rem 0.8rem" }}
        />
        {/* The code drops into the slot. Nothing else on the screen goes
            down, which is what makes it read as this button's own move. */}
        {/* The accent is overridden on the element rather than by a second
            button component: `bg-accent` resolves `var(--accent)` at the
            element, so one local value recolours the fill, the hover and the
            glow together and nothing else on the page moves. */}
        <PrimaryButton
          type="submit"
          disabled={!good}
          style={{
            ["--accent" as string]: "var(--supply-ice)",
            ["--accent-hover" as string]: "#a5dde0",
            ["--on-accent" as string]: "#14201f",
          }}
        >
          Join{" "}
          <span aria-hidden className="slotted">
            ↓
          </span>
        </PrimaryButton>
      </div>
    </form>
  );
}

/** Everything that has a good default.

    Closed unless somebody wants it, and it announces what is inside rather
    than saying "options", because the two people who need it are somebody
    preparing for a named format and somebody who wants a harder opponent, and
    both should be able to tell from the summary line that this is their door.

    It stays open once opened, which is the browser's own behaviour for a
    details element and the right one here: anybody who set a format is going
    to want to see it still set on the next round. */
function Options({
  open,
  tab,
  onTab,
  format,
  onFormat,
  tierId,
  onTier,
  live,
}: {
  open: boolean;
  tab: Tab;
  onTab: (t: Tab) => void;
  format: Format;
  onFormat: (f: Format) => void;
  tierId: TierId;
  onTier: (t: TierId) => void;
  live: boolean;
}) {
  /* Frozen at mount, so this decides whether the fold STARTS open and never
     argues with somebody who then closes it. React only touches a DOM
     property when the value it renders changes, and this one never does. */
  const [startOpen] = useState(open);

  return (
    <details open={startOpen} className="group flex flex-col gap-4 border-t border-line pt-4">
      <summary
        style={{ fontVariationSettings: '"wdth" 88' }}
        className="inline-flex cursor-pointer list-none items-center gap-1.5 font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-ink-faint transition-colors hover:text-ink-soft"
      >
        <span aria-hidden className="inline-block transition-transform group-open:rotate-90">
          ›
        </span>
        {live ? "Tournament formats" : "Tournament formats and opponent strength"}
      </summary>

      {/* Three questions, three rows of buttons, no prose at all.

          Every one of these carried a line explaining it: what the two tabs
          judge differently, that the ballot follows the chosen format and no
          other, and what the selected opponent does to you. All three were
          accurate and all three were text on a screen somebody opened to press
          a button. The labels carry it, and what is left of the explanation is
          on the buttons themselves as a title. */}
      <div className="mt-4 flex flex-col gap-5">
        <Choice
          label="Judged as"
          options={[
            {
              id: "casual",
              name: "Open debate",
              title: "No format rules. Judged on whether the argument holds up.",
            },
            {
              id: "competitive",
              name: "Tournament prep",
              title:
                "Judged by the format's conventions, at a tournament bar. A dropped argument is conceded.",
            },
          ]}
          value={tab}
          onPick={(v) => onTab(v as Tab)}
        />

        {tab === "competitive" && (
          <Choice
            label="Format"
            options={FORMATS.map((f) => ({
              id: f,
              name: f,
              title: "The ballot is written by these conventions and no others.",
            }))}
            value={format}
            onPick={(v) => onFormat(v as Format)}
          />
        )}

        {/* Novice is the default. See DEFAULTS above for why it stopped being
            Varsity.

            Gone entirely in a live room rather than disabled. There is no
            opponent to set a strength for, and a greyed-out row of tiers
            would invite somebody to work out which one the person joining
            their room counts as. */}
        {!live && (
          <Choice
            label="Opponent"
            options={TIERS.map((t) => ({ id: t.id, name: t.name, title: t.brief }))}
            value={tierId}
            onPick={(v) => onTier(v as TierId)}
          />
        )}
      </div>
    </details>
  );
}

/** A question with two to four answers, as a row of buttons.

    Every choice inside the fold is one of these, including the opponent, which
    used to be its own stack of cards with a paragraph in each. One shape for
    one kind of question is most of what took the clutter off this screen; the
    explanation each one used to print is the button's `title` now, which is
    where an explanation belongs when the label already says enough.

    The pressed one sits down into the desk, the same way the opponent toggle
    above the note does, so "chosen" is one gesture across the whole screen
    rather than a fill up here and a movement down there. */
function Choice({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: { id: string; name: string; title?: string }[];
  value: string;
  onPick: (id: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => onPick(o.id)}
            aria-pressed={value === o.id}
            title={o.title}
            className={`btn inline-flex min-h-[2.5rem] items-center rounded-[3px] border-2 px-3.5 py-1.5 font-sans text-[0.875rem] font-medium transition-colors ${
              value === o.id
                ? "translate-y-[2px] border-sheet-ink bg-accent-wash text-ink shadow-[inset_0_2px_0_rgb(20_26_38/0.18)]"
                : "border-line-strong text-ink-soft shadow-[0_2px_0_var(--line-strong)] hover:border-accent hover:text-ink"
            }`}
          >
            {o.name}
          </button>
        ))}
      </div>
    </div>
  );
}
