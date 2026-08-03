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

const REST = { x: -0.15, z: -0.35 };

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
    let roll = 0;
    let yaw = 0;
    let lift = 0;
    if (active) {
      const local = t - targetOf(active.beat);
      const a = anchorFor(active.execKey);
      // horizontal lean toward the strike direction (A left, D right)
      const dirX = (a.x - 0.5) * 2; // -1..1
      const dirY = (a.y - 0.52) * 2; // -1 up .. 1 down
      if (local < -ringLead) {
        pitch = REST.x;
      } else if (local < 0) {
        // WIND UP: raise and pull opposite the strike direction
        const p = easeOut(clamp01((local + ringLead) / ringLead));
        pitch = REST.x - 1.15 * p;
        roll = -dirX * 0.5 * p;
        yaw = -dirX * 0.35 * p;
        lift = 0.25 * p - dirY * 0.15 * p;
      } else if (local < STRIKE_MS) {
        // STRIKE: fast swing through toward the anchor direction. A clean hit
        // drives all the way through; a whiff pulls up short.
        const struck = statusRef.current[active.id] === "hit";
        const reach = struck ? 1 : 0.7;
        const s = easeIn(clamp01(local / STRIKE_MS));
        pitch = -1.15 + REST.x + (1.15 + 0.9 * reach) * s;
        roll = -dirX * 0.5 * (1 - s) + dirX * 0.55 * s;
        yaw = dirX * 0.45 * s;
        lift = (0.25 - 0.7 * reach * s) - dirY * 0.15 * (1 - s);
      } else {
        // FOLLOW THROUGH -> settle back toward rest before the next node
        const p = clamp01((local - STRIKE_MS) / 380);
        pitch = 0.75 * (1 - p) + REST.x * p;
        lift = -0.2 * (1 - p);
      }
    }

    // subtle idle sway
    const sway = Math.sin(t * 0.003) * 0.02;
    const tgtPitch = pitch + sway;
    // smooth toward target so it never snaps
    const k = Math.min(1, dt * 22);
    g.current.rotation.x += (tgtPitch - g.current.rotation.x) * k;
    g.current.rotation.z += (roll - g.current.rotation.z) * k;
    g.current.rotation.y += (yaw - g.current.rotation.y) * k;
    g.current.position.y += (-0.55 + lift - g.current.position.y) * k;
  });

  // procedural low-poly axe, pivot at the grip (held lower-right of the POV)
  return (
    <group ref={g} position={[1.15, -0.55, 2.5]} rotation={[REST.x, 0, 0]} scale={1.1}>
      {/* haft */}
      <mesh position={[0, -0.5, 0]}>
        <boxGeometry args={[0.07, 1.3, 0.07]} />
        <meshStandardMaterial color="#4a3524" flatShading roughness={1} />
      </mesh>
      {/* head mount */}
      <mesh position={[0, 0.18, 0]}>
        <boxGeometry args={[0.16, 0.2, 0.16]} />
        <meshStandardMaterial color="#2a2a34" flatShading />
      </mesh>
      {/* blade */}
      <mesh position={[0.28, 0.2, 0]} rotation={[0, 0, 0.15]}>
        <boxGeometry args={[0.5, 0.42, 0.05]} />
        <meshStandardMaterial color="#c9d0dd" emissive="#8ea0c0" emissiveIntensity={0.35} flatShading metalness={0.2} roughness={0.5} />
      </mesh>
      {/* glowing edge */}
      <mesh position={[0.5, 0.2, 0]}>
        <boxGeometry args={[0.06, 0.44, 0.07]} />
        <meshStandardMaterial color="#eaf2ff" emissive="#cfe6ff" emissiveIntensity={1.4} toneMapped={false} />
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
