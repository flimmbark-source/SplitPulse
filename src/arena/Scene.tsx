import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";
import { ENEMY_ORIGIN, LANDMARKS } from "./graph";

// low-poly, flat-shaded, PS1 palette (hex — three can't read CSS vars)
const C = {
  ground: "#14131f",
  gridA: "#4a3f68",
  gridB: "#2a2340",
  wall: "#231d33",
  pillar: "#2b2440",
  body: "#3a1b28",
  vent: "#ff9a4d",
  eye: "#fff2a6",
  ring: "#ff5566",
};

function Enemy() {
  const g = useRef<Group>(null);
  const vents = useRef<Group>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (g.current) g.current.position.y = ENEMY_ORIGIN.y + Math.sin(t * 1.4) * 0.12;
    if (vents.current) vents.current.rotation.y = t * 0.8;
  });
  return (
    <group ref={g} position={[ENEMY_ORIGIN.x, ENEMY_ORIGIN.y, ENEMY_ORIGIN.z]}>
      {/* turret body — octahedron */}
      <mesh castShadow>
        <octahedronGeometry args={[1.5, 0]} />
        <meshStandardMaterial color={C.body} emissive={C.ring} emissiveIntensity={0.15} flatShading roughness={0.9} />
      </mesh>
      {/* eye */}
      <mesh position={[0, 0.1, 1.1]}>
        <boxGeometry args={[0.5, 0.28, 0.3]} />
        <meshStandardMaterial color={C.eye} emissive={C.eye} emissiveIntensity={2} toneMapped={false} />
      </mesh>
      {/* three vents — the three shots */}
      <group ref={vents}>
        {[0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 1.6, 0, Math.sin(a) * 1.6]}>
              <sphereGeometry args={[0.28, 6, 5]} />
              <meshStandardMaterial color={C.vent} emissive={C.vent} emissiveIntensity={1.6} toneMapped={false} flatShading />
            </mesh>
          );
        })}
      </group>
      {/* stem + base */}
      <mesh position={[0, -1.9, 0]}>
        <cylinderGeometry args={[0.3, 0.7, 2.6, 6]} />
        <meshStandardMaterial color={C.body} flatShading roughness={1} />
      </mesh>
    </group>
  );
}

function Pillar({ pos, h }: { pos: [number, number, number]; h: number }) {
  const m = useRef<Mesh>(null);
  return (
    <mesh ref={m} position={[pos[0], h / 2, pos[2]]} rotation={[0, pos[0] * 0.3, 0.03]}>
      <boxGeometry args={[1.6, h, 1.6]} />
      <meshStandardMaterial color={C.pillar} flatShading roughness={1} />
    </mesh>
  );
}

export default function Scene() {
  return (
    <>
      <ambientLight intensity={1.1} color="#6a5a92" />
      <hemisphereLight args={["#6a5a9a", "#141020", 1.1]} />
      {/* the enemy's ember key light */}
      <pointLight position={[0, 4, 0]} intensity={90} color="#ff7a4d" distance={30} decay={2} />
      {/* cool fill from the far side so the arena reads */}
      <pointLight position={[-8, 7, -6]} intensity={70} color="#6aa0ff" distance={34} decay={2} />
      <directionalLight position={[6, 12, -4]} intensity={1.2} color="#b8a8ff" />

      {/* ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color={C.ground} roughness={1} />
      </mesh>
      <gridHelper args={[80, 40, C.gridA, C.gridB]} position={[0, 0.02, 0]} />

      {/* arena boundary ring — a low open cylinder */}
      <mesh position={[0, 3, 0]}>
        <cylinderGeometry args={[20, 20, 6, 24, 1, true]} />
        <meshStandardMaterial color={C.wall} side={2} flatShading roughness={1} />
      </mesh>

      {LANDMARKS.map((l, i) => (
        <Pillar key={i} pos={l.pos} h={l.h} />
      ))}

      <Enemy />
    </>
  );
}
