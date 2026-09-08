import Link from "next/link";
import { AudioControls } from "./audio-controls";
import { PixelSprite } from "./paper";
import { openCount } from "./feed/limits";
import { BUILD } from "@/lib/build";

export default function Landing() {
  return (
    <div className="dialog-desktop">
      <main className="dialog-board">
        <section className="pixel-dialog hello-dialog">
          <div className="dialog-title">
            <span>LEARNOVA.EXE</span>
            <span aria-hidden>X</span>
          </div>
          <div className="hello-body">
            <PixelSprite name="logo" scale={3} title="Learnova" />
            <div>
              <h1>learnova</h1>
              <p>you guess at it til the help runs out</p>
            </div>
          </div>
        </section>

        <section className="pixel-dialog blue-dialog note-dialog">
          <div className="dialog-title">
            <span>NOTE.TXT</span>
            <span aria-hidden>X</span>
          </div>
          <div>
            <p>wrong answers are supposed to happen!!!! :)</p>
            <span aria-hidden className="fake-ok">OK</span>
          </div>
        </section>

        <nav aria-label="Choose a mode" className="mode-dialogs">
          <Link href="/round" className="pixel-dialog mode-dialog">
            <div className="dialog-title">
              <span>ROUND.EXE</span>
              <span aria-hidden>X</span>
            </div>
            <div className="mode-dialog-body">
              <PixelSprite name="pencil" scale={4} />
              <p>
                five passes
                <br />
                less help each time
              </p>
              <span className="dialog-button">OPEN</span>
            </div>
          </Link>

          <Link href="/debate" className="pixel-dialog mode-dialog blue-dialog">
            <div className="dialog-title">
              <span>DEBATE.EXE</span>
              <span aria-hidden>X</span>
            </div>
            <div className="mode-dialog-body">
              <PixelSprite name="clip" scale={4} />
              <p>
                pick a side
                <br />
                keep it for four speeches
              </p>
              <span className="dialog-button">OPEN</span>
            </div>
          </Link>
        </nav>

        <section className="pixel-dialog feed-dialog">
          <div className="dialog-title">
            <span>BUILD.LOG</span>
          </div>
          <div className="feed-dialog-body">
            <PixelSprite name="crt" scale={2} />
            <span>{BUILD.sha}</span>
            <span>{openCount} OPEN</span>
          </div>
        </section>

        <section className="pixel-dialog sound-dialog">
          <div className="dialog-title">
            <span>SOUND</span>
            <span aria-hidden>X</span>
          </div>
          <AudioControls />
        </section>

        <details className="pixel-dialog credit-dialog">
          <summary>AUDIO.TXT</summary>
          <p>
            &ldquo;8bit Dungeon Level&rdquo; Kevin MacLeod (incompetech.com), CC BY
            4.0
          </p>
        </details>
      </main>
    </div>
  );
}
