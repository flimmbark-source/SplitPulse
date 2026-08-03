import { useMemo, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { NoToneMapping, type Group } from "three";
import { anchorFor } from "./anchors";
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

// one keyframe of the swing: rig pose at a moment in the phrase
interface Frame {
  t: number;
  pitch: number;
  roll: number;
  yaw: number;
  y: number;
}

const catmull = (p0: number, p1: number, p2: number, p3: number, u: number) => {
  const u2 = u * u;
  const u3 = u2 * u;
  return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
};

// build ONE continuous swing across the whole phrase: a slow wind-up before
// beat 1, the blade weaving down to the impact and back up through the node
// beats, then a follow-through. The nodes are timing points ON this motion —
// the axe never resets between them.
function buildSwing(nodes: AbilityNode[], targetOf: (b: number) => number): Frame[] {
  const s = [...nodes].sort((a, b) => a.beat - b.beat);
  const n = s.length;
  const b1 = targetOf(s[0].beat);
  const bl = targetOf(s[n - 1].beat);
  const bottomI = n >= 3 ? n - 2 : n - 1; // deepest point of the combo
  const frames: Frame[] = [];
  frames.push({ t: b1 - 1000, pitch: REST.x, roll: REST.z, yaw: 0, y: 0 });
  // anticipation: heave the axe up and back, reaching the wound pose at beat 1
  frames.push({ t: b1 - 150, pitch: REST.x - 1.35, roll: REST.z + 0.3, yaw: -0.3, y: 0.24 });
  s.forEach((node, i) => {
    const t = targetOf(node.beat);
    const a = anchorFor(node.execKey);
    const dirX = (a.x - 0.5) * 2; // -1 left .. 1 right
    // height: descend to the bottom, then rise on the return stroke
    const h =
      i <= bottomI
        ? 0.12 + (bottomI ? (i / bottomI) * 0.88 : 0.88)
        : 1 - ((i - bottomI) / (n - 1 - bottomI)) * 0.55;
    frames.push({
      t,
      pitch: REST.x - 1.2 + h * 2.4,
      roll: REST.z - dirX * 0.42,
      yaw: dirX * 0.34,
      y: -0.3 * h,
    });
  });
  frames.push({ t: bl + 520, pitch: REST.x + 0.25, roll: REST.z, yaw: 0, y: -0.06 });
  frames.push({ t: bl + 1150, pitch: REST.x, roll: REST.z, yaw: 0, y: 0 });
  return frames;
}

function AxeRig({ startRef, nodes, leadIn, beatMs }: RigProps) {
  const g = useRef<Group>(null);
  const frames = useMemo(
    () => buildSwing(nodes, (beat: number) => leadIn + (beat - 1) * beatMs),
    [nodes, leadIn, beatMs]
  );

  useFrame((_s, dt) => {
    if (!g.current) return;
    const t = performance.now() - startRef.current;
    const f = frames;

    // sample the ONE continuous swing at the current time (Catmull-Rom) —
    // the axe flows through the whole phrase, nodes are moments along it
    let pitch: number, roll: number, yaw: number, y: number;
    if (t <= f[0].t) {
      ({ pitch, roll, yaw, y } = f[0]);
    } else if (t >= f[f.length - 1].t) {
      ({ pitch, roll, yaw, y } = f[f.length - 1]);
    } else {
      let i = 0;
      while (i < f.length - 1 && f[i + 1].t <= t) i++;
      const p1 = f[i];
      const p2 = f[i + 1];
      const p0 = f[i - 1] ?? p1;
      const p3 = f[i + 2] ?? p2;
      const u = (t - p1.t) / (p2.t - p1.t);
      pitch = catmull(p0.pitch, p1.pitch, p2.pitch, p3.pitch, u);
      roll = catmull(p0.roll, p1.roll, p2.roll, p3.roll, u);
      yaw = catmull(p0.yaw, p1.yaw, p2.yaw, p3.yaw, u);
      y = catmull(p0.y, p1.y, p2.y, p3.y, u);
    }

    const sway = Math.sin(t * 0.003) * 0.02;
    // a hair of lag adds weight without desyncing (the frames own the timing)
    const k = Math.min(1, dt * 26);
    g.current.rotation.x += (pitch + sway - g.current.rotation.x) * k;
    g.current.rotation.z += (roll - g.current.rotation.z) * k;
    g.current.rotation.y += (yaw - g.current.rotation.y) * k;
    g.current.position.y += (BASE.y + y - g.current.position.y) * k;
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
