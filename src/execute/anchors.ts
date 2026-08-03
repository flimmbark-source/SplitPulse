// Where each WASD key's strike lands in the first-person POV (fractions of the
// player panel). The key IS a direction, so W strikes high, A left, S low,
// D right — the contracting ring + keycap sit here and the axe swings to meet
// it. Same anchors drive the weapon pose and the 2D prompt overlay.
export interface Anchor {
  x: number; // 0..1 across the panel
  y: number; // 0..1 down the panel
}

export const KEY_ANCHOR: Record<string, Anchor> = {
  W: { x: 0.5, y: 0.24 },
  A: { x: 0.24, y: 0.52 },
  S: { x: 0.5, y: 0.8 },
  D: { x: 0.76, y: 0.52 },
};

export const CENTER: Anchor = { x: 0.5, y: 0.52 };

export const anchorFor = (key: string): Anchor => KEY_ANCHOR[key] ?? CENTER;

// weapon-swing timing, in ms relative to a node's target beat
export const STRIKE_MS = 170; // beat -> follow-through
export const easeOut = (p: number) => 1 - (1 - p) * (1 - p);
export const easeIn = (p: number) => p * p;
export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
