import type { Ability, BeltMaterial } from "../types";
import type { NodeAssignments } from "../store";
import { effectLabel, keyColor, nodeEffect } from "../game/nodes";
import { KEYWORDS } from "../game/keywords";

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
            {/* directional chevron — the edge is "led into" nb along its key
                axis, so point an arrow into nb in that key's colour */}
            {(() => {
              const dx = nb.x - na.x;
              const dy = nb.y - na.y;
              const len = Math.hypot(dx, dy) || 1;
              const ux = dx / len;
              const uy = dy / len;
              const px = -uy;
              const py = ux;
              const tipX = nb.x - ux * (R + 1.5);
              const tipY = nb.y - uy * (R + 1.5);
              const bx = tipX - ux * 3.2;
              const by = tipY - uy * 3.2;
              const wingW = 2.4;
              const col = keyColor(nb.execKey, "var(--ink-dim)");
              return (
                <polyline
                  points={`${bx + px * wingW},${by + py * wingW} ${tipX},${tipY} ${bx - px * wingW},${by - py * wingW}`}
                  fill="none"
                  stroke={col}
                  strokeWidth={1.1}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={lit ? 1 : 0.55}
                />
              );
            })()}

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
        // glyph colour = effect identity (keyword); circle colour = key identity
        const iconColor = effect ? KEYWORDS[effect.keyword].color : "var(--ink-dim)";
        const color = keyColor(n.execKey, iconColor);
        const glyph = effect
          ? KEYWORDS[effect.keyword].glyph
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
            {/* fixed nodes get a second ring, in the EFFECT colour, to mark
                permanence and keep the keyword identity on the node */}
            {n.kind === "fixed" && (
              <circle cx={n.x} cy={n.y} r={R - 2.2} fill="none" stroke={iconColor} strokeWidth={0.6} opacity={0.7} />
            )}

            {/* INSIDE the circle: the KEY to press (falls back to the glyph
                for keyless nodes, e.g. the enemy diagram) */}
            <text
              x={n.x}
              y={n.y + 2.6}
              textAnchor="middle"
              fontSize={n.execKey ? 7 : 7}
              fill={st === "hit" ? "#0c0c16" : n.execKey ? color : iconColor}
              style={{ fontFamily: "var(--mono)", fontWeight: 700 }}
            >
              {n.execKey || glyph}
            </text>

            {/* ABOVE the circle, tight: the effect ICON in its keyword colour */}
            {n.execKey && effect && (
              <text
                x={n.x}
                y={n.y - R - 2.4}
                textAnchor="middle"
                fontSize={6}
                fill={iconColor}
                style={{ fontFamily: "var(--mono)", fontWeight: 700 }}
              >
                {KEYWORDS[effect.keyword].glyph}
              </text>
            )}

            {/* slot number for config nodes (below, only while configuring) */}
            {n.kind === "config" && !showKeys && (
              <text
                x={n.x}
                y={n.y + R + 6}
                textAnchor="middle"
                fontSize={4.5}
                fill={materialKey ? iconColor : "var(--ink-dim)"}
                style={{ fontFamily: "var(--mono)" }}
              >
                slot {n.slot}
              </text>
            )}

            {/* the effect ACTIVATES here: a rising, fading label the moment the
                node lands (colour = keyword) — live feedback, not an after-report */}
            {showKeys && st === "hit" && effect && (
              <text
                x={n.x}
                y={n.y - R - 9}
                textAnchor="middle"
                fontSize={5.5}
                fill={iconColor}
                style={{ fontFamily: "var(--mono)", fontWeight: 700 }}
              >
                {effectLabel(effect)}
                <animate attributeName="opacity" from="1" to="0" dur="0.85s" fill="freeze" />
                <animate attributeName="y" from={n.y - R - 9} to={n.y - R - 20} dur="0.85s" fill="freeze" />
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
