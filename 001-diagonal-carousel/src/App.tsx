import { useCallback, useState } from "react";
import { DiagonalCarousel } from "./carousel/DiagonalCarousel";
import { ITEMS, type CarouselItem } from "./carousel/items";
import "./App.css";

export default function App() {
  const [label, setLabel] = useState(ITEMS[0].label);
  const [auto, setAuto] = useState(true);
  const [interval, setIntervalMs] = useState(2200);

  const onCenterChange = useCallback((item: CarouselItem) => {
    setLabel(item.label);
  }, []);

  return (
    <main className="page">
      <DiagonalCarousel
        autoPlay={auto}
        interval={interval}
        onCenterChange={onCenterChange}
        className="page__carousel"
      />

      <header className="chrome chrome--top">
        <span className="wordmark">loop</span>
        <nav className="nav">
          <a href="#work">Work</a>
          <a href="#about">About</a>
          <a href="#contact">Start a Project</a>
        </nav>
      </header>

      <div className="chrome chrome--caption">
        <span className="caption__rule" />
        <span className="caption__label" key={label}>
          {label}
        </span>
      </div>

      <footer className="chrome chrome--bottom">
        <p className="hint">Scroll to run it faster</p>
        <div className="controls">
          <button
            type="button"
            className="control"
            aria-pressed={auto}
            onClick={() => setAuto((v) => !v)}
          >
            {auto ? "Pause" : "Play"}
          </button>
          <label className="control control--range">
            <span>{(interval / 1000).toFixed(1)}s</span>
            <input
              type="range"
              min={900}
              max={4000}
              step={100}
              value={interval}
              onChange={(e) => setIntervalMs(Number(e.target.value))}
              aria-label="Seconds between switches"
            />
          </label>
        </div>
      </footer>
    </main>
  );
}
