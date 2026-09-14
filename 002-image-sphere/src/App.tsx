import { useEffect, useState } from "react";
import { ImageGallery } from "./gallery/ImageGallery";
import { MODES, type Mode } from "./gallery/layouts";
import "./App.css";

const IMAGES = Array.from(
  { length: 30 },
  (_, i) => `/images/${String(i + 1).padStart(2, "0")}.webp`,
);

type Theme = "light" | "dark";

const HINT: Record<Mode, string> = {
  sphere: "Drag to orbit · scroll to roll",
  spiral: "Drag to orbit · scroll to travel",
  rings: "Drag to orbit · scroll to spin",
};

export default function App() {
  const [mode, setMode] = useState<Mode>("sphere");
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <main className="page">
      <ImageGallery images={IMAGES} mode={mode} className="page__gallery" />

      <header className="chrome chrome--top">
        <span className="mark">Gallery / 3D</span>

        <div className="modes" role="tablist" aria-label="Arrangement">
          {MODES.map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={m === mode}
              className={`modes__btn${m === mode ? " is-active" : ""}`}
              onClick={() => setMode(m)}
            >
              {m}
            </button>
          ))}
        </div>

        <button
          className="theme"
          onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        >
          {theme === "light" ? "Dark" : "Light"}
        </button>
      </header>

      <footer className="chrome chrome--bottom">
        <p className="hint">{HINT[mode]}</p>
        <p className="count">{IMAGES.length} images</p>
      </footer>
    </main>
  );
}
