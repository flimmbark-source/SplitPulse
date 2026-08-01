import { CatmullRomCurve3, Vector3 } from "three";

// ============================================================
// ARENA — authored traversal (GDD §"corrected combat model").
// The player never free-steers. They are carried along named
// spline PATHs through a real 3D space; hits re-route them onto
// a knockback path, recovery loops them back, and reaching an
// ATTACK_POSITION opens the attack opportunity.
//
// Named markers → a segment graph. No navmesh, no AI: just curves.
// ============================================================

// ---- named markers -------------------------------------------------
export const ENEMY_ORIGIN = new Vector3(0, 1.4, 0);
export const CAMERA_LOOK_TARGET = new Vector3(0, 1.5, 0);
export const ATTACK_POSITION_CLOSE = new Vector3(0, 1.6, 4.2);

// arena landmarks (broken pillars) — geometry + sightline interest
export const LANDMARKS: { pos: [number, number, number]; h: number }[] = [
  { pos: [7.5, 0, -7.5], h: 5.5 },
  { pos: [-8, 0, -6], h: 4 },
  { pos: [-7, 0, 7], h: 6.5 },
  { pos: [8.5, 0, 6], h: 3.5 },
  { pos: [0, 0, -12], h: 7 },
];

const EYE = 1.6;
const v = (x: number, z: number, y = EYE) => new Vector3(x, y, z);

// ---- attack patterns (enemy fire during a segment) -----------------
export interface Pattern {
  interval: number; // seconds between shots
  lead: number; // telegraph → impact time
}
export const PATTERNS: Record<string, Pattern> = {
  volley: { interval: 1.6, lead: 1.4 },
  volley_fast: { interval: 1.25, lead: 1.2 },
};

// ---- segment graph -------------------------------------------------
export interface Segment {
  id: string;
  label: string; // the PATH_* marker name, surfaced for debug/flavour
  curve: CatmullRomCurve3;
  duration: number; // seconds to traverse
  pattern: keyof typeof PATTERNS | null;
  next: string; // segment entered on completion
  onHit: string | null; // reroute when struck (knockback)
  arrive?: "attack"; // completing this segment opens the attack window
}

const curve = (pts: Vector3[]) => new CatmullRomCurve3(pts, false, "catmullrom", 0.5);

export const SEGMENTS: Record<string, Segment> = {
  approach_a: {
    id: "approach_a",
    label: "PATH_outer_east",
    curve: curve([v(13, -4), v(12, 2), v(8, 7), v(3, 9)]),
    duration: 5.2,
    pattern: "volley",
    next: "approach_b",
    onHit: "knockback",
  },
  approach_b: {
    id: "approach_b",
    label: "PATH_inner_approach",
    curve: curve([v(3, 9), v(1.6, 7.6), v(0.6, 6)]),
    duration: 2.6,
    pattern: "volley",
    next: "rush",
    onHit: "knockback",
  },
  rush: {
    id: "rush",
    label: "ATTACK_POSITION_close",
    curve: curve([v(0.6, 6), ATTACK_POSITION_CLOSE.clone()]),
    duration: 1.7,
    pattern: "volley_fast",
    next: "rush",
    onHit: "knockback",
    arrive: "attack",
  },
  knockback: {
    id: "knockback",
    label: "PATH_knockback_west",
    curve: curve([v(0.6, 6), v(-6, 6), v(-12, 1)]),
    duration: 1.15,
    pattern: null, // brief grace while flung back
    next: "recovery",
    onHit: null,
  },
  recovery: {
    id: "recovery",
    label: "PATH_recovery",
    curve: curve([v(-12, 1), v(-8, -9), v(6, -10), v(13, -4)]),
    duration: 3.6,
    pattern: null,
    next: "approach_a",
    onHit: null,
  },
};

export const START_SEGMENT = "approach_a";

// coarse progress toward the attack window, for the HUD meter
export const PROGRESS: Record<string, [number, number]> = {
  approach_a: [0, 55],
  approach_b: [55, 82],
  rush: [82, 100],
  knockback: [40, 20], // visibly lose ground
  recovery: [20, 0],
};
