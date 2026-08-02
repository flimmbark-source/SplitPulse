import { useEffect, useRef, useState } from "react";
import { useGame } from "../store";

// The 3×3 dodge grid, rendered crisp over the pixelated arena. The player's
// node sits in one cell; enemy attacks light cells red; slide to safety.
export default function GridHud() {
  const grid = useGame((s) => s.grid);
  const [flash, setFlash] = useState(false);
  const lastStrike = useRef(grid.strike);

  useEffect(() => {
    if (grid.strike !== lastStrike.current) {
      lastStrike.current = grid.strike;
      setFlash(true);
      const id = setTimeout(() => setFlash(false), 160);
      return () => clearTimeout(id);
    }
  }, [grid.strike]);

  const playerCell = grid.row * 3 + grid.col;

  return (
    <div
      className="hud"
      style={{
        bottom: 96,
        left: "50%",
        transform: "translateX(-50%)",
        textAlign: "center",
        zIndex: 24,
      }}
    >
      <div className="tag" style={{ marginBottom: 8 }}>
        dodge grid · slide your node with ← ↑ → ↓
      </div>
      <div
        style={{
          display: "inline-grid",
          gridTemplateColumns: "repeat(3, 48px)",
          gridTemplateRows: "repeat(3, 48px)",
          gap: 5,
          padding: 6,
          background: "rgba(8,8,16,0.55)",
          border: "1px solid var(--line)",
          borderRadius: 4,
          boxShadow: flash ? "0 0 26px rgba(255,60,80,0.8)" : "none",
          transition: "box-shadow 0.1s linear",
        }}
      >
        {Array.from({ length: 9 }).map((_, i) => {
          const danger = grid.danger.includes(i);
          const isPlayer = i === playerCell;
          const trapped = isPlayer && danger;
          return (
            <div
              key={i}
              style={{
                position: "relative",
                border: `1px solid ${danger ? "var(--attack)" : "var(--line-2)"}`,
                borderRadius: 3,
                background: danger
                  ? "radial-gradient(circle, rgba(255,60,80,0.55), rgba(255,60,80,0.12))"
                  : "rgba(255,255,255,0.02)",
                boxShadow: danger ? "inset 0 0 12px rgba(255,60,80,0.5)" : "none",
                transition: "background 0.08s linear, border-color 0.08s linear",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {danger && !isPlayer && (
                <span style={{ color: "var(--attack)", fontWeight: 700, fontSize: 18 }}>✕</span>
              )}
              {isPlayer && (
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: trapped ? "var(--attack)" : "var(--pulse)",
                    boxShadow: `0 0 14px ${trapped ? "var(--attack)" : "var(--pulse)"}`,
                    border: "2px solid rgba(255,255,255,0.8)",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
