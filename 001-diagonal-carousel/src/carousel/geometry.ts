/**
 * Track geometry.
 *
 * Measured off studioloop.com.br's hero, which is the reference for this
 * component: every object sits on one straight diagonal, each slot is a fixed
 * translation away from the last, and each slot adds a fixed rotation. Both
 * numbers below are theirs.
 */

/** Design-space size the track is authored in. Scaled to cover the viewport. */
export const STAGE = { w: 1920, h: 1080 } as const;

/** Translation from one slot to the next, in design px. Down-and-right. */
export const SLOT_STEP = { x: 285, y: 195 } as const;

/** Rotation added per slot, in degrees. Slot 0 is upright. */
export const SLOT_ROTATION = 15;

/** Distance between slot centres. */
export const SLOT_LENGTH = Math.hypot(SLOT_STEP.x, SLOT_STEP.y);

/** Unit vector along the track, pointing down-right (increasing slot). */
export const AXIS = {
  x: SLOT_STEP.x / SLOT_LENGTH,
  y: SLOT_STEP.y / SLOT_LENGTH,
} as const;

/** Track tilt in degrees below the horizontal — ~34.4deg. */
export const AXIS_ANGLE = (Math.atan2(SLOT_STEP.y, SLOT_STEP.x) * 180) / Math.PI;

/**
 * How far along the track an item can travel before it has fully left a
 * stage-sized viewport. Half the stage projected onto the axis, plus half an
 * item. Items are recycled past this, so it is also the minimum half-length
 * the track needs for the recycling to stay off screen.
 */
export const VISIBLE_SLOTS =
  ((STAGE.w / 2) * Math.abs(AXIS.x) +
    (STAGE.h / 2) * Math.abs(AXIS.y) +
    360) /
  SLOT_LENGTH;

/**
 * Signed slot offset of item `index` when the track has advanced to `progress`,
 * wrapped into [-count/2, count/2) so each item takes the shortest way round
 * and is recycled off-screen rather than sliding back through the frame.
 */
export function slotOffset(index: number, progress: number, count: number) {
  const raw = index - progress;
  return ((((raw + count / 2) % count) + count) % count) - count / 2;
}

/** Placement of an item sitting `slot` steps along the track from centre. */
export function placeAtSlot(slot: number) {
  return {
    x: slot * SLOT_STEP.x,
    y: slot * SLOT_STEP.y,
    rotation: slot * SLOT_ROTATION,
  };
}

/**
 * Fades an item out over the last stretch before it is recycled, so the jump
 * is invisible even on aspect ratios the stage does not perfectly cover.
 */
export function slotOpacity(slot: number) {
  const d = Math.abs(slot);
  const fadeStart = VISIBLE_SLOTS - 0.9;
  if (d <= fadeStart) return 1;
  return Math.max(0, 1 - (d - fadeStart) / 0.9);
}

/** Scale that makes the design-space stage cover a viewport. */
export function coverScale(width: number, height: number) {
  return Math.max(width / STAGE.w, height / STAGE.h);
}
