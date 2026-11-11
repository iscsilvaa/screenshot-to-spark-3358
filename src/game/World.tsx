import { useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { baseHeight, heightAt as rawHeightAt, MOUNTAIN, SAND_LEVEL, type Lake } from "./terrain";
import { placeAt, removeObject, useGame, validate, type WorldObject } from "./store";

/** Displayed (animated) expansion value; eases toward the store's value. */
export const view = { e: -1 };
const heightAt = (x: number, z: number, lakes: Lake[]) => rawHeightAt(x, z, lakes, Math.max(0, view.e));

const C = {
  deepSand: new THREE.Color("#d9b77e"),
  sand: new THREE.Color("#f0d9a0"),
  grass: new THREE.Color("#7cbf4f"),
  grassDark: new THREE.Color("#5a9a3c"),
  hill: new THREE.Color("#8a9a5b"),
  rock: new THREE.Color("#9a9389"),
};

/* ---------------- Terrain ---------------- */
export function Terrain() {
  const lakes = useGame((s) => s.lakes);
  const tool = useGame((s) => s.tool);
  const [hover, setHover] = useState<{ x: number; z: number; ok: boolean } | null>(null);

  const expansion = useGame((s) => s.expansion);
  if (view.e < 0) view.e = expansion;
  const geo = useMemo(() => new THREE.PlaneGeometry(56, 56, 96, 96).rotateX(-Math.PI / 2).toNonIndexed(), []);
  const paint = () => {
    const g = geo;
    const p = g.attributes["position"] as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setY(i, heightAt(p.getX(i), p.getZ(i), lakes));
    p.needsUpdate = true;
    const colors = new Float32Array(p.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i += 3) {
      const h = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
      const n = Math.sin(p.getX(i) * 3.1 + p.getZ(i) * 1.7) * 0.5 + 0.5;
      if (h < 0) c.copy(C.deepSand);
      else if (h < SAND_LEVEL) c.copy(C.sand);
      else if (h < 1.6) c.copy(C.grass).lerp(C.grassDark, n * 0.5);
      else if (h < 2.4) c.copy(C.grassDark).lerp(C.hill, (h - 1.6) / 0.8);
      else c.copy(C.hill).lerp(C.rock, Math.min(1, h - 2.4));
      for (let k = 0; k < 3; k++) colors.set([c.r, c.g, c.b], (i + k) * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
  };
  useMemo(paint, [lakes, geo]);
  useFrame((_, dt) => {
    if (Math.abs(view.e - expansion) < 0.001) return;
    view.e = Math.min(expansion, view.e + Math.min(dt, 0.05) * 0.4);
    if (view.e > expansion) view.e = expansion;
    paint();
  });

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (!tool || tool === "remove") return hover && setHover(null);
    const x = Math.round(e.point.x * 2) / 2, z = Math.round(e.point.z * 2) / 2;
    setHover({ x, z, ok: !validate(tool, x, z) });
  };

  return (
    <group>
      <mesh
        geometry={geo}
        receiveShadow
        onPointerMove={onMove}
        onPointerOut={() => setHover(null)}
        onClick={(e) => {
          if (e.delta > 6) return;
          e.stopPropagation();
          placeAt(e.point.x, e.point.z);
        }}
      >
        <meshStandardMaterial vertexColors flatShading roughness={0.95} />
      </mesh>
      {lakes.map((l) => (
        <LakeWater key={l.id} lake={l} />
      ))}
      {expansion >= MOUNTAIN.stage && <Waterfall lakes={lakes} />}
      {hover && tool && tool !== "remove" && (
        <mesh position={[hover.x, heightAt(hover.x, hover.z, lakes) + 0.06, hover.z]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[tool === "lake" ? 1.4 : 0.35, tool === "lake" ? 1.6 : 0.5, 24]} />
          <meshBasicMaterial color={hover.ok ? "#ffffff" : "#ff5a4f"} transparent opacity={0.85} />
        </mesh>
      )}
    </group>
  );
}

function LakeWater({ lake }: { lake: Lake }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = lake.level + Math.sin(clock.elapsedTime * 1.3 + lake.x) * 0.02;
  });
  return (
    <mesh ref={ref} position={[lake.x, lake.level, lake.z]} rotation-x={-Math.PI / 2}>
      <circleGeometry args={[lake.r + 0.6, 10]} />
      <meshStandardMaterial color="#3fb8c9" transparent opacity={0.85} roughness={0.15} metalness={0.1} flatShading />
    </mesh>
  );
}

/* Waterfall: a flowing strip from near the peak down toward the mountain lake. */
function Waterfall({ lakes }: { lakes: Lake[] }) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 32; c.height = 128;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#7fd6e6"; ctx.fillRect(0, 0, 32, 128);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.5})`;
      ctx.fillRect(Math.random() * 32, Math.random() * 128, 2 + Math.random() * 3, 8 + Math.random() * 18);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }, []);
  useFrame((_, dt) => { tex.offset.y += Math.min(dt, 0.05) * 1.2; });
  const lake = lakes.find((l) => Math.hypot(l.x - MOUNTAIN.x, l.z - MOUNTAIN.z) < 7);
  const tx = lake ? lake.x : MOUNTAIN.x + 3, tz = lake ? lake.z : MOUNTAIN.z + 3;
  const dx = tx - MOUNTAIN.x, dz = tz - MOUNTAIN.z, len = Math.hypot(dx, dz);
  const sx = MOUNTAIN.x + (dx / len) * 1.2, sz = MOUNTAIN.z + (dz / len) * 1.2;
  const top = heightAt(sx, sz, lakes) + 0.1, bottom = lake ? lake.level : heightAt(tx, tz, lakes);
  const mx = (sx + tx) / 2, mz = (sz + tz) / 2, run = Math.hypot(tx - sx, tz - sz);
  const drop = top - bottom, length = Math.hypot(run, drop);
  return (
    <group position={[mx, (top + bottom) / 2 + 0.15, mz]} rotation={[0, Math.atan2(dx, dz), 0]}>
      <group rotation-x={-Math.PI / 2 + Math.atan2(drop, run)}>
        <mesh>
          <planeGeometry args={[0.7, length]} />
          <meshStandardMaterial map={tex} transparent opacity={0.9} side={THREE.DoubleSide} roughness={0.2} />
        </mesh>
      </group>
    </group>
  );
}

/* Sparkle burst shown while an expansion is being celebrated. */
export function Sparkles() {
  const active = useGame((s) => s.celebration !== null);
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const arr = new Float32Array(200 * 3);
    for (let i = 0; i < 200; i++) {
      const a = Math.random() * Math.PI * 2, r = 10 + Math.random() * 10;
      arr.set([Math.cos(a) * r, Math.random() * 3, Math.sin(a) * r], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    return g;
  }, []);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.y = (clock.elapsedTime % 3) * 0.8;
    (ref.current.material as THREE.PointsMaterial).opacity = 0.9 - (clock.elapsedTime % 3) * 0.3;
  });
  if (!active) return null;
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial color="#fff3a8" size={0.18} transparent opacity={0.9} />
    </points>
  );
}

/* ---------------- Ocean ---------------- */
export function Ocean() {
  const ref = useRef<THREE.Mesh>(null);
  const { geo, base, shore } = useMemo(() => {
    const g = new THREE.PlaneGeometry(110, 110, 100, 100).rotateX(-Math.PI / 2);
    const p = g.attributes["position"] as THREE.BufferAttribute;
    const shore = new Float32Array(p.count);
    const colors = new Float32Array(p.count * 3);
    const deep = new THREE.Color("#1b8fb5"), shallow = new THREE.Color("#4fd8d0"), foam = new THREE.Color("#e9fbf6");
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const h = baseHeight(p.getX(i), p.getZ(i), 3);
      const s = Math.max(0, Math.min(1, (h + 1.8) / 1.8));
      shore[i] = s;
      c.copy(deep).lerp(shallow, Math.pow(s, 0.6));
      if (s > 0.85) c.lerp(foam, (s - 0.85) / 0.15);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return { geo: g, base: Float32Array.from(p.array as Float32Array), shore };
  }, []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const p = geo.attributes["position"] as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = base[i * 3]!, z = base[i * 3 + 2]!;
      const r = Math.hypot(x, z);
      p.setY(i, Math.sin(x * 0.35 + t * 0.9) * 0.08 + Math.cos(z * 0.3 + t * 0.7) * 0.08 + Math.sin(r * 1.4 - t * 2.2) * 0.07 * shore[i]!);
    }
    p.needsUpdate = true;
  });

  return (
    <group>
      <mesh ref={ref} geometry={geo} position-y={-0.05} receiveShadow>
        <meshStandardMaterial vertexColors flatShading transparent opacity={0.88} roughness={0.25} metalness={0.05} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.12}>
        <planeGeometry args={[600, 600]} />
        <meshStandardMaterial color="#1b8fb5" roughness={0.3} />
      </mesh>
    </group>
  );
}

/* ---------------- Objects ---------------- */
export function Objects() {
  const objects = useGame((s) => s.objects);
  const lakes = useGame((s) => s.lakes);
  const tool = useGame((s) => s.tool);
  return (
    <>
      {objects.map((o) => (
        <Placed key={o.id} o={o} y={heightAt(o.x, o.z, lakes)} removable={tool === "remove"} />
      ))}
    </>
  );
}

function Placed({ o, y, removable }: { o: WorldObject; y: number; removable: boolean }) {
  const [hot, setHot] = useState(false);
  const grow = useRef(0);
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!g.current || grow.current >= 1) return;
    grow.current = Math.min(1, grow.current + Math.min(dt, 0.05) * 3);
    const s = 1 - Math.pow(1 - grow.current, 3) + Math.sin(grow.current * Math.PI) * 0.15;
    g.current.scale.setScalar(s * o.scale);
  });
  const handlers = removable
    ? {
        onPointerOver: (e: ThreeEvent<PointerEvent>) => (e.stopPropagation(), setHot(true)),
        onPointerOut: () => setHot(false),
        onClick: (e: ThreeEvent<MouseEvent>) => (e.stopPropagation(), removeObject(o.id)),
      }
    : {};
  const body =
    o.kind === "tree" ? <Tree o={o} /> : o.kind === "palm" ? <Palm o={o} /> : o.kind === "rock" ? <Rock o={o} /> : o.kind === "house" ? <House o={o} /> : null;
  if (o.kind === "animal") return <Animal o={o} removable={removable} />;
  return (
    <group ref={g} position={[o.x, y, o.z]} rotation-y={o.rot} scale={0} {...handlers}>
      {body}
      {hot && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.05}>
          <ringGeometry args={[0.6, 0.75, 20]} />
          <meshBasicMaterial color="#ff5a4f" />
        </mesh>
      )}
    </group>
  );
}

function useSway(seed: number, amt = 0.04) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime + seed;
    ref.current.rotation.z = Math.sin(t * 1.1) * amt;
    ref.current.rotation.x = Math.cos(t * 0.8) * amt * 0.6;
  });
  return ref;
}

const LEAF = ["#4f9d3a", "#3f8a3a", "#6aae3f"];
function Tree({ o }: { o: WorldObject }) {
  const sway = useSway(o.x + o.z, 0.03);
  return (
    <group ref={sway}>
      <mesh position-y={0.35} castShadow>
        <cylinderGeometry args={[0.08, 0.12, 0.7, 5]} />
        <meshStandardMaterial color="#7a5233" flatShading />
      </mesh>
      <mesh position-y={1.0} castShadow>
        <coneGeometry args={[0.55, 0.9, 6]} />
        <meshStandardMaterial color={LEAF[o.variant]!} flatShading />
      </mesh>
      <mesh position-y={1.45} castShadow>
        <coneGeometry args={[0.4, 0.7, 6]} />
        <meshStandardMaterial color={LEAF[(o.variant + 1) % 3]!} flatShading />
      </mesh>
    </group>
  );
}

function Palm({ o }: { o: WorldObject }) {
  const sway = useSway(o.x * 2 + o.z, 0.06);
  const fronds = useMemo(() => Array.from({ length: 6 }, (_, i) => (i / 6) * Math.PI * 2), []);
  return (
    <group ref={sway}>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[i * 0.04, 0.2 + i * 0.38, 0]} rotation-z={-0.08 * i} castShadow>
          <cylinderGeometry args={[0.07 - i * 0.008, 0.09 - i * 0.008, 0.4, 5]} />
          <meshStandardMaterial color={i % 2 ? "#a07a4a" : "#8a6539"} flatShading />
        </mesh>
      ))}
      <group position={[0.16, 1.6, 0]}>
        {fronds.map((a, i) => (
          <mesh key={i} rotation={[0, a, 0.9]} position={[Math.cos(a) * 0.3, -0.05, -Math.sin(a) * 0.3]} castShadow>
            <coneGeometry args={[0.16, 0.9, 3]} />
            <meshStandardMaterial color={i % 2 ? "#4caa45" : "#3b9440"} flatShading />
          </mesh>
        ))}
        <mesh position-y={-0.1}>
          <icosahedronGeometry args={[0.1, 0]} />
          <meshStandardMaterial color="#6b4a2a" flatShading />
        </mesh>
      </group>
    </group>
  );
}

function Rock({ o }: { o: WorldObject }) {
  return (
    <group>
      <mesh position-y={0.15} scale={[0.5, 0.35, 0.45]} castShadow receiveShadow>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={["#9a9389", "#8b857d", "#a8a196"][o.variant]!} flatShading roughness={1} />
      </mesh>
      <mesh position={[0.35, 0.08, 0.2]} scale={0.22} castShadow>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#7f7972" flatShading />
      </mesh>
    </group>
  );
}

const WALL = ["#f4ead6", "#f2d7b6", "#e9e1cf"];
const ROOF = ["#c8553d", "#3d7ea6", "#d18b3a"];
function House({ o }: { o: WorldObject }) {
  return (
    <group>
      <mesh position-y={0.04}>
        <boxGeometry args={[1.3, 0.08, 1.1]} />
        <meshStandardMaterial color="#b8a58a" flatShading />
      </mesh>
      <mesh position-y={0.42} castShadow receiveShadow>
        <boxGeometry args={[1, 0.7, 0.85]} />
        <meshStandardMaterial color={WALL[o.variant]!} flatShading />
      </mesh>
      <mesh position-y={1.0} rotation-y={Math.PI / 4} scale={[1, 1, 1]} castShadow>
        <coneGeometry args={[0.85, 0.55, 4]} />
        <meshStandardMaterial color={ROOF[o.variant]!} flatShading />
      </mesh>
      <mesh position={[0, 0.27, 0.43]}>
        <boxGeometry args={[0.22, 0.38, 0.02]} />
        <meshStandardMaterial color="#6b4a2a" />
      </mesh>
      <mesh position={[0.3, 0.5, 0.43]}>
        <boxGeometry args={[0.18, 0.16, 0.02]} />
        <meshStandardMaterial color="#ffe6a3" emissive="#ffcc66" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0.28, 1.05, -0.15]} castShadow>
        <boxGeometry args={[0.12, 0.3, 0.12]} />
        <meshStandardMaterial color="#8b857d" flatShading />
      </mesh>
    </group>
  );
}

/* Animals wander on land; state lives in refs, not React. */
function Animal({ o, removable }: { o: WorldObject; removable: boolean }) {
  const g = useRef<THREE.Group>(null);
  const sim = useRef({ x: o.x, z: o.z, heading: o.rot, wait: 0, hop: 0 });
  const lakes = useGame((s) => s.lakes);
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const s = sim.current;
    if (s.wait > 0) s.wait -= dt;
    else {
      const nx = s.x + Math.sin(s.heading) * dt * 0.6, nz = s.z + Math.cos(s.heading) * dt * 0.6;
      const h = heightAt(nx, nz, lakes);
      if (h < SAND_LEVEL + 0.1 || lakes.some((l) => Math.hypot(nx - l.x, nz - l.z) < l.r + 0.3)) s.heading += Math.PI * (0.6 + Math.random() * 0.6);
      else (s.x = nx), (s.z = nz);
      s.hop += dt * 10;
      if (Math.random() < 0.005) s.wait = 1 + Math.random() * 2;
      if (Math.random() < 0.01) s.heading += (Math.random() - 0.5) * 2;
    }
    if (g.current) {
      g.current.position.set(s.x, heightAt(s.x, s.z, lakes) + (s.wait > 0 ? 0 : Math.abs(Math.sin(s.hop)) * 0.06), s.z);
      g.current.rotation.y += (s.heading - g.current.rotation.y) * 0.1;
    }
  });
  const sheep = o.variant % 2 === 0;
  return (
    <group
      ref={g}
      onClick={(e) => { if (!removable) return; e.stopPropagation(); removeObject(o.id); }}
    >
      {sheep ? (
        <>
          <mesh position-y={0.28} castShadow>
            <icosahedronGeometry args={[0.24, 0]} />
            <meshStandardMaterial color="#f6f3ea" flatShading />
          </mesh>
          <mesh position={[0, 0.32, 0.24]} castShadow>
            <boxGeometry args={[0.14, 0.14, 0.16]} />
            <meshStandardMaterial color="#3a332d" flatShading />
          </mesh>
          {([[-0.1, -0.1], [0.1, -0.1], [-0.1, 0.1], [0.1, 0.1]] as [number, number][]).map(([x, z], i) => (
            <mesh key={i} position={[x, 0.07, z]}>
              <boxGeometry args={[0.05, 0.14, 0.05]} />
              <meshStandardMaterial color="#3a332d" />
            </mesh>
          ))}
        </>
      ) : (
        <>
          <mesh position-y={0.2} castShadow>
            <boxGeometry args={[0.2, 0.2, 0.26]} />
            <meshStandardMaterial color="#ffffff" flatShading />
          </mesh>
          <mesh position={[0, 0.36, 0.1]} castShadow>
            <boxGeometry args={[0.13, 0.15, 0.13]} />
            <meshStandardMaterial color="#ffffff" flatShading />
          </mesh>
          <mesh position={[0, 0.46, 0.1]}>
            <boxGeometry args={[0.04, 0.06, 0.08]} />
            <meshStandardMaterial color="#e2392f" />
          </mesh>
          <mesh position={[0, 0.35, 0.19]}>
            <coneGeometry args={[0.035, 0.08, 4]} />
            <meshStandardMaterial color="#f2a33a" />
          </mesh>
          <mesh position-y={0.05}>
            <boxGeometry args={[0.1, 0.1, 0.03]} />
            <meshStandardMaterial color="#f2a33a" />
          </mesh>
        </>
      )}
    </group>
  );
}

/* ---------------- Ambient ---------------- */
export function Clouds() {
  const ref = useRef<THREE.Group>(null);
  const clouds = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => ({
        x: -40 + i * 12,
        z: -18 + ((i * 37) % 30),
        y: 13 + (i % 3) * 1.5,
        s: 0.5 + (i % 4) * 0.15,
        speed: 0.5 + (i % 3) * 0.25,
      })),
    [],
  );
  useFrame((_, delta) => {
    ref.current?.children.forEach((c, i) => {
      c.position.x += clouds[i]!.speed * Math.min(delta, 0.05);
      if (c.position.x > 45) c.position.x = -45;
    });
  });
  return (
    <group ref={ref}>
      {clouds.map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]} scale={c.s}>
          {([[0, 0, 0, 1.2], [1.2, -0.2, 0.2, 0.9], [-1.1, -0.25, -0.1, 0.85], [0.4, 0.5, 0, 0.8]] as [number, number, number, number][]).map(([x, y, z, r], k) => (
            <mesh key={k} position={[x, y, z]} castShadow>
              <icosahedronGeometry args={[r, 0]} />
              <meshStandardMaterial color="#ffffff" flatShading transparent opacity={0.75} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/* Sun drifts slowly across the sky for dynamic lighting. */
export function Sun() {
  const light = useRef<THREE.DirectionalLight>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.04;
    if (!light.current) return;
    light.current.position.set(Math.cos(t) * 20, 18 + Math.sin(t * 2) * 3, Math.sin(t) * 20);
    light.current.intensity = 2.2 + Math.sin(t * 3) * 0.25;
  });
  return (
    <directionalLight
      ref={light}
      castShadow
      color="#fff1d6"
      intensity={2.2}
      position={[15, 20, 10]}
      shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-20}
      shadow-camera-right={20}
      shadow-camera-top={20}
      shadow-camera-bottom={-20}
      shadow-bias={-0.0008}
    />
  );
}

/* Floating sparkles over the island. */
export function Fireflies() {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const arr = new Float32Array(60 * 3);
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2 * 7, r = 2 + ((i * 13) % 10);
      arr.set([Math.cos(a) * r, 1 + (i % 5) * 0.5, Math.sin(a) * r], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    return g;
  }, []);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.elapsedTime * 0.02;
      ref.current.position.y = Math.sin(clock.elapsedTime * 0.5) * 0.3;
    }
  });
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial color="#fffbe0" size={0.08} transparent opacity={0.8} />
    </points>
  );
}
