import { useEffect, useRef, useState } from "react";

/** ms offset -> lit state. The last entry is where it rests. */
type Pattern = ReadonlyArray<readonly [number, boolean]>;

/** Strike of a tired filament: catches, drops out twice, then holds. */
export const FLICKER_ON: Pattern = [
  [0, true],
  [55, false],
  [95, true],
  [130, false],
  [205, true],
];

/** Dies, gasps once, gone. */
export const FLICKER_OFF: Pattern = [
  [0, false],
  [45, true],
  [85, false],
];

/**
 * Follows `lit` through a flicker pattern instead of jumping to it. Returns the
 * instantaneous state, which is a hard cut every time — a crossfade reads as a
 * dissolve, not as a switch being thrown.
 */
export function useFlicker(lit: boolean, enabled = true) {
  const [state, setState] = useState(lit);
  const first = useRef(true);

  useEffect(() => {
    if (!enabled) {
      setState(lit);
      return;
    }
    // Don't flicker whatever happens to be centred on first paint.
    if (first.current) {
      first.current = false;
      setState(lit);
      return;
    }

    const pattern = lit ? FLICKER_ON : FLICKER_OFF;
    const timers = pattern.map(([at, value]) =>
      setTimeout(() => setState(value), at),
    );
    return () => timers.forEach(clearTimeout);
  }, [lit, enabled]);

  return state;
}
