import type { EnemyAction } from "../types";

// ============================================================
// The enemy's action as a FIXED, authored diagram — mirroring
// the player's visual language across the split. Per GDD §9.3
// this is NOT a rhythm game: it is a single pulse travelling an
// authored spine toward one resolution beat. Its timing cannot
// change; the player reads it, they do not play it.
// ============================================================

interface Props {
  action: EnemyAction;
  now: number;
  leadIn: number;
  beatMs: number;
  firing: boolean;
  sidestepped: boolean;
  learned: boolean;
}

const R = 7;

export default function EnemyDiagram({
  action,
  now,
  leadIn,
  beatMs,
  firing,
  sidestepped,
  learned,
}: Props) {
  const beat = action.beat;
  const targetOf = (b: number) => leadIn + (b - 1) * beatMs;
  const fireT = targetOf(beat);

  // authored spine: prepare nodes on beats 1..beat-1, FIRE on `beat`
  const xOf = (b: number) => (beat > 1 ? 10 + ((b - 1) / (beat - 1)) * 78 : 50);
  const y = 34;
  const prepares = Array.from({ length: beat - 1 }, (_, i) => i + 1);

  // travelling pulse along the spine, synced to the shared clock
  const p = Math.max(0, Math.min(1, (now - leadIn) / (fireT - leadIn)));
  const pulseX = xOf(1) + p * (xOf(beat) - xOf(1));
  const pulseLive = now >= leadIn && now < fireT;

  // contracting ring on the FIRE node
  const ringLead = 860;
  const ringP = Math.max(-1, Math.min(1, (now - (fireT - ringLead)) / ringLead));

  const fireColor = firing ? "var(--hit)" : "var(--attack)";

  return (
    <svg viewBox="0 0 100 64" width="100%" height="100%" style={{ overflow: "visible" }}>
      <defs>
        <filter id="eglow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* spine */}
      <line x1={xOf(1)} y1={y} x2={xOf(beat)} y2={y} stroke="var(--line)" strokeWidth={0.8} />
      <line
        x1={xOf(1)}
        y1={y}
        x2={xOf(beat)}
        y2={y}
        stroke="var(--move)"
        strokeWidth={1.2}
        strokeDasharray="1 3"
        opacity={0.35}
      />
      {pulseLive && (
        <circle cx={pulseX} cy={y} r={2} fill="var(--hit)" filter="url(#eglow)" />
      )}

      {/* prepare nodes */}
      {prepares.map((b) => (
        <g key={b}>
          <circle
            cx={xOf(b)}
            cy={y}
            r={R - 2}
            fill="#0c0c16"
            stroke="var(--ink-dim)"
            strokeWidth={1}
          />
          <text
            x={xOf(b)}
            y={y + 1.6}
            textAnchor="middle"
            fontSize={4}
            fill="var(--ink-dim)"
            style={{ fontFamily: "var(--mono)" }}
          >
            ·
          </text>
        </g>
      ))}

      {/* FIRE node */}
      {ringP >= 0 && ringP < 1 && !firing && (
        <circle
          cx={xOf(beat)}
          cy={y}
          r={R + 14 * (1 - ringP)}
          fill="none"
          stroke={ringP > 0.75 ? "var(--hit)" : "var(--attack)"}
          strokeWidth={0.9}
          opacity={0.9}
        />
      )}
      <circle
        cx={xOf(beat)}
        cy={y}
        r={R + 1}
        fill="#160a10"
        stroke={fireColor}
        strokeWidth={1.8}
        filter="url(#eglow)"
      />
      <text
        x={xOf(beat)}
        y={y + 2.6}
        textAnchor="middle"
        fontSize={6}
        fill={fireColor}
        style={{ fontFamily: "var(--mono)", fontWeight: 700 }}
      >
        ✕
      </text>

      {/* the N generated hits, clustered on the single FIRE beat */}
      {Array.from({ length: action.instances }).map((_, i) => {
        const angle = (-Math.PI / 2) + (i - (action.instances - 1) / 2) * 0.5;
        const rad = R + 6;
        const baseX = xOf(beat) + Math.cos(angle) * rad;
        const baseY = y + Math.sin(angle) * rad;
        return (
          <circle
            key={i}
            cx={baseX}
            cy={baseY}
            r={2.4}
            fill={firing ? "var(--hit)" : "var(--move)"}
            style={{
              transition: "transform 0.5s cubic-bezier(.5,0,.2,1), opacity 0.5s",
              transform: firing
                ? sidestepped
                  ? "translate(-30px,-18px)"
                  : "translate(-14px,10px)"
                : "none",
              opacity: firing && sidestepped ? 0 : 1,
              filter: firing ? "url(#eglow)" : undefined,
            }}
          />
        );
      })}

      {/* labels: only what matters — the action, and how it's answered */}
      <text
        x={xOf(beat)}
        y={y + R + 9}
        textAnchor="middle"
        fontSize={4.2}
        fill="var(--attack)"
        style={{ fontFamily: "var(--mono)", fontWeight: 700, letterSpacing: "0.1em" }}
      >
        FIRE ×{action.instances}
      </text>
      {learned && (
        <text
          x={xOf(beat)}
          y={y + R + 15}
          textAnchor="middle"
          fontSize={3.4}
          fill="var(--sidestep)"
          style={{ fontFamily: "var(--mono)" }}
        >
          ⟳ answer here
        </text>
      )}
    </svg>
  );
}
