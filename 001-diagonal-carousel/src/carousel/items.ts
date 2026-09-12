export type CarouselItem = {
  id: string;
  label: string;
  /** Always-visible artwork. For a toggling item this is its OFF state. */
  src: string;
  /**
   * Lit artwork, cut from the same frame as `src` so the two can hard-cut
   * between each other without the object appearing to move.
   */
  litSrc?: string;
  /** Colour of the light this object throws when lit. */
  glow?: string;
  /** Longest edge, in design px. Sets how big the object reads on the track. */
  size: number;
  /** Intrinsic aspect ratio (w / h) of the artwork. */
  ratio: number;
};

const r = (w: number, h: number) => w / h;

/**
 * Track order. Items are read in sequence along the diagonal, so this is also
 * the order they arrive in — keep the three toggling objects spread out so a
 * flicker lands roughly every third switch.
 */
export const ITEMS: CarouselItem[] = [
  {
    id: "lamp",
    label: "Mushroom lamp",
    src: "/objects/lamp-off.webp",
    litSrc: "/objects/lamp-on.webp",
    glow: "255, 186, 92",
    size: 545,
    ratio: r(726, 900),
  },
  { id: "armchair", label: "Velvet armchair", src: "/objects/armchair.webp", size: 615, ratio: r(900, 720) },
  { id: "books", label: "Stacked books", src: "/objects/books.webp", size: 530, ratio: r(900, 689) },
  {
    id: "phone",
    label: "Phone",
    src: "/objects/phone-off.webp",
    litSrc: "/objects/phone-on.webp",
    glow: "236, 130, 255",
    size: 615,
    ratio: r(413, 900),
  },
  { id: "side-table", label: "Tulip table", src: "/objects/side-table.webp", size: 535, ratio: r(773, 900) },
  { id: "keys", label: "Keyring", src: "/objects/keys.webp", size: 565, ratio: r(593, 900) },
  {
    id: "tv",
    label: "Portable CRT",
    src: "/objects/tv-off.webp",
    litSrc: "/objects/tv-on.webp",
    glow: "104, 226, 255",
    size: 545,
    ratio: r(862, 900),
  },
  { id: "sneaker", label: "Sneaker", src: "/objects/sneaker.webp", size: 565, ratio: r(900, 507) },
  { id: "plant", label: "Monstera", src: "/objects/plant.webp", size: 590, ratio: r(860, 900) },
  { id: "mug", label: "Ceramic mug", src: "/objects/mug.webp", size: 495, ratio: r(900, 626) },
  { id: "camera", label: "Rangefinder", src: "/objects/camera.webp", size: 510, ratio: r(900, 705) },
  { id: "boombox", label: "Boombox", src: "/objects/boombox.webp", size: 565, ratio: r(900, 826) },
];
