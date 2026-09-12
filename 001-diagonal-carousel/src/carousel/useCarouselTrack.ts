import { useCallback, useEffect, useRef, useState } from "react";
import { AXIS, SLOT_LENGTH } from "./geometry";

export type TrackOptions = {
  /** Number of items on the track. */
  count: number;
  /** ms between automatic position switches. */
  interval?: number;
  /** Start in auto mode. */
  autoPlay?: boolean;
  /**
   * Fraction of the remaining distance covered per 60fps frame. Higher settles
   * harder; this is what makes a switch read as a switch rather than a drift.
   */
  ease?: number;
  /** Slots travelled per 100px of wheel/drag along the track. */
  sensitivity?: number;
  /** Swallow the wheel event so the page does not scroll with the track. */
  captureWheel?: boolean;
};

export type Track = {
  /** Eased position, in slots. Fractional between switches. */
  progress: number;
  /** Index of the item nearest the upright centre slot. */
  centerIndex: number;
  /** True while the pointer is driving the track. */
  scrubbing: boolean;
  auto: boolean;
  setAuto: (on: boolean) => void;
  advance: (slots: number) => void;
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Drives one continuous `progress` value, in slots, shared by auto-advance and
 * by scrolling. Both only ever move the *target*; a single spring chases it, so
 * scrolling fast and waiting for the timer produce the same motion and the same
 * per-slot effects — just at different speeds.
 */
export function useCarouselTrack({
  count,
  interval = 2200,
  autoPlay = true,
  ease = 0.14,
  sensitivity = 2.4,
  captureWheel = true,
}: TrackOptions): [Track, React.RefObject<HTMLDivElement | null>] {
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  const target = useRef(0);
  const current = useRef(0);
  const lastStep = useRef(0);
  const scrubEnd = useRef(0);
  const settled = useRef(true);

  const [auto, setAuto] = useState(autoPlay && !prefersReducedMotion());
  const [progress, setProgress] = useState(0);
  const [centerIndex, setCenterIndex] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);

  const autoRef = useRef(auto);
  autoRef.current = auto;

  const advance = useCallback((slots: number) => {
    target.current += slots;
  }, []);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    lastStep.current = last;

    const frame = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;

      const scrubbingNow = now - scrubEnd.current < 140;

      // Auto-advance: one whole slot per interval, never mid-scrub.
      if (autoRef.current && !scrubbingNow) {
        if (now - lastStep.current >= interval && settled.current) {
          lastStep.current = now;
          target.current += 1;
        }
      } else {
        lastStep.current = now;
      }

      // Frame-rate independent exponential ease toward the target.
      const k = 1 - Math.pow(1 - ease, dt / (1000 / 60));
      const delta = target.current - current.current;
      current.current += delta * k;
      settled.current = Math.abs(delta) < 0.02;

      setProgress(current.current);

      const nearest = Math.round(current.current);
      const idx = ((nearest % count) + count) % count;
      setCenterIndex((prev) => (prev === idx ? prev : idx));
      setScrubbing((prev) => (prev === scrubbingNow ? prev : scrubbingNow));

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [count, interval, ease]);

  // Wheel / trackpad, projected onto the track axis.
  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;

    let snap: ReturnType<typeof setTimeout> | undefined;

    const onWheel = (e: WheelEvent) => {
      const along = e.deltaY * AXIS.y + e.deltaX * AXIS.x;
      if (captureWheel) e.preventDefault();
      target.current += (along / SLOT_LENGTH) * sensitivity;
      scrubEnd.current = performance.now();
      clearTimeout(snap);
      // Rest on a whole slot so the centre item ends up upright.
      snap = setTimeout(() => {
        target.current = Math.round(target.current);
      }, 150);
    };

    el.addEventListener("wheel", onWheel, { passive: !captureWheel });
    return () => {
      el.removeEventListener("wheel", onWheel);
      clearTimeout(snap);
    };
  }, [sensitivity, captureWheel]);

  // Touch drag, also projected onto the axis.
  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;

    let lastX = 0;
    let lastY = 0;
    let active = false;

    const start = (e: TouchEvent) => {
      active = true;
      lastX = e.touches[0].clientX;
      lastY = e.touches[0].clientY;
      scrubEnd.current = performance.now();
    };
    const move = (e: TouchEvent) => {
      if (!active) return;
      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      // Dragging up-left pulls the track forward, so the sign is inverted.
      const along = -((x - lastX) * AXIS.x + (y - lastY) * AXIS.y);
      lastX = x;
      lastY = y;
      target.current += (along / SLOT_LENGTH) * sensitivity * 1.8;
      scrubEnd.current = performance.now();
      if (captureWheel) e.preventDefault();
    };
    const end = () => {
      active = false;
      target.current = Math.round(target.current);
    };

    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: !captureWheel });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
    };
  }, [sensitivity, captureWheel]);

  return [
    { progress, centerIndex, scrubbing, auto, setAuto, advance },
    surfaceRef,
  ];
}
