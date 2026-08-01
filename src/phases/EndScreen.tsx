import { useEffect } from "react";
import { useGame } from "../store";
import { sfx } from "../audio";

export default function EndScreen() {
  const { phase, startRun, setPhase } = useGame();
  const victory = phase === "victory";

  useEffect(() => {
    if (victory) sfx.chain();
    else sfx.impact();
    const on = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") startRun();
      if (e.key === "Escape") setPhase("title");
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="center-col"
      style={{
        position: "absolute",
        inset: 0,
        justifyContent: "center",
        background: victory
          ? "radial-gradient(120% 90% at 50% 40%, #10261f 0%, var(--bg) 60%)"
          : "radial-gradient(120% 90% at 50% 40%, #2a0d14 0%, var(--bg) 60%)",
      }}
    >
      <div className="tag floatUp">{victory ? "the battery goes dark" : "you are driven down"}</div>
      <h1
        className="bigtitle floatUp"
        style={{
          background: victory
            ? "linear-gradient(180deg, var(--poison), var(--pulse))"
            : "linear-gradient(180deg, var(--attack), var(--arcane))",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
        }}
      >
        {victory ? "CLEARED" : "FELLED"}
      </h1>
      <p className="dim floatUp" style={{ maxWidth: 460, lineHeight: 1.6 }}>
        {victory
          ? "The phrase resolved true. One complete exchange, answered in rhythm."
          : "The opening never held long enough. Regather, reconfigure, try the timing again."}
      </p>
      <div style={{ display: "flex", gap: 12 }} className="floatUp">
        <button className="btn" onClick={startRun}>Run again ▸ Space</button>
        <button className="btn ghost" onClick={() => setPhase("title")}>Title ▸ Esc</button>
      </div>
    </div>
  );
}
