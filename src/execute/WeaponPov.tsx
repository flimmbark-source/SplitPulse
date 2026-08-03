import { useMemo, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { NoToneMapping, type Group } from "three";
import { anchorFor, clamp01, easeIn, easeOut, STRIKE_MS } from "./anchors";
import type { AbilityNode } from "../types";

type Status = "pending" | "hit" | "miss";

interface RigProps {
  startRef: MutableRefObject<number>;
  nodes: AbilityNode[];
  statusRef: MutableRefObject<Record<string, Status>>;
  leadIn: number;
  beatMs: number;
  ringLead: number;
}

// held-viewmodel framing: grip below the view, blade up in frame
const BASE = { x: 0.28, y: -1.05, z: 2.62 };
const REST = { x: -0.12, z: 0.3 };

function AxeRig({ startRef, nodes, statusRef, leadIn, beatMs, ringLead }: RigProps) {
  const g = useRef<Group>(null);
  const targetOf = (beat: number) => leadIn + (beat - 1) * beatMs;

  useFrame((_s, dt) => {
    if (!g.current) return;
    const t = performance.now() - startRef.current;

    // the node the axe is currently addressing = nearest by time
    let active: AbilityNode | null = null;
    let best = Infinity;
    for (const n of nodes) {
      const d = Math.abs(t - targetOf(n.beat));
      if (d < best) {
        best = d;
        active = n;
      }
    }

    let pitch = REST.x;
    let roll = REST.z;
    let yaw = 0;
    let lift = 0;
    if (active) {
      const local = t - targetOf(active.beat);
      const a = anchorFor(active.execKey);
      const dirX = (a.x - 0.5) * 2; // -1 left .. 1 right
      if (local < -ringLead) {
        // rest
      } else if (local < 0) {
        // WIND UP: raise the blade up and back
        const p = easeOut(clamp01((local + ringLead) / ringLead));
        pitch = REST.x - 1.0 * p;
        roll = REST.z + dirX * 0.25 * p;
        yaw = -dirX * 0.25 * p;
        lift = 0.18 * p;
      } else if (local < STRIKE_MS) {
        // STRIKE: sweep DOWN across the view. A clean hit drives through; a
        // whiff pulls up short.
        const struck = statusRef.current[active.id] === "hit";
        const reach = struck ? 1 : 0.72;
        const s = easeIn(clamp01(local / STRIKE_MS));
        pitch = REST.x - 1.0 + (1.0 + 1.15 * reach) * s;
        roll = REST.z - dirX * 0.35 * s;
        yaw = dirX * 0.3 * s;
        lift = 0.18 - 0.42 * s;
      } else {
        // FOLLOW THROUGH -> recover back UP to rest before the next node
        const p = easeOut(clamp01((local - STRIKE_MS) / 400));
        pitch = (REST.x + 1.15) * (1 - p) + REST.x * p;
        roll = REST.z;
        lift = -0.24 * (1 - p);
      }
    }

    // subtle idle sway
    const sway = Math.sin(t * 0.003) * 0.02;
    const k = Math.min(1, dt * 20);
    g.current.rotation.x += (pitch + sway - g.current.rotation.x) * k;
    g.current.rotation.z += (roll - g.current.rotation.z) * k;
    g.current.rotation.y += (yaw - g.current.rotation.y) * k;
    g.current.position.y += (BASE.y + lift - g.current.position.y) * k;
  });

  // procedural low-poly axe — pivot at the grip; haft rises up into frame,
  // head at the top so a pitch-swing chops down across the POV.
  return (
    <group ref={g} position={[BASE.x, BASE.y, BASE.z]} rotation={[REST.x, 0, REST.z]} scale={1.25}>
      {/* haft */}
      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[0.13, 1.9, 0.13]} />
        <meshStandardMaterial color="#513a26" flatShading roughness={1} />
      </mesh>
      {/* grip wrap */}
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[0.18, 0.55, 0.18]} />
        <meshStandardMaterial color="#241a12" flatShading roughness={1} />
      </mesh>
      {/* head socket */}
      <mesh position={[0, 1.78, 0]}>
        <boxGeometry args={[0.26, 0.3, 0.26]} />
        <meshStandardMaterial color="#2a2a34" flatShading />
      </mesh>
      {/* blade — kept a touch self-lit so it stays readable mid-swing */}
      <mesh position={[0.5, 1.74, 0]} rotation={[0, 0, 0.12]}>
        <boxGeometry args={[0.92, 0.66, 0.07]} />
        <meshStandardMaterial color="#cdd4e2" emissive="#aeb9cf" emissiveIntensity={0.75} flatShading metalness={0.3} roughness={0.5} />
      </mesh>
      {/* glowing cutting edge */}
      <mesh position={[0.98, 1.74, 0]}>
        <boxGeometry args={[0.09, 0.72, 0.1]} />
        <meshStandardMaterial color="#eaf2ff" emissive="#cfe6ff" emissiveIntensity={2.2} toneMapped={false} />
      </mesh>
      {/* top spike */}
      <mesh position={[0, 2.08, 0]}>
        <boxGeometry args={[0.09, 0.34, 0.09]} />
        <meshStandardMaterial color="#3a3a46" flatShading />
      </mesh>
    </group>
  );
}

function Backdrop() {
  const enemy = useRef<Group>(null);
  useFrame((s) => {
    if (enemy.current) enemy.current.position.y = 0.1 + Math.sin(s.clock.elapsedTime * 1.4) * 0.06;
  });
  return (
    <>
      <ambientLight intensity={1.0} color="#6a5a92" />
      <hemisphereLight args={["#6a5a9a", "#141020", 0.9]} />
      <pointLight position={[0, 3, 2]} intensity={26} color="#ff8a5a" distance={20} decay={2} />
      <pointLight position={[-3, 2, 3]} intensity={16} color="#6aa0ff" distance={20} decay={2} />

      {/* ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.4, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#14131f" roughness={1} />
      </mesh>
      <gridHelper args={[40, 30, "#4a3f68", "#2a2340"]} position={[0, -1.39, 0]} />

      {/* the enemy you are striking */}
      <group ref={enemy} position={[-0.3, 0.3, -4]}>
        <mesh>
          <octahedronGeometry args={[0.9, 0]} />
          <meshStandardMaterial color="#3a1b28" emissive="#ff5566" emissiveIntensity={0.2} flatShading roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.05, 0.7]}>
          <boxGeometry args={[0.3, 0.16, 0.18]} />
          <meshStandardMaterial color="#fff2a6" emissive="#fff2a6" emissiveIntensity={2} toneMapped={false} />
        </mesh>
      </group>
    </>
  );
}

export default function WeaponPov(props: RigProps) {
  const camera = useMemo(() => ({ position: [0, 0.15, 3.4] as [number, number, number], fov: 55, near: 0.1, far: 40 }), []);
  return (
    <Canvas
      className="ps1-canvas"
      dpr={0.5}
      gl={{ antialias: false, toneMapping: NoToneMapping }}
      camera={camera}
      style={{ position: "absolute", inset: 0 }}
    >
      <color attach="background" args={["#0b0714"]} />
      <fog attach="fog" args={["#0b0714", 4, 16]} />
      <Backdrop />
      <AxeRig {...props} />
    </Canvas>
  );
}
