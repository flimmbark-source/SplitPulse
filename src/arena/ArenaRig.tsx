import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Group, Vector3 } from "three";
import { CAMERA_LOOK_TARGET, GRID_PATTERNS, PATTERNS, SEGMENTS } from "./graph";
import { useGame } from "../store";
import { sfx } from "../audio";

// the authored approach, as an ordered run of path pieces.
const ORDER = ["approach_a", "approach_b", "rush"] as const;
const KNOCKBACK = 0.6;

// ---- dodge waves -----------------------------------------------------------
// Each enemy attack re-instantiates a 3×3 grid CENTRED ON THE PLAYER: the
// player sits at centre and the attack fills a set of cells. The filled cells
// are shown as a WALL OF BLOCKS flying at the player — its shape (where the
// gaps are) tells you which way to slide. No literal grid is drawn.
const CELL_X = 1.7; // lateral spacing (also camera offset per column)
const CELL_Y = 1.2; // vertical spacing
const FAR_DIST = 11; // where the wall telegraphs
const NEAR_DIST = 0.4; // where it reaches the player plane
const PANEL = 1.45; // block size (< spacing so gaps read)
const POOL = 9;

const DIR_MOVE: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

interface Attack {
  active: boolean;
  born: number;
  impact: number;
  cells: number[];
  resolved: boolean;
}

export default function ArenaRig({
  onHit,
  onAvoid,
}: {
  onHit: () => void;
  onAvoid: () => void;
}) {
  const camera = useThree((s) => s.camera);
  const blocks = useRef<(Group | null)[]>([]);

  const gRef = useRef(0);
  const relCol = useRef(0); // player offset from the wave centre, in cells
  const relRow = useRef(0);
  const camOx = useRef(0);
  const camOy = useRef(0);
  const fireTimer = useRef(0);
  const strikeCount = useRef(0);
  const attack = useRef<Attack>({ active: false, born: 0, impact: 0, cells: [], resolved: true });
  const done = useRef(false);

  const scratch = useMemo(
    () => ({ pos: new Vector3(), fwd: new Vector3(), right: new Vector3(), up: new Vector3() }),
    []
  );
  const worldUp = useMemo(() => new Vector3(0, 1, 0), []);

  useEffect(() => {
    relCol.current = 0;
    relRow.current = 0;
  }, []);

  // ---- input: slide relative to the current wave ----
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const mv = DIR_MOVE[e.key];
      if (!mv) return;
      e.preventDefault();
      const nc = clamp1(relCol.current + mv[0]);
      const nr = clamp1(relRow.current + mv[1]);
      if (nc !== relCol.current || nr !== relRow.current) {
        relCol.current = nc;
        relRow.current = nr;
        sfx.dodge();
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  const startAttack = (now: number, lead: number) => {
    // re-instantiate the grid centred on the player
    relCol.current = 0;
    relRow.current = 0;
    const cells = GRID_PATTERNS[(Math.random() * GRID_PATTERNS.length) | 0].slice(0, POOL);
    attack.current = { active: true, born: now, impact: now + lead, cells, resolved: false };
    sfx.enemyFire();
  };

  useFrame((state, dtRaw) => {
    if (done.current) return;
    const now = state.clock.elapsedTime * 1000;
    const dt = Math.min(dtRaw, 0.05);

    // ---- traverse the route ----
    const idx = Math.min(ORDER.length - 1, Math.floor(gRef.current));
    const S = SEGMENTS[ORDER[idx]];
    gRef.current += dt / S.duration;
    const reachedEnd = gRef.current >= ORDER.length;
    const localT = Math.min(1, gRef.current - idx);
    S.curve.getPoint(localT, scratch.pos);

    // ---- camera basis ----
    scratch.fwd.copy(CAMERA_LOOK_TARGET).sub(scratch.pos).normalize();
    scratch.right.copy(scratch.fwd).cross(worldUp).normalize();
    scratch.up.copy(scratch.right).cross(scratch.fwd).normalize();

    // ---- smooth camera toward the player's cell (centre = 0) ----
    const tox = relCol.current * CELL_X;
    const toy = -relRow.current * CELL_Y;
    const k = Math.min(1, dt * 11);
    camOx.current += (tox - camOx.current) * k;
    camOy.current += (toy - camOy.current) * k;
    camera.position
      .copy(scratch.pos)
      .addScaledVector(scratch.right, camOx.current)
      .addScaledVector(scratch.up, camOy.current);
    camera.lookAt(CAMERA_LOOK_TARGET);

    // ---- schedule attacks ----
    if (S.pattern && !attack.current.active) {
      fireTimer.current += dt;
      if (fireTimer.current >= PATTERNS[S.pattern].interval) {
        fireTimer.current = 0;
        startAttack(now, PATTERNS[S.pattern].lead * 1000);
      }
    }

    // ---- drive the wall of blocks + resolve ----
    const at = attack.current;
    const p = at.active ? clamp01((now - at.born) / (at.impact - at.born)) : 0;
    const dist = FAR_DIST + (NEAR_DIST - FAR_DIST) * (p * p);
    let hitThisFrame = false;

    for (let i = 0; i < POOL; i++) {
      const g = blocks.current[i];
      if (!g) continue;
      if (at.active && i < at.cells.length) {
        const cell = at.cells[i];
        const c = cell % 3;
        const r = (cell / 3) | 0;
        g.position
          .copy(scratch.pos)
          .addScaledVector(scratch.fwd, dist)
          .addScaledVector(scratch.right, (c - 1) * CELL_X)
          .addScaledVector(scratch.up, (1 - r) * CELL_Y);
        g.visible = true;
        const grow = 0.6 + p * 0.6;
        g.scale.setScalar(grow);
      } else {
        g.visible = false;
      }
    }

    if (at.active && !at.resolved && p >= 1) {
      at.resolved = true;
      at.active = false;
      strikeCount.current += 1;
      const struck = at.cells.some(
        (cell) => cell % 3 === relCol.current + 1 && ((cell / 3) | 0) === relRow.current + 1
      );
      if (struck) hitThisFrame = true;
      else onAvoid();
    }

    if (hitThisFrame) {
      onHit();
      sfx.impact();
      useGame.getState().takeApproachHit(2, 0);
      if (useGame.getState().playerHp <= 0) {
        done.current = true;
      } else {
        gRef.current = Math.max(0, gRef.current - KNOCKBACK);
        fireTimer.current = 0;
      }
    }

    // ---- progress meter ----
    useGame.setState({ distance: Math.min(100, (gRef.current / ORDER.length) * 100) });

    // ---- dev telemetry (for tests) ----
    if (import.meta.env.DEV) {
      (window as unknown as { __arena: { danger: number[]; relCol: number; relRow: number } }).__arena =
        {
          danger: at.active && !at.resolved ? at.cells : [],
          relCol: relCol.current,
          relRow: relRow.current,
        };
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
      {Array.from({ length: POOL }).map((_, i) => (
        <group key={i} ref={(el) => (blocks.current[i] = el)} visible={false}>
          <mesh>
            <boxGeometry args={[PANEL, PANEL, PANEL]} />
            <meshStandardMaterial color="#ff5a4a" emissive="#ff2a1a" emissiveIntensity={2} toneMapped={false} flatShading />
          </mesh>
          <mesh scale={1.12}>
            <boxGeometry args={[PANEL, PANEL, PANEL]} />
            <meshBasicMaterial color="#ff5566" wireframe transparent opacity={0.5} />
          </mesh>
        </group>
      ))}
    </>
  );
}
