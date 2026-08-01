import type { Ability, EnemyDef, MaterialDef } from "../types";

// ============================================================
// PROTOTYPE CONTENT
// Three materials (offensive / positional / status), two
// abilities (a straight strike and a chain-capable phrase),
// and one enemy: the Cinder Battery.
// ============================================================

export const MATERIALS: Record<string, MaterialDef> = {
  emberdust: {
    id: "emberdust",
    name: "Emberdust",
    blurb: "Volatile ash. Adds bite to any strike.",
    color: "var(--attack)",
    glyph: "▲",
    effect: { keyword: "attack", value: 2 },
    maxCharges: 4,
  },
  tidebrass: {
    id: "tidebrass",
    name: "Tidebrass",
    blurb: "Cold filings that drink incoming force.",
    color: "var(--defend)",
    glyph: "◆",
    effect: { keyword: "defend", value: 2 },
    maxCharges: 3,
  },
  nightcap: {
    id: "nightcap",
    name: "Nightcap Spore",
    blurb: "A slow rot that settles into the wound.",
    color: "var(--poison)",
    glyph: "✦",
    effect: { keyword: "poison", value: 2 },
    maxCharges: 3,
  },
};

export const ALL_MATERIALS = Object.values(MATERIALS);

// ---- Abilities -------------------------------------------------

export const ABILITIES: Ability[] = [
  {
    id: "basic-strike",
    name: "Basic Strike",
    blurb: "One committed blow. A fixed strike, one open slot.",
    beats: 3,
    nodes: [
      {
        id: "bs-fixed",
        beat: 1,
        x: 26,
        y: 50,
        execKey: "F",
        kind: "fixed",
        fixedEffect: { keyword: "attack", value: 2 },
      },
      { id: "bs-c1", beat: 3, x: 74, y: 50, execKey: "J", kind: "config", slot: 1 },
    ],
    edges: [["bs-fixed", "bs-c1"]],
  },
  {
    id: "prism-step",
    name: "Prism Step",
    blurb: "A dodging phrase. Sidestep on beat 3 answers ranged fire, and two open slots colour the strike.",
    beats: 4,
    nodes: [
      {
        id: "ps-atk",
        beat: 1,
        x: 20,
        y: 34,
        execKey: "F",
        kind: "fixed",
        fixedEffect: { keyword: "attack", value: 2 },
      },
      { id: "ps-c1", beat: 2, x: 44, y: 62, execKey: "D", kind: "config", slot: 1 },
      {
        id: "ps-side",
        beat: 3,
        x: 68, // resolution beat 3 — matches Cinder Battery
        y: 34,
        execKey: "K",
        kind: "fixed",
        fixedEffect: { keyword: "sidestep" },
      },
      { id: "ps-c2", beat: 4, x: 88, y: 62, execKey: "L", kind: "config", slot: 2 },
    ],
    edges: [
      ["ps-atk", "ps-c1"],
      ["ps-c1", "ps-side"],
      ["ps-side", "ps-c2"],
    ],
  },
];

// ---- Enemy -----------------------------------------------------

export const CINDER_BATTERY: EnemyDef = {
  id: "cinder-battery",
  name: "Cinder Battery",
  maxHp: 18,
  action: {
    id: "cb-fire",
    name: "Cinder Battery",
    beat: 3,
    instances: 3,
    perHit: [{ keyword: "damage", value: 2 }],
    onHit: [{ keyword: "move", value: -1, trigger: "onHit" }],
    telegraph: "Three vents flare. Something fires on the third beat.",
  },
};
