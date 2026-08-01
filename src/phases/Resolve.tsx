import { useEffect } from "react";
import { useGame } from "../store";

export default function Resolve() {
  const { lastResolution, advanceAfterResolve } = useGame();

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") advanceAfterResolve();
    };
    window.addEventListener("keydown", on);
    const id = setTimeout(advanceAfterResolve, 4200);
    return () => {
      window.removeEventListener("keydown", on);
      clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!lastResolution) return null;
  const chained = lastResolution.chainEarned;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(120% 100% at 50% 50%, rgba(20,20,42,0.6), rgba(5,3,10,0.9))",
        backdropFilter: "blur(2px)",
      }}
    >
      <div className="arcane-panel floatUp" style={{ padding: "28px 34px", minWidth: 420, maxWidth: 560 }}>
        <div className="tag">exchange resolved</div>
        <div
          style={{
            fontFamily: "var(--display)",
            fontSize: 40,
            letterSpacing: "0.04em",
            color: chained ? "var(--sidestep)" : "var(--ink)",
            marginBottom: 14,
            textShadow: chained ? "0 0 22px rgba(255,210,74,0.5)" : "none",
          }}
        >
          {chained ? "OPENING HELD" : "OPENING CLOSED"}
        </div>

        <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
          {lastResolution.lines.map((l, i) => (
            <li
              key={i}
              className="floatUp"
              style={{
                animationDelay: `${i * 90}ms`,
                fontSize: 14,
                color:
                  l.tone === "good"
                    ? "var(--poison)"
                    : l.tone === "bad"
                    ? "var(--attack)"
                    : "var(--ink-dim)",
              }}
            >
              {l.text}
            </li>
          ))}
        </ul>

        <div className="tag blink" style={{ marginTop: 22 }}>
          {chained ? "chain continues — press Space" : "press Space to continue"}
        </div>
      </div>
    </div>
  );
}
