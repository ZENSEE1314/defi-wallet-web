"use client";
import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const NODE_COUNT = 50;
const RADIUS = 8;
const MAX_LINK_DIST = 3.5;

export function BlockchainBackground() {
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none">
      <div className="absolute inset-0 bg-gradient-to-br from-[#070912] via-[#0c1224] to-[#1a0e2e]" />
      <Canvas camera={{ position: [0, 0, 14], fov: 60 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={1.2} color="#5b8cff" />
        <pointLight position={[-10, -10, 5]} intensity={0.8} color="#7bf0c0" />
        <NodeMesh />
      </Canvas>
      <div className="absolute inset-0 bg-gradient-to-t from-[#070912cc] via-transparent to-transparent" />
    </div>
  );
}

function NodeMesh() {
  const group = useRef<THREE.Group>(null);
  const lineRef = useRef<THREE.LineSegments>(null);

  const { positions, linkPositions } = useMemo(() => {
    const rng = mulberry32(42);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(2 * rng() - 1);
      const r = RADIUS * (0.6 + rng() * 0.4);
      pts.push(new THREE.Vector3(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi)));
    }

    const links: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        if (pts[i].distanceTo(pts[j]) < MAX_LINK_DIST) {
          links.push(pts[i].x, pts[i].y, pts[i].z, pts[j].x, pts[j].y, pts[j].z);
        }
      }
    }
    return { positions: pts, linkPositions: new Float32Array(links) };
  }, []);

  useFrame((_, delta) => {
    if (group.current) {
      group.current.rotation.y += delta * 0.07;
      group.current.rotation.x += delta * 0.02;
    }
    if (lineRef.current && lineRef.current.material instanceof THREE.LineBasicMaterial) {
      lineRef.current.material.opacity = 0.18 + Math.sin(performance.now() * 0.0008) * 0.05;
    }
  });

  return (
    <group ref={group}>
      {positions.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial color="#5b8cff" emissive="#5b8cff" emissiveIntensity={1.4} />
        </mesh>
      ))}
      <lineSegments ref={lineRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[linkPositions, 3]} count={linkPositions.length / 3} />
        </bufferGeometry>
        <lineBasicMaterial color="#7bf0c0" transparent opacity={0.2} />
      </lineSegments>
    </group>
  );
}

// Deterministic random so the mesh is stable across renders.
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
