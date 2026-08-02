// ============================================================
// SPLITPULSE — shared types
// The deterministic combat timeline is the single authority.
// Visuals consume it; they never redefine it.
// ============================================================

export type Keyword =
  | "attack"
  | "defend"
  | "poison"
  | "sidestep"
  | "guard"
  | "move"
  | "damage"; // enemy-side hit payload

export interface Effect {
  keyword: Keyword;
  value?: number;
  /** for enemy hit-attached effects */
  trigger?: "onHit";
}

// ---- Materials -------------------------------------------------
export interface MaterialDef {
  id: string;
  name: string;
  blurb: string;
  color: string;
  glyph: string; // single glyph shown in the node / belt
  /** effect this material contributes when placed in a node */
  effect: Effect;
  maxCharges: number;
}

/** a material instance sitting in the prepared belt */
export interface BeltMaterial {
  def: MaterialDef;
  key: string; // Q W E R T Y ...
  charges: number;
}

// ---- Abilities -------------------------------------------------
export type NodeKind = "fixed" | "config";

export interface AbilityNode {
  id: string;
  beat: number; // position on the shared beat timeline
  x: number; // svg layout 0..100
  y: number; // svg layout 0..100
  execKey: string; // key pressed during rhythmic execution
  kind: NodeKind;
  /** fixed nodes carry a permanent effect */
  fixedEffect?: Effect;
  /** config nodes expose a number-key slot */
  slot?: number;
}

export interface Ability {
  id: string;
  name: string;
  blurb: string;
  beats: number; // total beats in the phrase
  nodes: AbilityNode[];
  /** connections for the travelling pulse, in play order */
  edges: [string, string][];
}

// ---- Enemy -----------------------------------------------------
/** one timed sub-action of a named move, resolving on a single beat */
export interface EnemyEvent {
  beat: number;
  instances: number; // hit instances generated on this beat
  /** effects each instance carries — damage is mitigated by Defend, while
   *  move/status payloads are NOT (only a Sidestep on this beat avoids them). */
  perHit: Effect[];
  onHit: Effect[]; // triggered when a damaging hit lands (e.g. move -1)
}

export interface EnemyAction {
  id: string;
  name: string;
  /** a named move may fire several events across different beats */
  events: EnemyEvent[];
  /** partial info shown before the move is learned */
  telegraph: string;
}

export interface EnemyDef {
  id: string;
  name: string;
  maxHp: number;
  actions: EnemyAction[];
}

// ---- Resolution ------------------------------------------------
export interface ResolvedNode {
  node: AbilityNode;
  effect?: Effect; // the effect this node produced (from fixed or material)
  materialKey?: string;
  success: boolean; // did the player hit the timing?
}

export interface ResolutionLine {
  text: string;
  tone: "good" | "bad" | "neutral";
}

export interface Resolution {
  lines: ResolutionLine[];
  playerDamageDealt: number;
  poisonApplied: number;
  damageTaken: number;
  pushedBack: number;
  sidestepped: boolean;
  actionNeutralized: boolean; // => chain earned
  chainEarned: boolean;
}
