import { useEffect } from "react";
import { useGame } from "../store";
import { sfx, unlockAudio } from "../audio";

export default function Title() {
  const startRun = useGame((s) => s.startRun);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        unlockAudio();
        sfx.attackPrompt();
        startRun();
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [startRun]);

  return (
    <div
      className="center-col"
      style={{
        position: "absolute",
        inset: 0,
        justifyContent: "center",
        background:
          "radial-gradient(120% 90% at 50% 20%, #14142a 0%, var(--bg) 60%)",
      }}
    >
      <div className="tag floatUp">an alchemical action rhythm — prototype</div>
      <h1 className="bigtitle floatUp">
        SPLIT
        <br />
        PULSE
      </h1>
      <p className="dim floatUp" style={{ maxWidth: 520, lineHeight: 1.6 }}>
        Advance through danger on rails. Read the enemy's next move. Build a timed
        response from a fixed diagram and scavenged materials — then{" "}
        <span style={{ color: "var(--pulse)" }}>perform it in rhythm</span>. The
        parts you strike become real.
      </p>
      <button
        className="btn floatUp"
        onClick={() => {
          unlockAudio();
          sfx.attackPrompt();
          startRun();
        }}
      >
        Begin ▸ press Enter
      </button>
      <div className="tag floatUp" style={{ marginTop: 8, opacity: 0.6 }}>
        headphones recommended — the diagram is a song
      </div>
    </div>
  );
}
