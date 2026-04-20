"use client";
import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

// JARVIS / Ironman HUD palette
const CYAN = "#5ad6ff";
const AMBER = "#ffb86b";
const HOT = "#ff6b9a";
const GRID = "#3a8fff";

export function BlockchainBackground() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(circle at 50% 50%, #0d1530 0%, #060914 60%, #02030a 100%)" }}
      />
      <div className="absolute inset-0">
        <Canvas
          camera={{ position: [0, 0, 12], fov: 55 }}
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: true }}
          style={{ width: "100%", height: "100%" }}
        >
          <Reactor />
          <HexFloor />
          <Particles />
        </Canvas>
      </div>
      {/* Vignette + faint scanlines for the HUD vibe */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 30%, rgba(2,3,10,0.5) 75%, rgba(2,3,10,0.85) 100%)"
        }}
      />
      <div
        className="absolute inset-0 mix-blend-overlay opacity-15"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(90,214,255,0.4) 0px, rgba(90,214,255,0.4) 1px, transparent 1px, transparent 3px)"
        }}
      />
    </div>
  );
}

function Reactor() {
  // Three concentric rotating wireframes — the core "arc reactor" feel.
  const inner = useRef<THREE.Group>(null);
  const middle = useRef<THREE.Group>(null);
  const outer = useRef<THREE.Group>(null);
  const torus = useRef<THREE.Mesh>(null);

  useFrame((_, dt) => {
    if (inner.current) {
      inner.current.rotation.x += dt * 0.25;
      inner.current.rotation.y += dt * 0.35;
    }
    if (middle.current) {
      middle.current.rotation.x -= dt * 0.18;
      middle.current.rotation.y += dt * 0.22;
    }
    if (outer.current) {
      outer.current.rotation.y += dt * 0.12;
      outer.current.rotation.z += dt * 0.05;
    }
    if (torus.current) {
      torus.current.rotation.x = Math.PI / 2;
      torus.current.rotation.z += dt * 0.4;
    }
  });

  return (
    <group>
      {/* Outer wireframe icosahedron */}
      <group ref={outer}>
        <Wireframe geom={new THREE.IcosahedronGeometry(4.2, 1)} color={CYAN} opacity={0.55} />
      </group>
      {/* Middle wireframe octahedron */}
      <group ref={middle}>
        <Wireframe geom={new THREE.OctahedronGeometry(2.6, 0)} color={GRID} opacity={0.45} />
      </group>
      {/* Inner solid + emissive core */}
      <group ref={inner}>
        <mesh>
          <icosahedronGeometry args={[1.0, 0]} />
          <meshBasicMaterial color={AMBER} wireframe toneMapped={false} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.4, 24, 24]} />
          <meshBasicMaterial color={CYAN} toneMapped={false} />
        </mesh>
      </group>
      {/* Torus ring around equator */}
      <mesh ref={torus}>
        <torusGeometry args={[5.2, 0.04, 8, 96]} />
        <meshBasicMaterial color={CYAN} toneMapped={false} transparent opacity={0.7} />
      </mesh>
      {/* Second torus, tilted */}
      <mesh rotation={[Math.PI / 4, 0, 0]}>
        <torusGeometry args={[6.2, 0.025, 6, 96]} />
        <meshBasicMaterial color={HOT} toneMapped={false} transparent opacity={0.45} />
      </mesh>
    </group>
  );
}

// Renders a geometry as cyan wireframe edges only (cheaper than wireframe material on a mesh).
function Wireframe({ geom, color, opacity }: { geom: THREE.BufferGeometry; color: string; opacity: number }) {
  const lineGeom = useMemo(() => new THREE.EdgesGeometry(geom), [geom]);
  return (
    <lineSegments geometry={lineGeom}>
      <lineBasicMaterial color={color} transparent opacity={opacity} toneMapped={false} />
    </lineSegments>
  );
}

// Receding hexagonal grid floor for depth (Tron / HUD vibe).
function HexFloor() {
  const ref = useRef<THREE.LineSegments>(null);
  const geom = useMemo(() => {
    const lines: number[] = [];
    const size = 30;
    const step = 1.4;
    for (let z = -size; z <= size; z += step) {
      lines.push(-size, -3, z, size, -3, z);
    }
    for (let x = -size; x <= size; x += step) {
      lines.push(x, -3, -size, x, -3, size);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(lines), 3));
    return g;
  }, []);

  useFrame((_, dt) => {
    if (ref.current) {
      // Scroll the grid forward to suggest forward motion through space.
      ref.current.position.z = (ref.current.position.z + dt * 0.6) % 1.4;
    }
  });

  return (
    <group rotation={[-Math.PI / 12, 0, 0]} position={[0, -2, -2]}>
      <lineSegments ref={ref} geometry={geom}>
        <lineBasicMaterial color={GRID} transparent opacity={0.18} toneMapped={false} />
      </lineSegments>
    </group>
  );
}

// Drifting particle field — adds depth + life without heavy postprocessing.
function Particles() {
  const ref = useRef<THREE.Points>(null);
  const { geom, count } = useMemo(() => {
    const N = 220;
    const arr = new Float32Array(N * 3);
    const rng = mulberry32(7);
    for (let i = 0; i < N; i++) {
      arr[i * 3 + 0] = (rng() - 0.5) * 30;
      arr[i * 3 + 1] = (rng() - 0.5) * 20;
      arr[i * 3 + 2] = (rng() - 0.5) * 30;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    return { geom: g, count: N };
  }, []);

  useFrame((_, dt) => {
    if (ref.current) {
      ref.current.rotation.y += dt * 0.02;
    }
  });

  return (
    <points ref={ref} geometry={geom}>
      <pointsMaterial color={CYAN} size={0.06} transparent opacity={0.7} sizeAttenuation toneMapped={false} />
    </points>
  );
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
