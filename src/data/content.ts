import type {
  Ability,
  AbilityNode,
  Effect,
  EnemyAction,
  EnemyDef,
  MaterialDef,
  NodeKind,
} from "../types";

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

// ---- Abilities as directional gestures -------------------------
// An ability is authored as a START node plus a run of steps, each
// carrying a WASD direction. Every node after the first is placed by
// STEPPING in its key's direction from the previous node, so the edge
// into it always arrives ALONG that key's axis — the diagram literally
// draws the input sequence, and the shape is the ability's theme.

type Cardinal = "W" | "A" | "S" | "D";
// SVG space: y grows downward, so W (up) is -y.
const DIRV: Record<Cardinal, [number, number]> = {
  W: [0, -1],
  A: [-1, 0],
  S: [0, 1],
  D: [1, 0],
};

interface Step {
  id: string;
  beat: number;
  key: Cardinal;
  kind: NodeKind;
  fixedEffect?: Effect;
  slot?: number;
}

function gesture(
  id: string,
  name: string,
  blurb: string,
  beats: number,
  steps: Step[]
): Ability {
  // walk the directions to lay out points on a unit grid
  const pts: [number, number][] = [[0, 0]];
  for (let i = 1; i < steps.length; i++) {
    const [dx, dy] = DIRV[steps[i].key];
    pts.push([pts[i - 1][0] + dx, pts[i - 1][1] + dy]);
  }
  // normalise into a target box within the 100×90 viewBox
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = maxX - minX;
  const h = maxY - minY;
  const TX = 18;
  const TW = 64;
  const TY = 22;
  const TH = 46;
  const scale = Math.min(w ? TW / w : Infinity, h ? TH / h : Infinity, 26);
  const offX = TX + (TW - w * scale) / 2 - minX * scale;
  const offY = TY + (TH - h * scale) / 2 - minY * scale;

  const nodes: AbilityNode[] = steps.map((s, i) => ({
    id: s.id,
    beat: s.beat,
    x: pts[i][0] * scale + offX,
    y: pts[i][1] * scale + offY,
    execKey: s.key,
    kind: s.kind,
    fixedEffect: s.fixedEffect,
    slot: s.slot,
  }));
  const edges: [string, string][] = [];
  for (let i = 1; i < steps.length; i++) edges.push([steps[i - 1].id, steps[i].id]);
  return { id, name, blurb, beats, nodes, edges };
}

export const ABILITIES: Ability[] = [
  gesture(
    "basic-strike",
    "Basic Strike",
    "One committed thrust — a fixed strike driven straight into an open slot.",
    3,
    [
      { id: "bs-fixed", beat: 1, key: "W", kind: "fixed", fixedEffect: { keyword: "attack", value: 2 } },
      { id: "bs-c1", beat: 3, key: "D", kind: "config", slot: 1 },
    ]
  ),
  gesture(
    "prism-step",
    "Prism Step",
    "A stepping phrase: drive right, duck down into the Sidestep on beat 3, then step out again. Two open slots colour the strike.",
    4,
    [
      { id: "ps-atk", beat: 1, key: "W", kind: "fixed", fixedEffect: { keyword: "attack", value: 2 } },
      { id: "ps-c1", beat: 2, key: "D", kind: "config", slot: 1 },
      { id: "ps-side", beat: 3, key: "S", kind: "fixed", fixedEffect: { keyword: "sidestep" } },
      { id: "ps-c2", beat: 4, key: "D", kind: "config", slot: 2 },
    ]
  ),
  gesture(
    "rising-guard",
    "Rising Guard",
    "Answer early: Sidestep on beat 1, then strike out. Counters a beat-1 action.",
    3,
    [
      { id: "rg-side", beat: 1, key: "W", kind: "fixed", fixedEffect: { keyword: "sidestep" } },
      { id: "rg-atk", beat: 2, key: "D", kind: "fixed", fixedEffect: { keyword: "attack", value: 2 } },
      { id: "rg-c1", beat: 3, key: "S", kind: "config", slot: 1 },
    ]
  ),
  gesture(
    "late-veil",
    "Late Veil",
    "Hold, colour the strike, and Sidestep late on beat 4. Counters a beat-4 action.",
    4,
    [
      { id: "lv-atk", beat: 1, key: "W", kind: "fixed", fixedEffect: { keyword: "attack", value: 2 } },
      { id: "lv-c1", beat: 2, key: "A", kind: "config", slot: 1 },
      { id: "lv-c2", beat: 3, key: "S", kind: "config", slot: 2 },
      { id: "lv-side", beat: 4, key: "D", kind: "fixed", fixedEffect: { keyword: "sidestep" } },
    ]
  ),
];

// ---- Enemy -----------------------------------------------------

// Each action differs in BOTH effect AND timing (resolution beat). You read
// the announced beat and pick the ability whose Sidestep lands on it — or, for
// a damage action, block it with Defend on any beat.
export const CINDER_ACTIONS: EnemyAction[] = [
  {
    // early, unblockable slam — only a beat-1 Sidestep avoids it
    id: "cb-shove",
    name: "Iron Shove",
    beat: 1,
    instances: 1,
    perHit: [{ keyword: "move", value: -3 }],
    onHit: [],
    telegraph: "The battery lurches — a heavy slam lands on the very first beat.",
  },
  {
    id: "cb-volley",
    name: "Cinder Volley",
    beat: 3,
    instances: 3,
    perHit: [{ keyword: "damage", value: 2 }],
    onHit: [{ keyword: "move", value: -1, trigger: "onHit" }],
    telegraph: "Three vents flare. Something fires on the third beat.",
  },
  {
    // late, wide barrage — Sidestep on beat 4, or soak it with Defend
    id: "cb-spray",
    name: "Ashen Spray",
    beat: 4,
    instances: 4,
    perHit: [{ keyword: "damage", value: 1 }],
    onHit: [],
    telegraph: "A wide cone of embers builds slowly, breaking on the fourth beat.",
  },
];

export const CINDER_BATTERY: EnemyDef = {
  id: "cinder-battery",
  name: "Cinder Battery",
  maxHp: 18,
  actions: CINDER_ACTIONS,
};

// a concise, keyword-clear one-line summary of what an action does
export function describeAction(a: EnemyAction): string {
  const parts: string[] = [];
  const dmg = a.perHit.find((e) => e.keyword === "damage")?.value;
  const mv = a.perHit.find((e) => e.keyword === "move")?.value;
  const onMv = a.onHit.find((e) => e.keyword === "move")?.value;
  if (dmg) parts.push(`${a.instances}× Damage ${dmg}`);
  if (mv) parts.push(`Move −${Math.abs(mv)} (unblockable)`);
  if (onMv) parts.push(`on hit: Move −${Math.abs(onMv)}`);
  return parts.join(" · ");
}

// ---- The enemy action, expressed in the SAME diagram grammar -----
// A fixed, authored phrase the player reads but does not play (GDD §9.3):
// charge nodes on the lead-up beats resolving into one FIRE node.
export function actionToDiagram(action: EnemyAction): Ability {
  const nodes: Ability["nodes"] = [];
  const edges: [string, string][] = [];
  // charge nodes on every beat before the resolution beat
  for (let b = 1; b < action.beat; b++) {
    const id = `enemy-charge-${b}`;
    // mirror the player's zig-zag spacing so the two sides read as siblings
    const x = 16 + ((b - 1) / Math.max(1, action.beat - 1)) * 68;
    const y = b % 2 === 0 ? 60 : 36;
    nodes.push({ id, beat: b, x, y, execKey: "", kind: "fixed" });
    if (b > 1) edges.push([`enemy-charge-${b - 1}`, id]);
  }
  const fireId = "enemy-fire";
  nodes.push({
    id: fireId,
    beat: action.beat,
    x: 86,
    y: action.beat % 2 === 0 ? 60 : 36,
    execKey: "",
    kind: "fixed",
    fixedEffect: { keyword: "damage", value: action.perHit[0]?.value ?? 0 },
  });
  if (action.beat > 1) edges.push([`enemy-charge-${action.beat - 1}`, fireId]);
  return {
    id: `${action.id}-diagram`,
    name: action.name,
    blurb: "",
    beats: action.beat,
    nodes,
    edges,
  };
}
