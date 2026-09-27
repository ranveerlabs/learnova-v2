import Link from "next/link";
import { AudioControls } from "./audio-controls";
import { PixelSprite } from "./paper";
import { BUILD } from "@/lib/build";

export default function Landing() {
  return (
    <main className="home">
      <header className="home-mark">
        <PixelSprite name="star" scale={8} title="Learnova" />
        <h1>learnova</h1>
      </header>
      <p className="home-keyboard">
        <strong>keyboard only</strong>
        <span>left right arrows for nav and enter to well enter</span>
      </p>
      <nav aria-label="Choose a mode" className="home-modes">
        <div className="home-mode home-mode-study">
          <Link href="/round">study</Link>
          <p>five rounds</p>
        </div>
        <div className="home-mode home-mode-debate">
          <Link href="/debate">debate</Link>
          <p>model or friend</p>
        </div>
      </nav>
      <footer className="home-footer">
        <div className="home-links">
          <span>commit {BUILD.sha}</span>
          <AudioControls />
        </div>
        <p className="home-credit">
          &ldquo;8bit Dungeon Level&rdquo; by Kevin MacLeod, CC BY 4.0
        </p>
      </footer>
    </main>
  );
}
