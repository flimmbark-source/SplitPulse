import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { NoToneMapping } from "three";
import Scene from "../arena/Scene";
import ArenaRig from "../arena/ArenaRig";
import { useGame } from "../store";

export default function Approach() {
  const distance = useGame((s) => s.distance);
  const [flash, setFlash] = useState<null | "hit" | "avoid">(null);
  const [shake, setShake] = useState(false);
  const flashTimer = useRef<number>();

  const doFlash = (kind: "hit" | "avoid") => {
    setFlash(kind);
    if (kind === "hit") {
      setShake(true);
      setTimeout(() => setShake(false), 260);
    }
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 320);
  };

  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  const atRange = distance > 84;

  return (
    <div style={{ position: "absolute", inset: 0, background: "#06060d", overflow: "hidden" }}>
      <div className={`arena-wrap ${shake ? "arena-shake" : ""}`} style={{ position: "absolute", inset: 0 }}>
        <Canvas
          className="ps1-canvas"
          dpr={0.4}
          gl={{ antialias: false, powerPreference: "high-performance", toneMapping: NoToneMapping }}
          camera={{ fov: 72, near: 0.1, far: 60, position: [13, 1.6, -4] }}
        >
          <color attach="background" args={["#06060d"]} />
          <fog attach="fog" args={["#0b0714", 7, 34]} />
          <Scene />
          <ArenaRig onHit={() => doFlash("hit")} onAvoid={() => doFlash("avoid")} />
        </Canvas>
      </div>

      {/* full-frame flashes */}
      {flash && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 20,
            pointerEvents: "none",
            background:
              flash === "hit"
                ? "radial-gradient(circle at 50% 55%, rgba(255,40,60,0.42), transparent 62%)"
                : "radial-gradient(circle at 50% 55%, rgba(103,232,255,0.28), transparent 62%)",
          }}
        />
      )}

      {/* crosshair */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%,-50%)",
          width: 14,
          height: 14,
          zIndex: 18,
          pointerEvents: "none",
          opacity: 0.5,
        }}
      >
        <div style={{ position: "absolute", left: 6, top: 0, width: 2, height: 14, background: "var(--ink)" }} />
        <div style={{ position: "absolute", top: 6, left: 0, height: 2, width: 14, background: "var(--ink)" }} />
      </div>

      {/* HUD */}
      <div className="hud" style={{ bottom: 22, left: "50%", transform: "translateX(-50%)", textAlign: "center", width: 340, zIndex: 22 }}>
        <div className="tag">carried through the arena — dodge with ← ↑ → ↓</div>
        <div className="meter" style={{ marginTop: 6 }}>
          <span style={{ background: "linear-gradient(90deg,var(--pulse),var(--arcane))", transform: `scaleX(${distance / 100})` }} />
        </div>
        {atRange && (
          <div
            className="floatUp"
            style={{
              marginTop: 10,
              fontFamily: "var(--display)",
              fontSize: 30,
              letterSpacing: "0.12em",
              color: "var(--sidestep)",
              textShadow: "0 0 18px rgba(255,207,74,0.6)",
            }}
          >
            ATTACK RANGE
          </div>
        )}
      </div>
    </div>
  );
}
