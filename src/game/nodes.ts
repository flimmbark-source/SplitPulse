import type { AbilityNode, BeltMaterial, Effect } from "../types";
import type { NodeAssignments } from "../store";
import { KEYWORDS } from "./keywords";

// Execution keys are standardised to WASD. The node's CIRCLE is coloured by
// its key (so "press the violet key" maps to the violet ring); the ICON inside
// keeps its keyword colour (so the effect stays legible). Two colour layers,
// two meanings: key identity on the ring, effect identity on the glyph.
// Xbox face-button colour associations, per request.
export const KEY_COLOR: Record<string, string> = {
  W: "#ffce3a", // yellow
  A: "#4f9dff", // blue
  S: "#5ad36a", // green
  D: "#ff5566", // red
};

export function keyColor(execKey: string | undefined, fallback: string): string {
  return execKey && KEY_COLOR[execKey] ? KEY_COLOR[execKey] : fallback;
}

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
  return `${KEYWORDS[e.keyword].label}${v}`;
}
