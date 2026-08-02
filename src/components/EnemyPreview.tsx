import type { EnemyAction } from "../types";
import { actionBeats } from "../data/content";

export default function EnemyPreview({
  action,
  learned,
}: {
  action: EnemyAction;
  learned: boolean;
}) {
  const beats = actionBeats(action);
  const rows = [...action.events].sort((a, b) => a.beat - b.beat);

  return (
    <div className="arcane-panel" style={{ padding: "14px 16px", minWidth: 240 }}>
      <div className="tag" style={{ color: "var(--attack)" }}>
        enemy · next action
      </div>
      <div
        style={{
          fontFamily: "var(--display)",
          fontSize: 22,
          letterSpacing: "0.04em",
          margin: "2px 0 8px",
        }}
      >
        {learned ? action.name : "??? UNLEARNED"}
      </div>

      {/* beat timeline — every event beat is marked */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 10 }}>
        {[1, 2, 3, 4].map((b) => {
          const hit = beats.includes(b);
          return (
            <div
              key={b}
              style={{
                flex: 1,
                textAlign: "center",
                padding: "6px 0",
                border: "1px solid var(--line)",
                background: hit ? "rgba(255,90,110,0.18)" : "transparent",
                color: hit ? "var(--attack)" : "var(--ink-dim)",
                fontSize: 11,
              }}
            >
              <div style={{ fontWeight: 700 }}>{b}</div>
              {hit && <div style={{ fontSize: 9 }}>HIT</div>}
            </div>
          );
        })}
      </div>

      {learned ? (
        <ul style={{ listStyle: "none", fontSize: 12, lineHeight: 1.7 }}>
          {rows.map((e, i) => {
            const dmg = e.perHit.find((x) => x.keyword === "damage")?.value;
            const mv = e.perHit.find((x) => x.keyword === "move")?.value;
            const onMv = e.onHit.find((x) => x.keyword === "move")?.value;
            return (
              <li key={i}>
                <span style={{ color: "var(--attack)", fontWeight: 700 }}>b{e.beat}</span>{" "}
                {dmg !== undefined && (
                  <span>
                    {e.instances}× Damage {dmg}
                  </span>
                )}
                {mv !== undefined && (
                  <span style={{ color: "var(--move)" }}>
                    Move −{Math.abs(mv)}{" "}
                    <span style={{ color: "var(--ink-dim)" }}>(unblockable)</span>
                  </span>
                )}
                {onMv !== undefined && (
                  <span style={{ color: "var(--move)" }}> · on hit Move −{Math.abs(onMv)}</span>
                )}
                <span style={{ color: "var(--sidestep)" }}> — Sidestep b{e.beat}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--ink-dim)" }}>
          <div>Resolves on beat{beats.length > 1 ? "s" : ""} {beats.join(", ")}.</div>
          <div style={{ marginTop: 6, fontStyle: "italic" }}>“{action.telegraph}”</div>
          <div style={{ marginTop: 6, color: "var(--miss)" }}>Effects: unknown</div>
        </div>
      )}
    </div>
  );
}
