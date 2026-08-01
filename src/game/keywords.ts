import type { Keyword, ResolvedNode } from "../types";

// ============================================================
// KEYWORD REGISTRY
// Each keyword is a self-contained module: its identity (colour,
// glyph, label) AND how it folds into an exchange. The resolver,
// the diagram, the previews and the toolbelt all read this table
// — so adding a verb (Force, Reflection, a real status) is one
// entry here, with no edits to the resolver's core.
// ============================================================

/** the mutable tally a set of landed player effects builds up */
export interface Acc {
  attack: number; // damage dealt to the enemy
  poison: number; // status magnitude (chips this exchange, for the slice)
  defend: number; // pooled damage prevention (defend + guard)
  sidestepBeats: Set<number>; // beats on which a sidestep landed
  selfMove: number; // net self-reposition the player applies (+ forward)
  flags: Record<string, number>; // open bag for bespoke keywords
}

export interface KeywordDef {
  id: Keyword;
  label: string;
  color: string; // css custom property
  glyph: string;
  /** fold one landed placement of this keyword into the tally */
  apply?: (acc: Acc, value: number, node: ResolvedNode) => void;
}

export const KEYWORDS: Record<Keyword, KeywordDef> = {
  attack: {
    id: "attack",
    label: "Attack",
    color: "var(--attack)",
    glyph: "▲",
    apply: (a, v) => (a.attack += v),
  },
  poison: {
    id: "poison",
    label: "Poison",
    color: "var(--poison)",
    glyph: "✦",
    apply: (a, v) => (a.poison += v),
  },
  defend: {
    id: "defend",
    label: "Defend",
    color: "var(--defend)",
    glyph: "◆",
    apply: (a, v) => (a.defend += v),
  },
  guard: {
    id: "guard",
    label: "Guard",
    color: "var(--guard)",
    glyph: "◈",
    apply: (a, v) => (a.defend += v),
  },
  sidestep: {
    id: "sidestep",
    label: "Sidestep",
    color: "var(--sidestep)",
    glyph: "⟳",
    apply: (a, _v, n) => a.sidestepBeats.add(n.node.beat),
  },
  move: {
    id: "move",
    label: "Move",
    color: "var(--move)",
    glyph: "»",
    apply: (a, v) => (a.selfMove += v),
  },
  // enemy-side payload keyword — carries no player-side apply
  damage: { id: "damage", label: "Damage", color: "var(--attack)", glyph: "✕" },
};

export const kw = (k: Keyword): KeywordDef => KEYWORDS[k];

export const newAcc = (): Acc => ({
  attack: 0,
  poison: 0,
  defend: 0,
  sidestepBeats: new Set(),
  selfMove: 0,
  flags: {},
});
