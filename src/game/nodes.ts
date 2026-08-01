import type { AbilityNode, BeltMaterial, Effect, Keyword } from "../types";
import type { NodeAssignments } from "../store";

export const KEYWORD_COLOR: Record<Keyword, string> = {
  attack: "var(--attack)",
  defend: "var(--defend)",
  poison: "var(--poison)",
  sidestep: "var(--sidestep)",
  guard: "var(--defend)",
  move: "var(--move)",
  damage: "var(--attack)",
};

export const KEYWORD_GLYPH: Record<Keyword, string> = {
  attack: "▲",
  defend: "◆",
  poison: "✦",
  sidestep: "⟳",
  guard: "◈",
  move: "»",
  damage: "✕",
};

/** the effect a node will produce given the current configuration */
export function nodeEffect(
  node: AbilityNode,
  assignments: NodeAssignments,
  belt: BeltMaterial[]
): { effect?: Effect; materialKey?: string } {
  if (node.kind === "fixed") return { effect: node.fixedEffect };
  const key = assignments[node.id];
  if (!key) return {};
  const mat = belt.find((b) => b.key === key);
  if (!mat) return {};
  return { effect: mat.def.effect, materialKey: key };
}

export function effectLabel(e?: Effect): string {
  if (!e) return "—";
  const v = e.value !== undefined ? ` ${Math.abs(e.value)}` : "";
  const name = e.keyword.charAt(0).toUpperCase() + e.keyword.slice(1);
  return `${name}${v}`;
}
