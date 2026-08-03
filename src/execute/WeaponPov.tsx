import { useMemo, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { NoToneMapping, type Group } from "three";
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

// one keyframe of the swing: a blade PITCH (and small drop) at a moment.
// Pitch only — a single diagonal plane — so there is no roll/yaw spin.
interface Frame {
  t: number;
  pitch: number;
  y: number;
}

const smooth = (u: number) => u * u * (3 - 2 * u);

// blade pitch reference poses (rotation.x): up-ready -> chopped-down
const TOP = -0.75; // raised, ready over the shoulder
const BOTTOM = 0.95; // driven down through the target
const MID = 0.15; // halfway on the return

// Build ONE controlled swing keyed to the beats: hold ready, then on beat 1
// commit at the top, DESCEND through the nodes to a bottom impact, RISE back
// up through the remaining nodes, then recover. Pitch reaches its pose exactly
// ON each node's beat, so the strike is in concert with the key presses.
function buildSwing(nodes: AbilityNode[], targetOf: (b: number) => number): Frame[] {
  const s = [...nodes].sort((a, b) => a.beat - b.beat);
  const n = s.length;
  const b1 = targetOf(s[0].beat);
  const bl = targetOf(s[n - 1].beat);
  const bottomI = n >= 3 ? n - 2 : n - 1; // node that lands the bottom impact
  const frames: Frame[] = [];
  frames.push({ t: b1 - 900, pitch: TOP + 0.25, y: 0 }); // rest, blade held ready
  frames.push({ t: b1 - 120, pitch: TOP, y: 0.1 }); // wind up to the top by beat 1
  s.forEach((node, i) => {
    const t = targetOf(node.beat);
    const pitch =
      i <= bottomI
        ? TOP + ((BOTTOM - TOP) * i) / Math.max(1, bottomI) // descend to bottom
        : BOTTOM + ((MID - BOTTOM) * (i - bottomI)) / (n - 1 - bottomI); // rise back
    const depth = (pitch - TOP) / (BOTTOM - TOP);
    frames.push({ t, pitch, y: -0.32 * depth });
  });
  frames.push({ t: bl + 460, pitch: TOP + 0.15, y: 0 }); // recover up
  frames.push({ t: bl + 1050, pitch: TOP + 0.25, y: 0 }); // settle to ready
  return frames;
}

function AxeRig({ startRef, nodes, leadIn, beatMs }: RigProps) {
  const g = useRef<Group>(null);
  const frames = useMemo(
    () => buildSwing(nodes, (beat: number) => leadIn + (beat - 1) * beatMs),
    [nodes, leadIn, beatMs]
  );

  useFrame(() => {
    if (!g.current) return;
    const t = performance.now() - startRef.current;
    const f = frames;

    // sample the swing (ease-in-out between poses) — clean, planar, no spin
    let pitch: number, y: number;
    if (t <= f[0].t) {
      ({ pitch, y } = f[0]);
    } else if (t >= f[f.length - 1].t) {
      ({ pitch, y } = f[f.length - 1]);
    } else {
      let i = 0;
      while (i < f.length - 1 && f[i + 1].t <= t) i++;
      const p1 = f[i];
      const p2 = f[i + 1];
      const u = smooth((t - p1.t) / (p2.t - p1.t));
      pitch = p1.pitch + (p2.pitch - p1.pitch) * u;
      y = p1.y + (p2.y - p1.y) * u;
    }

    // set directly — the frames own the timing; the pose is locked to the beat
    g.current.rotation.x = pitch;
    g.current.rotation.z = REST.z; // fixed diagonal plane
    g.current.rotation.y = 0;
    g.current.position.y = BASE.y + y;
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
