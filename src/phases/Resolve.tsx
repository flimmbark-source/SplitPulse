import { useEffect } from "react";
import { useGame } from "../store";

// The exchange already played out live during execution — this is just the
// outcome stinger (chain or not), no itemised text box.
export default function Resolve() {
  const { lastResolution, advanceAfterResolve } = useGame();

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") advanceAfterResolve();
    };
    window.addEventListener("keydown", on);
    const id = setTimeout(advanceAfterResolve, 1400);
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
      className="center-col"
      style={{
        position: "absolute",
        inset: 0,
        justifyContent: "center",
        background: "radial-gradient(120% 100% at 50% 50%, rgba(20,20,42,0.5), rgba(5,3,10,0.85))",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        className="floatUp"
        style={{
          fontFamily: "var(--display)",
          fontSize: "clamp(44px, 8vw, 96px)",
          letterSpacing: "0.04em",
          color: chained ? "var(--sidestep)" : "var(--ink-dim)",
          textShadow: chained ? "0 0 34px rgba(255,206,74,0.6)" : "none",
        }}
      >
        {chained ? "CHAIN!" : "OPENING CLOSED"}
      </div>
    </div>
  );
}
