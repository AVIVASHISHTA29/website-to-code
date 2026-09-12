import { memo } from "react";
import type { CarouselItem } from "./items";
import { placeAtSlot, slotOpacity } from "./geometry";
import { useFlicker } from "./useFlicker";

type Props = {
  item: CarouselItem;
  /** Signed distance from the upright centre slot. */
  slot: number;
  /** True while this item is the one nearest the centre. */
  centered: boolean;
};

/**
 * One object on the track. Position and rotation both come from `slot`, so they
 * are always the same motion — the object turns as it travels, and is only
 * upright at the moment it reaches the centre.
 */
function TrackItemImpl({ item, slot, centered }: Props) {
  const { x, y, rotation } = placeAtSlot(slot);
  const opacity = slotOpacity(slot);
  const togglable = Boolean(item.litSrc);
  const lit = useFlicker(centered && togglable, togglable);

  const width = item.ratio >= 1 ? item.size : item.size * item.ratio;
  const height = item.ratio >= 1 ? item.size / item.ratio : item.size;

  return (
    <div
      className="dc-item"
      style={{
        width,
        height,
        opacity,
        // Items further down the track sit in front, so the diagonal reads as
        // one overlapping pile rather than a flat row.
        zIndex: 1000 + Math.round(slot * 10),
        transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) rotate(${rotation}deg)`,
      }}
    >
      {item.glow && (
        <div
          className="dc-glow"
          style={{
            opacity: lit ? 1 : 0,
            background: `radial-gradient(circle at 50% 45%, rgba(${item.glow}, 0.55) 0%, rgba(${item.glow}, 0.22) 34%, rgba(${item.glow}, 0) 70%)`,
          }}
        />
      )}
      <img className="dc-art" src={item.src} alt={item.label} draggable={false} />
      {item.litSrc && (
        <img
          className="dc-art dc-art--lit"
          src={item.litSrc}
          alt=""
          aria-hidden
          draggable={false}
          style={{ opacity: lit ? 1 : 0 }}
        />
      )}
    </div>
  );
}

export const TrackItem = memo(TrackItemImpl);
