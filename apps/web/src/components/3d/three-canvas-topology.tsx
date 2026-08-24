"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RefreshCw } from "lucide-react";

interface NodeData {
  id: string;
  name: string;
  type: string;
  framework: string;
  status: "healthy" | "analyzing" | "deploying";
  latency: string;
  port: number;
  position: [number, number, number];
}

const NODES: NodeData[] = [
  {
    id: "hub",
    name: "Monorepo Root",
    type: "Turborepo + pnpm",
    framework: "Workspace AST",
    status: "healthy",
    latency: "0ms",
    port: 0,
    position: [0, 0.4, 0],
  },
  {
    id: "web",
    name: "apps/web",
    type: "Frontend App",
    framework: "Next.js 15 SSR",
    status: "healthy",
    latency: "18ms",
    port: 3000,
    position: [-2.4, 1.2, 1.2],
  },
  {
    id: "api",
    name: "apps/api",
    type: "API Gateway",
    framework: "Fastify + tRPC",
    status: "healthy",
    latency: "12ms",
    port: 4000,
    position: [2.4, 1.1, 1.0],
  },
  {
    id: "worker",
    name: "apps/temporal-worker",
    type: "Workflow Engine",
    framework: "Temporal TypeScript",
    status: "healthy",
    latency: "5ms",
    port: 7233,
    position: [-1.9, -1.2, 1.4],
  },
  {
    id: "ecs",
    name: "AWS ECS Fargate",
    type: "Target Cluster",
    framework: "us-east-1 Production",
    status: "healthy",
    latency: "32ms",
    port: 443,
    position: [2.0, -1.3, 1.2],
  },
];

export function ThreeCanvasTopology() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeNode, setActiveNode] = useState<NodeData>(NODES[0]);
  const [activeMode, setActiveMode] = useState<"topology" | "scan" | "deploy">("topology");
  const [isDeploying, setIsDeploying] = useState(false);

  const triggerDeployPulse = () => {
    setIsDeploying(true);
    setTimeout(() => setIsDeploying(false), 2500);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.09);

    const width = container.clientWidth;
    const height = container.clientHeight;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 2.4, 7.2);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = false;
    container.appendChild(renderer.domElement);

    // Monochromatic Swiss lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
    keyLight.position.set(5, 8, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xa1a1aa, 0.9);
    fillLight.position.set(-5, -3, 5);
    scene.add(fillLight);

    // Root Group
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // Platinum geometric floor grid in 3D
    const gridHelper = new THREE.GridHelper(10, 20, 0x3f3f46, 0x18181b);
    gridHelper.position.y = -2;
    (gridHelper.material as THREE.Material).opacity = 0.45;
    (gridHelper.material as THREE.Material).transparent = true;
    rootGroup.add(gridHelper);

    // Node Meshes in Platinum & Obsidian
    const nodeObjects: { mesh: THREE.Mesh; halo: THREE.Mesh; data: NodeData }[] = [];
    const nodeRaycastMeshes: THREE.Mesh[] = [];

    NODES.forEach((node) => {
      const isHub = node.id === "hub";
      const geometry = isHub
        ? new THREE.IcosahedronGeometry(0.55, 1)
        : new THREE.BoxGeometry(0.46, 0.46, 0.46);

      const material = new THREE.MeshStandardMaterial({
        color: isHub ? 0xffffff : 0x27272a,
        roughness: 0.15,
        metalness: 0.92,
        emissive: isHub ? 0x27272a : 0x111113,
        emissiveIntensity: 0.25,
        wireframe: false,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...node.position);
      (mesh as any).nodeData = node;
      rootGroup.add(mesh);
      nodeRaycastMeshes.push(mesh);

      // Outer wireframe halo in crisp platinum
      const haloGeo = isHub
        ? new THREE.IcosahedronGeometry(0.7, 1)
        : new THREE.BoxGeometry(0.6, 0.6, 0.6);
      const haloMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        wireframe: true,
        transparent: true,
        opacity: isHub ? 0.35 : 0.2,
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.position.set(...node.position);
      rootGroup.add(halo);

      nodeObjects.push({ mesh, halo, data: node });
    });

    // Central Gimbal Rings around Hub in Platinum
    const ringGeo1 = new THREE.TorusGeometry(0.95, 0.01, 16, 64);
    const ringMat1 = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.35,
    });
    const ring1 = new THREE.Mesh(ringGeo1, ringMat1);
    ring1.position.set(0, 0.4, 0);
    ring1.rotation.x = Math.PI / 3;
    rootGroup.add(ring1);

    const ringGeo2 = new THREE.TorusGeometry(1.15, 0.008, 16, 64);
    const ringMat2 = new THREE.MeshBasicMaterial({
      color: 0x71717a,
      transparent: true,
      opacity: 0.25,
    });
    const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
    ring2.position.set(0, 0.4, 0);
    ring2.rotation.y = Math.PI / 4;
    rootGroup.add(ring2);

    // Conduits / Splines between Hub and Nodes
    const hubPos = new THREE.Vector3(...NODES[0].position);
    const splineCurves: THREE.CatmullRomCurve3[] = [];

    NODES.slice(1).forEach((node) => {
      const targetPos = new THREE.Vector3(...node.position);
      const midPoint = new THREE.Vector3(
        (hubPos.x + targetPos.x) * 0.5,
        (hubPos.y + targetPos.y) * 0.5 + 0.25,
        (hubPos.z + targetPos.z) * 0.5
      );

      const curve = new THREE.CatmullRomCurve3([hubPos, midPoint, targetPos]);
      splineCurves.push(curve);

      const points = curve.getPoints(32);
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x3f3f46,
        transparent: true,
        opacity: 0.5,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      rootGroup.add(line);
    });

    // Pure White Particle Pulses along Conduits
    const pulseCount = 16;
    const pulseGeo = new THREE.SphereGeometry(0.035, 8, 8);
    const pulseMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
    });

    const pulses: { mesh: THREE.Mesh; curveIndex: number; progress: number; speed: number }[] = [];
    for (let i = 0; i < pulseCount; i++) {
      const mesh = new THREE.Mesh(pulseGeo, pulseMat);
      rootGroup.add(mesh);
      pulses.push({
        mesh,
        curveIndex: i % splineCurves.length,
        progress: (i / pulseCount) * 1.0,
        speed: 0.004 + Math.random() * 0.004,
      });
    }

    // Ambient floating subtle dust particles
    const starGeo = new THREE.BufferGeometry();
    const starCount = 60;
    const starCoords = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starCoords[i] = (Math.random() - 0.5) * 12;
      starCoords[i + 1] = (Math.random() - 0.5) * 8;
      starCoords[i + 2] = (Math.random() - 0.5) * 8;
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starCoords, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0x52525b,
      size: 0.03,
      transparent: true,
      opacity: 0.35,
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // Mouse Parallax & Raycasting
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let targetRotationX = 0;
    let targetRotationY = 0;

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      mouse.x = x;
      mouse.y = y;

      targetRotationY = x * 0.35;
      targetRotationX = -y * 0.25;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(nodeRaycastMeshes);
      if (intersects.length > 0) {
        const hitNode = (intersects[0].object as any).nodeData as NodeData;
        if (hitNode) {
          setActiveNode(hitNode);
        }
      }
    };

    container.addEventListener("mousemove", onMouseMove);

    // Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Smooth camera/root damping
      rootGroup.rotation.y += (targetRotationY - rootGroup.rotation.y) * 0.05;
      rootGroup.rotation.x += (targetRotationX - rootGroup.rotation.x) * 0.05;

      // Rotate central rings
      ring1.rotation.z = elapsedTime * 0.35;
      ring2.rotation.z = -elapsedTime * 0.25;

      // Animate node meshes
      nodeObjects.forEach((item, idx) => {
        item.mesh.rotation.x = elapsedTime * (0.2 + idx * 0.04);
        item.mesh.rotation.y = elapsedTime * (0.3 + idx * 0.04);
        item.halo.rotation.x = -elapsedTime * 0.15;
        item.halo.rotation.y = -elapsedTime * 0.2;

        // Subtle vertical levitation
        const origY = item.data.position[1];
        item.mesh.position.y = origY + Math.sin(elapsedTime * 1.2 + idx) * 0.035;
        item.halo.position.y = item.mesh.position.y;
      });

      // Animate data pulses along conduits
      pulses.forEach((p) => {
        p.progress += p.speed;
        if (p.progress > 1) p.progress = 0;
        const curve = splineCurves[p.curveIndex];
        if (curve) {
          const pt = curve.getPoint(p.progress);
          p.mesh.position.copy(pt);
        }
      });

      // Slow starfield rotation
      stars.rotation.y = elapsedTime * 0.01;

      renderer.render(scene, camera);
    };

    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      container.removeEventListener("mousemove", onMouseMove);
      cancelAnimationFrame(animationFrameId);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div className="relative w-full h-[460px] sm:h-[520px] rounded-xl border border-white/[0.08] bg-[#070709] overflow-hidden shadow-2xl">
      {/* Top HUD Controls Bar */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
          <span className="text-xs font-mono font-medium text-zinc-300">
            3D Topology Cluster
          </span>
        </div>

        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            onClick={() => setActiveMode("topology")}
            className={`px-2.5 py-1 text-xs font-mono rounded border transition-colors ${
              activeMode === "topology"
                ? "border-white/20 bg-white/10 text-white font-medium"
                : "border-white/5 bg-black/40 text-zinc-400 hover:text-white"
            }`}
          >
            Topology
          </button>
          <button
            onClick={() => setActiveMode("scan")}
            className={`px-2.5 py-1 text-xs font-mono rounded border transition-colors ${
              activeMode === "scan"
                ? "border-white/20 bg-white/10 text-white font-medium"
                : "border-white/5 bg-black/40 text-zinc-400 hover:text-white"
            }`}
          >
            AST Scan
          </button>
          <button
            onClick={triggerDeployPulse}
            disabled={isDeploying}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-medium rounded border border-white/20 bg-white text-zinc-950 hover:bg-zinc-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${isDeploying ? "animate-spin" : ""}`} />
            <span>{isDeploying ? "Pulsing..." : "Pulse Pipeline"}</span>
          </button>
        </div>
      </div>

      {/* 3D WebGL Canvas Target */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Bottom Telemetry HUD Card (Raycaster Target Info) */}
      <div className="absolute bottom-4 left-4 right-4 sm:right-auto z-20 pointer-events-auto">
        <div className="p-3.5 sm:p-4 rounded-lg border border-white/10 bg-[#000000]/95 max-w-sm shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                <h4 className="text-sm font-semibold text-white font-mono">{activeNode.name}</h4>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">{activeNode.framework}</p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-white/10 bg-white/[0.04] text-zinc-400">
              {activeNode.type}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/[0.08] text-[11px] font-mono">
            <div>
              <span className="text-zinc-500 block text-[10px]">STATUS</span>
              <span className="text-zinc-200 font-medium">{activeNode.status}</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[10px]">LATENCY</span>
              <span className="text-zinc-300 font-medium">{activeNode.latency}</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[10px]">PORT</span>
              <span className="text-zinc-300 font-medium">
                {activeNode.port ? `:${activeNode.port}` : "Root"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Subtle bottom-right instruction hint */}
      <div className="hidden sm:block absolute bottom-4 right-4 z-10 text-[11px] font-mono text-zinc-500 pointer-events-none">
        Hover nodes to inspect telemetry · Drag to rotate
      </div>
    </div>
  );
}
