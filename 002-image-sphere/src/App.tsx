import { useEffect, useState } from "react";
import { ImageGallery } from "./gallery/ImageGallery";
import { MODES, hasAxis, type Axis, type Mode } from "./gallery/layouts";
import "./App.css";

/**
 * 36 images, deliberately: at 12 per turn that is exactly 3 whole turns, so the
 * helix closes on itself at the measured 30 degrees per image with nothing
 * bent to make it fit.
 */
const IMAGES = Array.from(
  { length: 36 },
  (_, i) => `/images/${String(i + 1).padStart(2, "0")}.webp`,
);

type Theme = "light" | "dark";

const HINT: Record<Mode, string> = {
  sphere: "Drag to orbit · scroll to roll",
  spiral: "Drag to orbit · scroll to travel",
};

export default function App() {
  const [mode, setMode] = useState<Mode>("sphere");
  const [axis, setAxis] = useState<Axis>("vertical");
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <main className="page">
      <ImageGallery
        images={IMAGES}
        mode={mode}
        axis={axis}
        className="page__gallery"
      />

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

        {hasAxis(mode) && (
          <div className="modes modes--axis" role="group" aria-label="Axis">
            {(["vertical", "horizontal"] as const).map((a) => (
              <button
                key={a}
                aria-pressed={a === axis}
                className={`modes__btn${a === axis ? " is-active" : ""}`}
                onClick={() => setAxis(a)}
              >
                {a}
              </button>
            ))}
          </div>
        )}

        <p className="count">{IMAGES.length} images</p>
      </footer>
    </main>
  );
}
