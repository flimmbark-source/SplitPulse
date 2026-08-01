import type { BeltMaterial } from "../types";
import { effectLabel } from "../game/nodes";

export default function Toolbelt({
  belt,
  onPick,
  activeKeys,
}: {
  belt: BeltMaterial[];
  onPick?: (key: string) => void;
  activeKeys?: string[];
}) {
  return (
    <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
      {belt.map((b) => {
        const spent = b.charges <= 0;
        const active = activeKeys?.includes(b.key);
        return (
          <button
            key={b.key}
            className="arcane-panel pointer"
            onClick={() => !spent && onPick?.(b.key)}
            style={{
              padding: "8px 12px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              opacity: spent ? 0.35 : 1,
              borderColor: active ? b.def.color : "var(--line)",
              boxShadow: active ? `0 0 18px ${b.def.color}` : undefined,
              cursor: spent ? "not-allowed" : "pointer",
            }}
          >
            <span className="keycap" style={{ color: b.def.color }}>
              {b.key}
            </span>
            <span style={{ fontSize: 22, color: b.def.color }}>{b.def.glyph}</span>
            <span style={{ textAlign: "left" }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{b.def.name}</div>
              <div className="tag" style={{ color: b.def.color }}>
                {effectLabel(b.def.effect)} · {b.charges}/{b.def.maxCharges}
              </div>
            </span>
          </button>
        );
      })}
    </div>
  );
}
