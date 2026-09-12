import { useEffect, useState } from "react";
import { ITEMS, type CarouselItem } from "./items";
import { STAGE, coverScale, slotOffset } from "./geometry";
import { useCarouselTrack, type TrackOptions } from "./useCarouselTrack";
import { TrackItem } from "./TrackItem";
import "./carousel.css";

export type DiagonalCarouselProps = Omit<TrackOptions, "count"> & {
  items?: CarouselItem[];
  /** Called whenever a different object reaches the centre. */
  onCenterChange?: (item: CarouselItem, index: number) => void;
  className?: string;
};

function useCoverScale() {
  const [scale, setScale] = useState(() =>
    typeof window === "undefined"
      ? 1
      : coverScale(window.innerWidth, window.innerHeight),
  );
  useEffect(() => {
    const update = () =>
      setScale(coverScale(window.innerWidth, window.innerHeight));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return scale;
}

/**
 * A carousel whose slots run along one diagonal from the bottom right to the
 * top left. Every switch moves each object one slot up that diagonal and
 * rotates it by the same step, so an object is only upright while it is at the
 * centre. Objects with a lit state flicker on as they arrive there.
 *
 * Auto-advance and scrolling feed the same position value, so scrolling just
 * runs the same carousel faster.
 */
export function DiagonalCarousel({
  items = ITEMS,
  onCenterChange,
  className,
  ...options
}: DiagonalCarouselProps) {
  const [track, surfaceRef] = useCarouselTrack({
    count: items.length,
    ...options,
  });
  const scale = useCoverScale();
  const { progress, centerIndex } = track;

  useEffect(() => {
    onCenterChange?.(items[centerIndex], centerIndex);
  }, [centerIndex, items, onCenterChange]);

  return (
    <div
      ref={surfaceRef}
      className={["dc-surface", className].filter(Boolean).join(" ")}
      role="region"
      aria-roledescription="carousel"
      aria-label="Objects"
    >
      <div
        className="dc-stage"
        style={{
          width: STAGE.w,
          height: STAGE.h,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        {items.map((item, i) => {
          const slot = slotOffset(i, progress, items.length);
          return (
            <TrackItem
              key={item.id}
              item={item}
              slot={slot}
              centered={i === centerIndex}
            />
          );
        })}
      </div>

      <p className="dc-live" aria-live="polite">
        {items[centerIndex]?.label}
      </p>
    </div>
  );
}
