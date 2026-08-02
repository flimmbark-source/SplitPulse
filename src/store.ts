import { create } from "zustand";
import type {
  Ability,
  BeltMaterial,
  MaterialDef,
  Resolution,
  ResolvedNode,
} from "./types";
import { ABILITIES, CINDER_BATTERY, MATERIALS } from "./data/content";

export type Phase =
  | "title"
  | "gather"
  | "approach"
  | "configure"
  | "execute"
  | "resolve"
  | "gameover"
  | "victory";

/** node slot -> belt material key assigned to it */
export type NodeAssignments = Record<string, string>;

interface GameState {
  phase: Phase;

  // encounter
  playerHp: number;
  playerMaxHp: number;
  enemyHp: number;
  enemyMaxHp: number;
  distance: number; // 0..100, 100 == attack range
  chainCount: number;
  enemyLearned: boolean;

  // materials
  belt: BeltMaterial[];

  // configuration
  abilities: Ability[];
  selectedAbility: number;
  assignments: NodeAssignments; // nodeId -> belt key
  selectedNode: string | null;

  // execution result
  lastResolution: Resolution | null;
  lastResolved: ResolvedNode[];

  // actions
  setPhase: (p: Phase) => void;
  startRun: () => void;
  collectMaterial: (def: MaterialDef) => void;
  finishGather: () => void;

  cycleAbility: (dir: number) => void;
  selectNode: (nodeId: string | null) => void;
  assignToSelected: (beltKey: string) => void;
  clearAssignment: (nodeId: string) => void;

  commitExecution: (resolved: ResolvedNode[], res: Resolution) => void;
  advanceAfterResolve: () => void;

  takeApproachHit: (dmg: number, push: number) => void;
  gainDistance: (d: number) => void;
  reachAttackRange: () => void;
}

const BELT_KEYS = ["Q", "W", "E", "R", "T", "Y"];

function freshBelt(): BeltMaterial[] {
  return [];
}

export const useGame = create<GameState>((set, get) => ({
  phase: "title",

  playerHp: 12,
  playerMaxHp: 12,
  enemyHp: CINDER_BATTERY.maxHp,
  enemyMaxHp: CINDER_BATTERY.maxHp,
  distance: 0,
  chainCount: 0,
  enemyLearned: false,

  belt: freshBelt(),

  abilities: ABILITIES,
  selectedAbility: 1, // start on Prism Step so the chain is discoverable
  assignments: {},
  selectedNode: null,

  lastResolution: null,
  lastResolved: [],

  setPhase: (p) => set({ phase: p }),

  startRun: () =>
    set({
      phase: "gather",
      playerHp: 12,
      playerMaxHp: 12,
      enemyHp: CINDER_BATTERY.maxHp,
      enemyMaxHp: CINDER_BATTERY.maxHp,
      distance: 0,
      chainCount: 0,
      enemyLearned: false,
      belt: freshBelt(),
      assignments: {},
      selectedNode: null,
      selectedAbility: 1,
      lastResolution: null,
      lastResolved: [],
    }),

  collectMaterial: (def) => {
    const belt = get().belt.slice();
    const existing = belt.find((b) => b.def.id === def.id);
    if (existing) {
      existing.charges = Math.min(existing.def.maxCharges, existing.charges + 1);
    } else {
      if (belt.length >= BELT_KEYS.length) return;
      belt.push({ def, key: BELT_KEYS[belt.length], charges: Math.ceil(def.maxCharges / 2) + 1 });
    }
    set({ belt });
  },

  finishGather: () => {
    // guarantee a usable belt even if the player dawdled
    const belt = get().belt.slice();
    if (belt.length === 0) {
      // fall back to a default kit
      belt.push({ def: MATERIALS.emberdust, key: "Q", charges: 3 });
    }
    set({ belt, phase: "approach" });
  },

  cycleAbility: (dir) => {
    const { abilities, selectedAbility } = get();
    const n = abilities.length;
    set({
      selectedAbility: (selectedAbility + dir + n) % n,
      assignments: {},
      selectedNode: null,
    });
  },

  selectNode: (nodeId) => set({ selectedNode: nodeId }),

  assignToSelected: (beltKey) => {
    const { selectedNode, assignments, belt } = get();
    if (!selectedNode) return;
    if (!belt.find((b) => b.key === beltKey)) return;
    set({ assignments: { ...assignments, [selectedNode]: beltKey } });
  },

  clearAssignment: (nodeId) => {
    const a = { ...get().assignments };
    delete a[nodeId];
    set({ assignments: a });
  },

  commitExecution: (resolved, res) => {
    // spend one charge per committed placement (committed, not per-hit)
    const belt = get().belt.map((b) => ({ ...b }));
    for (const r of resolved) {
      if (r.materialKey) {
        const m = belt.find((b) => b.key === r.materialKey);
        if (m) m.charges = Math.max(0, m.charges - 1);
      }
    }
    const enemyHp = Math.max(0, get().enemyHp - res.playerDamageDealt);
    const playerHp = Math.max(0, get().playerHp - res.damageTaken);
    set({
      belt: belt.filter((b) => b.charges > 0 || true), // keep zeroed mats visible as spent
      enemyHp,
      playerHp,
      lastResolution: res,
      lastResolved: resolved,
      phase: "resolve",
      enemyLearned: true,
    });
  },

  advanceAfterResolve: () => {
    const { enemyHp, playerHp, lastResolution } = get();
    if (enemyHp <= 0) {
      set({ phase: "victory" });
      return;
    }
    if (playerHp <= 0) {
      set({ phase: "gameover" });
      return;
    }
    if (lastResolution?.chainEarned) {
      // keep the opening: straight back into configuration
      set((s) => ({
        phase: "configure",
        chainCount: s.chainCount + 1,
        assignments: {},
        selectedNode: null,
      }));
    } else {
      // opening closes; pushed back into the approach
      const push = lastResolution?.pushedBack ?? 0;
      set((s) => ({
        phase: "approach",
        chainCount: 0,
        distance: Math.max(0, s.distance - 30 - push * 8),
        assignments: {},
        selectedNode: null,
      }));
    }
  },

  takeApproachHit: (dmg, push) =>
    set((s) => {
      const hp = Math.max(0, s.playerHp - dmg);
      return {
        playerHp: hp,
        distance: Math.max(0, s.distance - push),
        phase: hp <= 0 ? "gameover" : s.phase,
      };
    }),

  gainDistance: (d) =>
    set((s) => ({ distance: Math.min(100, s.distance + d) })),

  reachAttackRange: () => set({ phase: "configure", distance: 100 }),
}));

// dev-only debug handle for manual phase jumps / screenshots
if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as unknown as { __game: typeof useGame }).__game = useGame;
}
