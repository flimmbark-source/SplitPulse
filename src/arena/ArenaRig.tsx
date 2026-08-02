import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Group, Vector3 } from "three";
import { CAMERA_LOOK_TARGET, GRID_PATTERNS, PATTERNS, SEGMENTS } from "./graph";
import { useGame } from "../store";
import { sfx } from "../audio";

// the authored approach, as an ordered run of path pieces. Advancing carries
// you forward; a hit knocks you BACK along the same route (never a full reset).
const ORDER = ["approach_a", "approach_b", "rush"] as const;
const KNOCKBACK = 0.6;

// ---- 3×3 dodge grid --------------------------------------------------------
// The player IS a node on a 3×3 grid. Enemy attacks light up cells; the player
// slides their node (arrow keys) to an unlit cell before the strike lands.
const COLS = 3;
const CELL_X = 1.45; // camera offset per column
const CELL_Y = 1.15; // camera offset per row
const FAR_DIST = 9; // how far ahead the lit orbs telegraph
const FAR_SPREAD = 2.7; // orb fan-out at the telegraph plane
const POOL = 6; // max lit cells shown at once

const DIR_MOVE: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const clampCell = (v: number) => Math.max(0, Math.min(COLS - 1, v));

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
  const orbs = useRef<(Group | null)[]>([]);

  // sim state
  const gRef = useRef(0);
  const col = useRef(1);
  const row = useRef(1);
  const curOx = useRef(0);
  const curOy = useRef(0);
  const fireTimer = useRef(0);
  const strikeCount = useRef(0);
  const attack = useRef<Attack>({ active: false, born: 0, impact: 0, cells: [], resolved: true });
  const done = useRef(false);

  const scratch = useMemo(
    () => ({
      pos: new Vector3(),
      fwd: new Vector3(),
      right: new Vector3(),
      up: new Vector3(),
      a: new Vector3(),
      b: new Vector3(),
    }),
    []
  );
  const worldUp = useMemo(() => new Vector3(0, 1, 0), []);

  // reset the grid on entering the arena
  useEffect(() => {
    col.current = 1;
    row.current = 1;
    useGame.getState().setGrid({ col: 1, row: 1, danger: [], strike: 0 });
  }, []);

  // ---- input: slide the node across the grid ----
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const mv = DIR_MOVE[e.key];
      if (!mv) return;
      e.preventDefault();
      const nc = clampCell(col.current + mv[0]);
      const nr = clampCell(row.current + mv[1]);
      if (nc !== col.current || nr !== row.current) {
        col.current = nc;
        row.current = nr;
        useGame.getState().setGrid({ col: nc, row: nr });
        sfx.dodge();
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  const startAttack = (now: number, lead: number) => {
    const cells = GRID_PATTERNS[(Math.random() * GRID_PATTERNS.length) | 0].slice(0, POOL);
    attack.current = { active: true, born: now, impact: now + lead, cells, resolved: false };
    useGame.getState().setGrid({ danger: cells });
    sfx.enemyFire();
  };

  // world position of a grid cell, offset `spread` from the path point
  const cellVec = (out: Vector3, cell: number, aheadDist: number, spread: number) => {
    const c = cell % COLS;
    const r = (cell / COLS) | 0;
    out.copy(scratch.pos);
    if (aheadDist) out.addScaledVector(scratch.fwd, aheadDist);
    out.addScaledVector(scratch.right, (c - 1) * spread);
    out.addScaledVector(scratch.up, (1 - r) * spread);
    return out;
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
    S.curve.getPoint(localT, scratch.pos); // -> scratch.pos = path point

    // ---- camera basis (facing the enemy) ----
    scratch.fwd.copy(CAMERA_LOOK_TARGET).sub(scratch.pos).normalize();
    scratch.right.copy(scratch.fwd).cross(worldUp).normalize();
    scratch.up.copy(scratch.right).cross(scratch.fwd).normalize();

    // ---- smooth the camera toward the player's grid cell ----
    const tox = (col.current - 1) * CELL_X;
    const toy = (1 - row.current) * CELL_Y;
    const k = Math.min(1, dt * 12);
    curOx.current += (tox - curOx.current) * k;
    curOy.current += (toy - curOy.current) * k;
    camera.position
      .copy(scratch.pos)
      .addScaledVector(scratch.right, curOx.current)
      .addScaledVector(scratch.up, curOy.current);
    camera.lookAt(CAMERA_LOOK_TARGET);

    // ---- schedule attacks ----
    if (S.pattern && !attack.current.active) {
      fireTimer.current += dt;
      if (fireTimer.current >= PATTERNS[S.pattern].interval) {
        fireTimer.current = 0;
        startAttack(now, PATTERNS[S.pattern].lead * 1000);
      }
    }

    // ---- drive the lit orbs + resolve the strike ----
    const at = attack.current;
    let hitThisFrame = false;
    const p = at.active ? clamp01((now - at.born) / (at.impact - at.born)) : 0;
    const rush = p < 0.62 ? 0 : (p - 0.62) / 0.38;

    for (let i = 0; i < POOL; i++) {
      const orb = orbs.current[i];
      if (!orb) continue;
      if (at.active && i < at.cells.length) {
        const cell = at.cells[i];
        const far = cellVec(scratch.a, cell, FAR_DIST, FAR_SPREAD);
        // near anchor: where a player standing in this cell would be
        const c = cell % COLS;
        const r = (cell / COLS) | 0;
        const near = scratch.b
          .copy(scratch.pos)
          .addScaledVector(scratch.right, (c - 1) * CELL_X)
          .addScaledVector(scratch.up, (1 - r) * CELL_Y);
        orb.position.copy(far).lerp(near, rush * rush);
        orb.visible = true;
        const s = 0.5 + rush * 0.9 + Math.sin(now * 0.02) * 0.05;
        orb.scale.setScalar(s);
      } else {
        orb.visible = false;
      }
    }

    if (at.active && !at.resolved && p >= 1) {
      at.resolved = true;
      at.active = false;
      const playerCell = row.current * COLS + col.current;
      const struck = at.cells.includes(playerCell);
      strikeCount.current += 1;
      useGame.getState().setGrid({ danger: [], strike: strikeCount.current });
      if (struck) {
        hitThisFrame = true;
      } else {
        onAvoid();
      }
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

    // ---- dev telemetry: current danger cells + player cell (for tests) ----
    if (import.meta.env.DEV) {
      (window as unknown as { __arena: { danger: number[]; col: number; row: number } }).__arena = {
        danger: at.active && !at.resolved ? at.cells : [],
        col: col.current,
        row: row.current,
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
        <group key={i} ref={(el) => (orbs.current[i] = el)} visible={false}>
          <mesh>
            <sphereGeometry args={[0.55, 8, 6]} />
            <meshStandardMaterial color="#ff6a4d" emissive="#ff3a2a" emissiveIntensity={2.4} toneMapped={false} flatShading />
          </mesh>
          <mesh scale={1.8}>
            <sphereGeometry args={[0.55, 8, 6]} />
            <meshBasicMaterial color="#ff5566" transparent opacity={0.16} />
          </mesh>
        </group>
      ))}
    </>
  );
}
