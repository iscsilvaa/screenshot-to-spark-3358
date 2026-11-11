import { Suspense, useEffect, useRef } from "react";
import type * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { Clouds, Fireflies, Objects, Ocean, Sparkles, Sun, Terrain } from "./World";
import { useGame } from "./store";
import { Hud } from "./Hud";

/* Camera eases out a little after each expansion so the new land fits. */
function CameraPullback() {
  const expansion = useGame((s) => s.expansion);
  const last = useRef(expansion);
  const target = useRef<number | null>(null);
  useFrame(({ camera }) => {
    if (expansion !== last.current) {
      last.current = expansion;
      target.current = Math.max(18, (camera as THREE.OrthographicCamera).zoom * 0.85);
    }
    if (target.current === null) return;
    const cam = camera as THREE.OrthographicCamera;
    cam.zoom += (target.current - cam.zoom) * 0.03;
    cam.updateProjectionMatrix();
    if (Math.abs(cam.zoom - target.current) < 0.05) target.current = null;
  });
  return null;
}

function ReadySignal() {
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    done.current = true;
    document.getElementById("game-root")?.setAttribute("data-scene-ready", "true");
  });
  return null;
}

export default function Game() {
  useEffect(() => {
    document.body.style.overflow = "hidden";
  }, []);
  return (
    <div id="game-root" className="game-sky fixed inset-0">
      <Canvas
        shadows
        orthographic
        dpr={[1, 1.75]}
        camera={{ position: [22, 20, 22], zoom: 30, near: 0.1, far: 200 }}
      >
        <fog attach="fog" args={["#bfe9f0", 45, 90]} />
        <hemisphereLight args={["#d8f3ff", "#c9b98a", 0.9]} />
        <Sun />
        <Suspense fallback={null}>
          <Environment resolution={64}>
            <Lightformer intensity={1.6} position={[0, 6, 0]} scale={[12, 12, 1]} rotation-x={Math.PI / 2} />
            <Lightformer intensity={0.8} color="#9fe3e0" position={[-6, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 2, 1]} />
          </Environment>
        </Suspense>
        <Terrain />
        <Objects />
        <Ocean />
        <Clouds />
        <Fireflies />
        <Sparkles />
        <CameraPullback />
        <OrbitControls
          enableRotate={false}
          enablePan={false}
          minZoom={18}
          maxZoom={90}
          zoomSpeed={0.8}
          target={[0, 0, 0]}
        />
        <ReadySignal />
      </Canvas>
      <Hud />
    </div>
  );
}
