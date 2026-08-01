import type { Ability, BeltMaterial } from "../types";
import type { NodeAssignments } from "../store";
import { KEYWORD_COLOR, KEYWORD_GLYPH, nodeEffect } from "../game/nodes";

export interface ExecState {
  nodeState: Record<string, "pending" | "hit" | "miss">;
  ring: Record<string, number>; // 0 (wide) .. 1 (contracted to edge)
  pulse?: { from: string; to: string; p: number } | null;
}

interface Props {
  ability: Ability;
  belt: BeltMaterial[];
  assignments: NodeAssignments;
  selectedNode?: string | null;
  onSelectNode?: (id: string) => void;
  exec?: ExecState | null;
  showKeys?: boolean;
}

const R = 7; // node radius in svg units

export default function Diagram({
  ability,
  belt,
  assignments,
  selectedNode,
  onSelectNode,
  exec,
  showKeys,
}: Props) {
  const byId = Object.fromEntries(ability.nodes.map((n) => [n.id, n]));

  return (
    <svg viewBox="0 0 100 90" width="100%" height="100%" style={{ overflow: "visible" }}>
      <defs>
        <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* edges */}
      {ability.edges.map(([a, b], i) => {
        const na = byId[a];
        const nb = byId[b];
        const lit =
          exec?.pulse && exec.pulse.from === a && exec.pulse.to === b;
        return (
          <g key={i}>
            <line
              x1={na.x}
              y1={na.y}
              x2={nb.x}
              y2={nb.y}
              stroke="var(--line)"
              strokeWidth={0.8}
            />
            <line
              x1={na.x}
              y1={na.y}
              x2={nb.x}
              y2={nb.y}
              stroke="var(--pulse)"
              strokeWidth={1.4}
              strokeDasharray="1 3"
              opacity={lit ? 0.9 : 0.12}
            />
            {/* travelling pulse spark */}
            {lit && (
              <circle
                cx={na.x + (nb.x - na.x) * exec!.pulse!.p}
                cy={na.y + (nb.y - na.y) * exec!.pulse!.p}
                r={2}
                fill="var(--hit)"
                filter="url(#glow)"
              />
            )}
          </g>
        );
      })}

      {/* nodes */}
      {ability.nodes.map((n) => {
        const { effect, materialKey } = nodeEffect(n, assignments, belt);
        const color = effect ? KEYWORD_COLOR[effect.keyword] : "var(--ink-dim)";
        const glyph = effect
          ? KEYWORD_GLYPH[effect.keyword]
          : n.kind === "config"
          ? n.slot?.toString() ?? ""
          : "·"; // effect-less fixed node (e.g. an enemy charge beat)
        const selected = selectedNode === n.id;
        const st = exec?.nodeState[n.id];
        const ringP = exec?.ring[n.id] ?? -1;
        const fill =
          st === "hit"
            ? "var(--hit)"
            : st === "miss"
            ? "var(--miss)"
            : effect
            ? "#0c0c16"
            : "#0c0c16";

        return (
          <g
            key={n.id}
            style={{ cursor: onSelectNode ? "pointer" : "default" }}
            onClick={() => onSelectNode?.(n.id)}
          >
            {/* selection halo */}
            {selected && (
              <circle cx={n.x} cy={n.y} r={R + 4} fill="none" stroke="var(--pulse)" strokeWidth={1} opacity={0.9}>
                <animate attributeName="r" values={`${R + 3};${R + 6};${R + 3}`} dur="1s" repeatCount="indefinite" />
              </circle>
            )}

            {/* contracting timing ring during execution */}
            {ringP >= 0 && st === "pending" && (
              <circle
                cx={n.x}
                cy={n.y}
                r={R + 14 * (1 - ringP)}
                fill="none"
                stroke={ringP > 0.75 ? "var(--hit)" : color}
                strokeWidth={0.9}
                opacity={0.9}
              />
            )}

            {/* body */}
            <circle
              cx={n.x}
              cy={n.y}
              r={R}
              fill={fill}
              stroke={st === "hit" ? "var(--hit)" : color}
              strokeWidth={n.kind === "fixed" ? 1.6 : 1.1}
              filter={effect || st === "hit" ? "url(#glow)" : undefined}
            />
            {/* fixed nodes get a second ring to mark permanence */}
            {n.kind === "fixed" && (
              <circle cx={n.x} cy={n.y} r={R - 2.2} fill="none" stroke={color} strokeWidth={0.5} opacity={0.6} />
            )}

            {/* glyph */}
            <text
              x={n.x}
              y={n.y + 2.6}
              textAnchor="middle"
              fontSize={7}
              fill={st === "hit" ? "#0c0c16" : color}
              style={{ fontFamily: "var(--mono)", fontWeight: 700 }}
            >
              {glyph}
            </text>

            {/* slot number for config nodes (below) */}
            {n.kind === "config" && (
              <text
                x={n.x}
                y={n.y - R - 2}
                textAnchor="middle"
                fontSize={4.5}
                fill={materialKey ? color : "var(--ink-dim)"}
                style={{ fontFamily: "var(--mono)" }}
              >
                slot {n.slot}
              </text>
            )}

            {/* execution key */}
            {showKeys && (
              <text
                x={n.x}
                y={n.y + R + 6}
                textAnchor="middle"
                fontSize={5}
                fill="var(--ink)"
                style={{ fontFamily: "var(--mono)", fontWeight: 700 }}
              >
                {n.execKey}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
