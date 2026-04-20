"use client";
import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const NODE_COUNT = 60;
const RADIUS = 5.5;
const MAX_LINK_DIST = 3.0;
const SPHERE_RADIUS = 0.22;

export function BlockchainBackground() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0d1a] via-[#0e1530] to-[#1f1240]" />
      <div className="absolute inset-0">
        <Canvas
          camera={{ position: [0, 0, 11], fov: 55 }}
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
          style={{ width: "100%", height: "100%" }}
        >
          {/* TEMP: giant test cube — if you can see hot pink, R3F is rendering. */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[3, 3, 3]} />
            <meshBasicMaterial color="#ff00ff" toneMapped={false} />
          </mesh>
          <ambientLight intensity={0.6} />
          <pointLight position={[10, 10, 10]} intensity={2.0} color="#5b8cff" />
          <NodeMesh />
        </Canvas>
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0d1a99] via-transparent to-[#0a0d1a55]" />
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
      {positions.map((p, i) => {
        const palette = ["#7da8ff", "#7bf0c0", "#c89dff", "#ff9ec6"];
        const color = palette[i % palette.length];
        return (
          <mesh key={i} position={p}>
            <sphereGeometry args={[SPHERE_RADIUS, 16, 16]} />
            {/* Basic material ignores lights — guarantees the spheres render at full brightness. */}
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
        );
      })}
      <lineSegments ref={lineRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[linkPositions, 3]} count={linkPositions.length / 3} />
        </bufferGeometry>
        <lineBasicMaterial color="#7bf0c0" transparent opacity={0.55} toneMapped={false} />
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
