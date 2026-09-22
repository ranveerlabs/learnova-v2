import Link from "next/link";
import { AudioControls } from "./audio-controls";
import { PixelSprite } from "./paper";
import { BUILD } from "@/lib/build";

export default function Landing() {
  return (
    <main className="home">
      <header className="home-mark">
        <PixelSprite name="logo" scale={4} title="Learnova" />
        <div>
          <h1>learnova</h1>
          <p>see what you can explain without the hints</p>
        </div>
      </header>
      <nav aria-label="Choose a mode" className="home-modes">
        <div className="home-mode home-mode-study">
          <Link href="/round">study</Link>
          <p>a topic or your notes. five rounds, less help each time.</p>
        </div>
        <div className="home-mode home-mode-debate">
          <Link href="/debate">debate</Link>
          <p>pick a side. argue with a model or a friend.</p>
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
