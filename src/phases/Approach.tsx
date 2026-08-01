import { useEffect, useRef } from "react";
import { useGame } from "../store";
import { sfx } from "../audio";

type Dir = "left" | "right" | "up" | "down";
const DIR_KEY: Record<string, Dir> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
};
const ARROW: Record<Dir, string> = { left: "◄", right: "►", up: "▲", down: "▼" };
const DIR_VEC: Record<Dir, [number, number]> = {
  left: [-1, 0],
  right: [1, 0],
  up: [0, -1],
  down: [0, 1],
};

interface Missile {
  born: number;
  impact: number;
  dir: Dir;
  resolved: boolean;
}

// internal render resolution — deliberately tiny, scaled up nearest-neighbour
const RW = 320;
const RH = 180;

export default function Approach() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const store = useGame;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    canvas.width = RW;
    canvas.height = RH;

    let raf = 0;
    let running = true;
    const start = performance.now();

    // local sim state
    let distance = store.getState().distance;
    let dodge: { dir: Dir; t: number } | null = null;
    let shake = 0;
    let hitFlash = 0;
    let avoidFlash = 0;
    const missiles: Missile[] = [];
    let nextFire = 900;
    let promptPulse = 0;
    let transitioned = false;

    const jit = (v: number) => Math.round(v); // vertex snap

    function fireMissile(now: number) {
      const dirs: Dir[] = ["left", "right", "up", "down"];
      const dir = dirs[(Math.random() * 4) | 0];
      const lead = 1400 - Math.min(500, distance * 6); // faster as you close in
      missiles.push({ born: now, impact: now + lead, dir, resolved: false });
      sfx.enemyFire();
    }

    function onKey(e: KeyboardEvent) {
      const d = DIR_KEY[e.key];
      if (!d) return;
      e.preventDefault();
      dodge = { dir: d, t: performance.now() };
      sfx.dodge();
    }
    window.addEventListener("keydown", onKey);

    function frame(now: number) {
      if (!running) return;
      const t = now - start;

      // --- schedule fire ---
      if (t > nextFire) {
        fireMissile(now);
        nextFire = t + 1300 + Math.random() * 700;
      }

      // --- passive advance ---
      distance = Math.min(100, distance + 0.05);

      // --- dodge decay ---
      const dodgeActive = dodge && now - dodge.t < 300;
      let camX = 0;
      let camY = 0;
      if (dodge) {
        const p = (now - dodge.t) / 300; // 0..1
        const amp = Math.sin(Math.min(1, p) * Math.PI) * 34; // out and back
        const [vx, vy] = DIR_VEC[dodge.dir];
        camX = vx * amp;
        camY = vy * amp;
        if (p >= 1) dodge = null;
      }

      // --- resolve missiles ---
      for (const m of missiles) {
        if (m.resolved) continue;
        if (now >= m.impact) {
          m.resolved = true;
          const avoided = dodgeActive && dodge!.dir === m.dir;
          if (avoided) {
            avoidFlash = 1;
            distance = Math.min(100, distance + 6);
            sfx.dodge();
          } else {
            hitFlash = 1;
            shake = 10;
            distance = Math.max(0, distance - 10);
            store.getState().takeApproachHit(2, 6);
            sfx.impact();
            if (store.getState().playerHp <= 0) {
              running = false;
              return;
            }
          }
        }
      }
      // cull
      for (let i = missiles.length - 1; i >= 0; i--)
        if (missiles[i].resolved && now - missiles[i].impact > 200) missiles.splice(i, 1);

      // reached range?
      if (distance >= 100 && !transitioned) {
        transitioned = true;
        running = false;
        sfx.attackPrompt();
        setTimeout(() => store.getState().reachAttackRange(), 350);
      }

      // ===================== RENDER =====================
      shake *= 0.85;
      hitFlash *= 0.9;
      avoidFlash *= 0.9;
      promptPulse += 0.08;
      const sx = (Math.random() - 0.5) * shake;
      const sy = (Math.random() - 0.5) * shake;

      ctx.save();
      ctx.translate(jit(sx - camX * 0.4), jit(sy - camY * 0.4));

      // sky / fog
      const grad = ctx.createLinearGradient(0, 0, 0, RH);
      grad.addColorStop(0, "#1a0f22");
      grad.addColorStop(0.5, "#241534");
      grad.addColorStop(0.5, "#0d0716");
      grad.addColorStop(1, "#05030a");
      ctx.fillStyle = grad;
      ctx.fillRect(-40, -40, RW + 80, RH + 80);

      const horizon = RH * 0.5;
      const cx = RW / 2 - camX * 0.5;

      // perspective floor grid
      ctx.strokeStyle = "rgba(120,70,150,0.35)";
      ctx.lineWidth = 1;
      const vanish = t * 0.0016;
      for (let i = 0; i < 10; i++) {
        const f = ((i + (vanish % 1)) / 10);
        const y = jit(horizon + f * f * (RH - horizon));
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(RW, y);
        ctx.stroke();
      }
      for (let i = -6; i <= 6; i++) {
        ctx.beginPath();
        ctx.moveTo(jit(cx + i * 6), jit(horizon));
        ctx.lineTo(jit(cx + i * 60), RH);
        ctx.stroke();
      }

      // enemy silhouette ahead — grows as distance closes
      const scale = 0.5 + (distance / 100) * 1.6;
      const ex = jit(cx);
      const ey = jit(horizon - 10);
      const es = 22 * scale;
      // body (turret diamond)
      ctx.fillStyle = "#2a1420";
      ctx.strokeStyle = "#ff5a6e";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ex, ey - es);
      ctx.lineTo(ex + es * 0.8, ey);
      ctx.lineTo(ex, ey + es);
      ctx.lineTo(ex - es * 0.8, ey);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // three glowing vents (the three missiles)
      for (let i = -1; i <= 1; i++) {
        ctx.fillStyle = "#ff9d54";
        ctx.beginPath();
        ctx.arc(jit(ex + i * es * 0.45), jit(ey), Math.max(1.5, 2.5 * scale * 0.6), 0, 7);
        ctx.fill();
      }
      // eye
      ctx.fillStyle = "#fff6a0";
      ctx.fillRect(jit(ex - 2), jit(ey - es * 0.5), 4, 3);

      // missiles approaching camera
      for (const m of missiles) {
        if (m.resolved) continue;
        const p = (now - m.born) / (m.impact - m.born); // 0..1
        const z = 1 - p; // 1 far, 0 near
        const [vx, vy] = DIR_VEC[m.dir];
        // travels from enemy toward the point the player must vacate
        const px = jit(ex + vx * (1 - z) * 8 + camX * 0.0);
        const py = jit(ey + vy * (1 - z) * 8);
        const size = jit(2 + (1 - z) * 22);
        // trail
        ctx.fillStyle = "rgba(255,157,84,0.25)";
        ctx.beginPath();
        ctx.arc(px, py, size * 1.6, 0, 7);
        ctx.fill();
        // core
        ctx.fillStyle = p > 0.75 ? "#fff6a0" : "#ff9d54";
        ctx.beginPath();
        ctx.arc(px, py, size, 0, 7);
        ctx.fill();
        // directional telegraph
        if (p < 0.8) {
          ctx.fillStyle = "#6cf0ff";
          ctx.font = "bold 16px monospace";
          ctx.textAlign = "center";
          ctx.fillText(ARROW[m.dir], px, py - size - 4);
        }
      }

      // crosshair
      ctx.strokeStyle = "rgba(233,230,255,0.5)";
      ctx.beginPath();
      ctx.moveTo(RW / 2 - 6, RH / 2);
      ctx.lineTo(RW / 2 + 6, RH / 2);
      ctx.moveTo(RW / 2, RH / 2 - 6);
      ctx.lineTo(RW / 2, RH / 2 + 6);
      ctx.stroke();

      ctx.restore();

      // flashes (full-frame)
      if (hitFlash > 0.02) {
        ctx.fillStyle = `rgba(255,40,60,${hitFlash * 0.5})`;
        ctx.fillRect(0, 0, RW, RH);
      }
      if (avoidFlash > 0.02) {
        ctx.fillStyle = `rgba(108,240,255,${avoidFlash * 0.25})`;
        ctx.fillRect(0, 0, RW, RH);
      }

      // fog haze near enemy
      const fog = ctx.createRadialGradient(RW / 2, horizon, 4, RW / 2, horizon, RW * 0.6);
      fog.addColorStop(0, "rgba(120,60,140,0.0)");
      fog.addColorStop(1, "rgba(10,4,16,0.7)");
      ctx.fillStyle = fog;
      ctx.fillRect(0, 0, RW, RH);

      // sync distance to store so the meter reflects the sim
      store.setState({ distance });

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const distance = useGame((s) => s.distance);

  return (
    <div style={{ position: "absolute", inset: 0, background: "#05030a" }}>
      <canvas ref={canvasRef} className="ps1-canvas" />

      {/* overlays at full resolution */}
      <div className="hud" style={{ bottom: 20, left: "50%", transform: "translateX(-50%)", textAlign: "center", width: 320 }}>
        <div className="tag">closing distance — dodge with ← ↑ → ↓</div>
        <div className="meter" style={{ marginTop: 6 }}>
          <span style={{ background: "linear-gradient(90deg,var(--pulse),var(--pulse-2))", transform: `scaleX(${distance / 100})` }} />
        </div>
        {distance > 82 && (
          <div
            className="floatUp"
            style={{
              marginTop: 10,
              fontFamily: "var(--display)",
              fontSize: 30,
              letterSpacing: "0.12em",
              color: "var(--sidestep)",
              textShadow: "0 0 18px rgba(255,210,74,0.6)",
            }}
          >
            ATTACK RANGE
          </div>
        )}
      </div>
    </div>
  );
}
