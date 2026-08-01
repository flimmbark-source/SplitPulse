import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { Group, Vector3 } from "three";
import { CAMERA_LOOK_TARGET, ENEMY_ORIGIN, PATTERNS, SEGMENTS } from "./graph";

// the authored approach, as an ordered run of path pieces. Dodging carries
// you forward through it; a hit knocks you BACK along the same route
// (never a full reset) — "maintain progress by avoiding attacks" (GDD §2.1).
const ORDER = ["approach_a", "approach_b", "rush"] as const;
const KNOCKBACK = 0.6; // progress units lost per hit
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
const DIRS: Dir[] = ["left", "right", "up", "down"];

const POOL = 6;

interface Shot {
  active: boolean;
  born: number;
  impact: number;
  dir: Dir;
  resolved: boolean;
  target: Vector3; // captured camera position at spawn (+lead)
}

export default function ArenaRig({
  onHit,
  onAvoid,
}: {
  onHit: () => void;
  onAvoid: () => void;
}) {
  const camera = useThree((s) => s.camera);
  const groups = useRef<(Group | null)[]>([]);
  const arrows = useRef<(HTMLDivElement | null)[]>([]);

  // sim state (refs — never re-render per frame)
  const gRef = useRef(0); // global progress along ORDER, 0..ORDER.length
  const dodge = useRef<{ dir: Dir; t: number } | null>(null);
  const fireTimer = useRef(0);
  const shots = useRef<Shot[]>(
    Array.from({ length: POOL }, () => ({
      active: false,
      born: 0,
      impact: 0,
      dir: "left" as Dir,
      resolved: true,
      target: new Vector3(),
    }))
  );
  const done = useRef(false);

  // scratch vectors
  const scratch = useMemo(
    () => ({ pos: new Vector3(), fwd: new Vector3(), right: new Vector3(), up: new Vector3(), tmp: new Vector3() }),
    []
  );
  const worldUp = useMemo(() => new Vector3(0, 1, 0), []);

  // ---- input: dodge relative to current facing ----
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const d = DIR_KEY[e.key];
      if (!d) return;
      e.preventDefault();
      dodge.current = { dir: d, t: performance.now() };
      sfx.dodge();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  const spawnShot = (now: number, lead: number) => {
    const s = shots.current.find((x) => !x.active);
    if (!s) return;
    s.active = true;
    s.resolved = false;
    s.born = now;
    s.impact = now + lead;
    s.dir = DIRS[(Math.random() * 4) | 0];
    // aim at where the camera is now, nudged along its travel
    s.target.copy(camera.position);
    sfx.enemyFire();
  };

  useFrame((state, dtRaw) => {
    if (done.current) return;
    const now = state.clock.elapsedTime * 1000;
    const dt = Math.min(dtRaw, 0.05);

    // ---- current path piece from global progress ----
    const idx = Math.min(ORDER.length - 1, Math.floor(gRef.current));
    const S = SEGMENTS[ORDER[idx]];

    // ---- advance along the ordered route ----
    gRef.current += dt / S.duration;
    const reachedEnd = gRef.current >= ORDER.length;
    const localT = Math.min(1, gRef.current - idx);
    const along = S.curve.getPoint(localT, scratch.pos);

    // ---- camera basis (facing the enemy) ----
    scratch.fwd.copy(CAMERA_LOOK_TARGET).sub(along).normalize();
    scratch.right.copy(scratch.fwd).cross(worldUp).normalize();
    scratch.up.copy(scratch.right).cross(scratch.fwd).normalize();

    // ---- dodge offset (relative to facing) ----
    let ox = 0;
    let oy = 0;
    if (dodge.current) {
      const p = (now - dodge.current.t) / 300;
      if (p >= 1) dodge.current = null;
      else {
        const amp = Math.sin(Math.min(1, p) * Math.PI) * 1.15;
        if (dodge.current.dir === "left") ox = -amp;
        if (dodge.current.dir === "right") ox = amp;
        if (dodge.current.dir === "up") oy = amp;
        if (dodge.current.dir === "down") oy = -amp * 0.7;
      }
    }
    const dodgeActive = !!dodge.current && now - dodge.current.t < 260;

    camera.position
      .copy(along)
      .addScaledVector(scratch.right, ox)
      .addScaledVector(scratch.up, oy);
    camera.lookAt(CAMERA_LOOK_TARGET);

    // ---- enemy fire ----
    if (S.pattern) {
      const pat = PATTERNS[S.pattern];
      fireTimer.current += dt;
      if (fireTimer.current >= pat.interval) {
        fireTimer.current = 0;
        spawnShot(now, pat.lead * 1000);
      }
    }

    // ---- update shots ----
    let hitThisFrame = false;
    shots.current.forEach((s, i) => {
      const g = groups.current[i];
      const arrow = arrows.current[i];
      if (!g) return;
      if (!s.active) {
        g.visible = false;
        if (arrow) arrow.style.opacity = "0";
        return;
      }
      g.visible = true;
      const p = (now - s.born) / (s.impact - s.born);
      // fly from the enemy vents toward the captured/target point, homing slightly
      s.target.lerp(camera.position, 0.02);
      g.position.copy(ENEMY_ORIGIN).lerp(s.target, Math.min(1, p));
      const scale = 0.25 + p * 0.5;
      g.scale.setScalar(scale);

      // telegraph arrow
      if (arrow) {
        if (!s.resolved && p > 0.08 && p < 0.82) {
          arrow.style.opacity = "1";
          arrow.textContent = ARROW[s.dir];
        } else arrow.style.opacity = "0";
      }

      // resolve at impact
      if (!s.resolved && p >= 1) {
        s.resolved = true;
        const avoided = dodgeActive && dodge.current!.dir === s.dir;
        if (avoided) {
          onAvoid();
          sfx.dodge();
          s.active = false;
        } else {
          hitThisFrame = true;
          s.active = false;
        }
      }
      if (s.resolved && p > 1.25) s.active = false;
    });

    if (hitThisFrame) {
      onHit();
      sfx.impact();
      useGame.getState().takeApproachHit(2, 0);
      if (useGame.getState().playerHp <= 0) {
        done.current = true;
      } else {
        // knocked back along the route (never a full reset)
        gRef.current = Math.max(0, gRef.current - KNOCKBACK);
        fireTimer.current = 0;
        shots.current.forEach((s) => (s.active = false));
      }
    }

    // ---- progress meter ----
    useGame.setState({ distance: Math.min(100, (gRef.current / ORDER.length) * 100) });

    // ---- dev telemetry: the direction currently telegraphed (for tests) ----
    if (import.meta.env.DEV) {
      let dir: Dir | null = null;
      let soonest = Infinity;
      for (const s of shots.current) {
        if (!s.active || s.resolved) continue;
        const eta = s.impact - now;
        if (eta > 0 && eta < soonest) {
          soonest = eta;
          dir = s.dir;
        }
      }
      (window as unknown as { __arena: { dir: Dir | null } }).__arena = { dir };
    }

    // ---- arrival opens the attack window ----
    if (reachedEnd && !hitThisFrame) {
      done.current = true;
      sfx.attackPrompt();
      setTimeout(() => useGame.getState().reachAttackRange(), 300);
    }
  });

  return (
    <>
      {shots.current.map((_, i) => (
        <group key={i} ref={(el) => (groups.current[i] = el)} visible={false}>
          <mesh>
            <sphereGeometry args={[0.6, 8, 6]} />
            <meshStandardMaterial color="#ffd27a" emissive="#ff9a4d" emissiveIntensity={2.4} toneMapped={false} flatShading />
          </mesh>
          <mesh scale={1.7}>
            <sphereGeometry args={[0.6, 8, 6]} />
            <meshBasicMaterial color="#ff9a4d" transparent opacity={0.18} />
          </mesh>
          <Html center distanceFactor={10} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
            <div
              ref={(el) => (arrows.current[i] = el)}
              style={{
                fontFamily: "var(--mono)",
                fontWeight: 700,
                fontSize: 26,
                color: "var(--pulse)",
                textShadow: "0 0 10px var(--pulse)",
                opacity: 0,
                transition: "opacity 0.08s linear",
                transform: "translateY(-34px)",
              }}
            />
          </Html>
        </group>
      ))}
    </>
  );
}
