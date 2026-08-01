import { CINDER_BATTERY } from "../data/content";

export default function EnemyPreview({ learned }: { learned: boolean }) {
  const a = CINDER_BATTERY.action;
  return (
    <div className="arcane-panel" style={{ padding: "14px 16px", minWidth: 230 }}>
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
        {learned ? a.name : "??? UNLEARNED"}
      </div>

      {/* beat timeline */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 10 }}>
        {[1, 2, 3, 4].map((b) => (
          <div
            key={b}
            style={{
              flex: 1,
              textAlign: "center",
              padding: "6px 0",
              border: "1px solid var(--line)",
              background: b === a.beat ? "rgba(255,90,110,0.18)" : "transparent",
              color: b === a.beat ? "var(--attack)" : "var(--ink-dim)",
              fontSize: 11,
            }}
          >
            <div style={{ fontWeight: 700 }}>{b}</div>
            {b === a.beat && <div style={{ fontSize: 9 }}>FIRE</div>}
          </div>
        ))}
      </div>

      {learned ? (
        <ul style={{ listStyle: "none", fontSize: 12, lineHeight: 1.7 }}>
          <li>
            <span style={{ color: "var(--move)" }}>▣</span> Fire {a.instances} missiles on
            beat {a.beat}
          </li>
          <li>
            <span style={{ color: "var(--attack)" }}>✕</span> Each missile: Damage{" "}
            {a.perHit[0].value}
          </li>
          <li>
            <span style={{ color: "var(--move)" }}>»</span> On hit: Move back{" "}
            {Math.abs(a.onHit[0].value ?? 0)}
          </li>
          <li style={{ marginTop: 6, color: "var(--sidestep)" }}>
            ⟳ Counter: Sidestep on beat {a.beat}
          </li>
        </ul>
      ) : (
        <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--ink-dim)" }}>
          <div>Resolves on beat {a.beat}.</div>
          <div>{a.instances} projectiles seen.</div>
          <div style={{ marginTop: 6, fontStyle: "italic" }}>“{a.telegraph}”</div>
          <div style={{ marginTop: 6, color: "var(--miss)" }}>Effects: unknown</div>
        </div>
      )}
    </div>
  );
}
