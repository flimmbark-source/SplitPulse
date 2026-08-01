import { useGame } from "../store";

function Bar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <div style={{ minWidth: 160 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span className="tag">{label}</span>
        <span className="tag" style={{ color }}>
          {Math.round(value)}/{max}
        </span>
      </div>
      <div className="meter" style={{ marginTop: 4 }}>
        <span style={{ background: color, transform: `scaleX(${pct})` }} />
      </div>
    </div>
  );
}

export default function Hud() {
  const { playerHp, playerMaxHp, enemyHp, enemyMaxHp, chainCount, enemyLearned } =
    useGame();

  return (
    <>
      <div className="hud" style={{ top: 16, left: 16 }}>
        <Bar label="Alchemist" value={playerHp} max={playerMaxHp} color="var(--pulse)" />
      </div>
      <div className="hud" style={{ top: 16, right: 16, textAlign: "right" }}>
        <Bar
          label={enemyLearned ? "Cinder Battery" : "??? — unlearned"}
          value={enemyHp}
          max={enemyMaxHp}
          color="var(--attack)"
        />
      </div>
      {chainCount > 0 && (
        <div
          className="hud floatUp"
          style={{
            top: 62,
            left: "50%",
            transform: "translateX(-50%)",
            fontFamily: "var(--display)",
            fontSize: 22,
            letterSpacing: "0.1em",
            color: "var(--sidestep)",
          }}
        >
          CHAIN ×{chainCount}
        </div>
      )}
    </>
  );
}
