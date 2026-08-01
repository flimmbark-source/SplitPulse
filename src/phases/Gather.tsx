import { useEffect, useRef, useState } from "react";
import { useGame } from "../store";
import { MATERIALS } from "../data/content";
import { sfx } from "../audio";
import type { MaterialDef } from "../types";

const GATHER_SECONDS = 16;

interface Spot {
  key: string;
  label: string;
  material: MaterialDef;
  x: number; // %
  y: number; // %
  art: JSX.Element;
}

// small hand-drawn low-poly props (SVG) so the diorama reads without assets
const props = {
  cabinet: (
    <svg viewBox="0 0 100 120" width="100%" height="100%">
      <polygon points="10,20 90,10 92,110 8,116" fill="#2a2137" stroke="#4a3a52" strokeWidth="2" />
      <line x1="50" y1="14" x2="50" y2="113" stroke="#4a3a52" strokeWidth="2" />
      <circle cx="44" cy="64" r="3" fill="#ffd24a" />
      <circle cx="56" cy="62" r="3" fill="#ffd24a" />
    </svg>
  ),
  plant: (
    <svg viewBox="0 0 100 120" width="100%" height="100%">
      <polygon points="35,120 65,120 60,80 40,80" fill="#3a2b3a" stroke="#4a3a52" strokeWidth="2" />
      <polygon points="50,80 20,40 50,55 80,38 50,80" fill="#1f4a2a" stroke="#2f6a3a" strokeWidth="2" />
      <polygon points="50,70 30,20 50,45 72,22 50,70" fill="#296b38" stroke="#3f8a4a" strokeWidth="2" />
      <circle cx="50" cy="34" r="6" fill="#8dff6a" />
    </svg>
  ),
  device: (
    <svg viewBox="0 0 100 120" width="100%" height="100%">
      <polygon points="20,110 80,110 72,50 28,50" fill="#20293a" stroke="#3a4a6a" strokeWidth="2" />
      <rect x="40" y="20" width="20" height="34" fill="#141c2a" stroke="#3a4a6a" strokeWidth="2" />
      <circle cx="50" cy="78" r="14" fill="#0b1420" stroke="#58d0ff" strokeWidth="2" />
      <circle cx="50" cy="78" r="5" fill="#58d0ff" />
    </svg>
  ),
};

export default function Gather() {
  const { belt, collectMaterial, finishGather } = useGame();
  const [time, setTime] = useState(GATHER_SECONDS);
  const [flash, setFlash] = useState<string | null>(null);
  const doneRef = useRef(false);

  const spots: Spot[] = [
    { key: "F", label: "search cabinet", material: MATERIALS.emberdust, x: 22, y: 46, art: props.cabinet },
    { key: "J", label: "gather spore", material: MATERIALS.nightcap, x: 52, y: 58, art: props.plant },
    { key: "K", label: "tap condenser", material: MATERIALS.tidebrass, x: 80, y: 50, art: props.device },
  ];

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    finishGather();
  };

  useEffect(() => {
    const id = setInterval(() => {
      setTime((t) => {
        if (t <= 0.1) {
          clearInterval(id);
          finish();
          return 0;
        }
        return +(t - 0.1).toFixed(1);
      });
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const k = e.key.toUpperCase();
      if (k === " " || e.key === "Enter") {
        finish();
        return;
      }
      const spot = spots.find((s) => s.key === k);
      if (spot) {
        collectMaterial(spot.material);
        sfx.collect();
        setFlash(spot.material.id);
        setTimeout(() => setFlash(null), 260);
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectMaterial]);

  const urgent = time <= 4;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background:
          "linear-gradient(180deg, #0b0b16 0%, #16101e 55%, #090610 100%)",
        overflow: "hidden",
      }}
    >
      {/* floor grid for depth */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.25 }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <line key={i} x1="50%" y1="58%" x2={`${(i / 11) * 160 - 30}%`} y2="100%" stroke="#3a2b4a" strokeWidth="1" />
        ))}
        {Array.from({ length: 6 }).map((_, i) => (
          <line key={"h" + i} x1="0" y1={`${58 + i * 7}%`} x2="100%" y2={`${58 + i * 7}%`} stroke="#3a2b4a" strokeWidth="1" />
        ))}
      </svg>

      {/* header */}
      <div className="hud" style={{ top: 22, left: 22 }}>
        <div className="tag">gathering — apothecary cellar</div>
        <div style={{ fontFamily: "var(--display)", fontSize: 20, letterSpacing: "0.06em" }}>
          STOCK THE BELT
        </div>
      </div>

      {/* timer */}
      <div
        className="hud"
        style={{
          top: 22,
          right: 22,
          textAlign: "right",
          color: urgent ? "var(--attack)" : "var(--ink)",
        }}
      >
        <div className="tag">time</div>
        <div
          className={urgent ? "blink" : ""}
          style={{ fontFamily: "var(--display)", fontSize: 40, lineHeight: 1 }}
        >
          {time.toFixed(1)}
        </div>
      </div>

      {/* spots */}
      {spots.map((s) => {
        const held = belt.find((b) => b.def.id === s.material.id);
        const isFlash = flash === s.material.id;
        return (
          <div
            key={s.key}
            style={{
              position: "absolute",
              left: `${s.x}%`,
              top: `${s.y}%`,
              transform: "translate(-50%, -50%)",
              width: 120,
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 120,
                height: 140,
                filter: isFlash
                  ? "drop-shadow(0 0 16px " + "rgba(255,255,255,0.8))"
                  : "drop-shadow(0 6px 10px rgba(0,0,0,0.6))",
                transform: isFlash ? "scale(1.08)" : "scale(1)",
                transition: "transform 0.12s ease, filter 0.12s ease",
              }}
            >
              {s.art}
            </div>
            <div style={{ marginTop: 4, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <span className="keycap">{s.key}</span>
              <span className="tag" style={{ color: s.material.color }}>
                {s.label}
              </span>
              {held && (
                <span className="tag floatUp" style={{ color: "var(--pulse)" }}>
                  {held.def.name} ×{held.charges}
                </span>
              )}
            </div>
          </div>
        );
      })}

      {/* belt preview + proceed */}
      <div
        className="hud arcane-panel"
        style={{
          bottom: 20,
          left: "50%",
          transform: "translateX(-50%)",
          padding: "12px 20px",
          display: "flex",
          gap: 18,
          alignItems: "center",
        }}
      >
        <span className="tag">belt</span>
        {belt.length === 0 && <span className="dim">— empty — grab something —</span>}
        {belt.map((b) => (
          <span key={b.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="keycap sm" style={{ color: b.def.color }}>
              {b.key}
            </span>
            <span style={{ color: b.def.color }}>{b.def.glyph}</span>
            <span className="dim">×{b.charges}</span>
          </span>
        ))}
        <button className="btn ghost" onClick={finish} style={{ marginLeft: 12 }}>
          To the fight ▸ Space
        </button>
      </div>
    </div>
  );
}
