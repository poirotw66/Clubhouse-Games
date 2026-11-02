import { useEffect, useRef, type ReactElement } from 'react';
import * as THREE from 'three';
import { createCarMesh } from '../engine/meshes';
import type { CosmeticId } from '../engine/progress';

interface CarPreviewCanvasProps {
  cosmeticId: CosmeticId;
}

export function CarPreviewCanvas({ cosmeticId }: CarPreviewCanvasProps): ReactElement {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const cosmeticRef = useRef<CosmeticId>(cosmeticId);
  cosmeticRef.current = cosmeticId;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 360;
    const height = container.clientHeight || 180;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 1.8, 4.4);
    camera.lookAt(0, 0.35, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    // Neon lighting setup
    const amb = new THREE.AmbientLight(0xffffff, 1.1);
    scene.add(amb);

    const keyLight = new THREE.DirectionalLight(0x22d3ee, 2.2);
    keyLight.position.set(3, 4, 3);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xf472b6, 1.8);
    fillLight.position.set(-3, 2, -2);
    scene.add(fillLight);

    // Hologram circular pedestal
    const pedestalGroup = new THREE.Group();

    const outerRingGeom = new THREE.RingGeometry(1.6, 1.68, 48);
    const outerRingMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    });
    const outerRing = new THREE.Mesh(outerRingGeom, outerRingMat);
    outerRing.rotation.x = Math.PI / 2;
    pedestalGroup.add(outerRing);

    const innerRingGeom = new THREE.RingGeometry(1.2, 1.25, 36);
    const innerRingMat = new THREE.MeshBasicMaterial({
      color: 0xf472b6,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
    });
    const innerRing = new THREE.Mesh(innerRingGeom, innerRingMat);
    innerRing.rotation.x = Math.PI / 2;
    pedestalGroup.add(innerRing);

    const diskGeom = new THREE.CircleGeometry(1.58, 48);
    const diskMat = new THREE.MeshBasicMaterial({
      color: 0x07111f,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
    });
    const disk = new THREE.Mesh(diskGeom, diskMat);
    disk.rotation.x = Math.PI / 2;
    pedestalGroup.add(disk);

    scene.add(pedestalGroup);

    // Car mesh holder
    let carMesh = createCarMesh(cosmeticRef.current);
    carMesh.position.set(0, 0, 0);
    scene.add(carMesh);

    let currentLoadedCosmetic = cosmeticRef.current;

    // Pointer drag rotation
    let isDragging = false;
    let prevX = 0;
    let rotY = 0.45;
    let rotSpeed = 0.012;

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      prevX = e.clientX;
      rotSpeed = 0;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - prevX;
      prevX = e.clientX;
      rotY += dx * 0.015;
    };

    const onPointerUp = () => {
      isDragging = false;
      rotSpeed = 0.012;
    };

    container.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || 360;
      const h = container.clientHeight || 180;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', onResize);

    let rafId = 0;
    const animate = () => {
      rafId = requestAnimationFrame(animate);

      // Check if cosmetic changed
      if (cosmeticRef.current !== currentLoadedCosmetic) {
        scene.remove(carMesh);
        carMesh.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry?.dispose();
            if (Array.isArray(obj.material)) {
              obj.material.forEach((m) => m.dispose());
            } else {
              obj.material?.dispose();
            }
          }
        });
        currentLoadedCosmetic = cosmeticRef.current;
        carMesh = createCarMesh(currentLoadedCosmetic);
        scene.add(carMesh);
      }

      rotY += rotSpeed;
      carMesh.rotation.y = rotY;
      pedestalGroup.rotation.y = -rotY * 0.5;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(rafId);
      container.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('resize', onResize);

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      scene.remove(carMesh);
      carMesh.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material?.dispose();
          }
        }
      });
      outerRingGeom.dispose();
      outerRingMat.dispose();
      innerRingGeom.dispose();
      innerRingMat.dispose();
      diskGeom.dispose();
      diskMat.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="relative w-full h-44 rounded-lg overflow-hidden cursor-grab active:cursor-grabbing border border-cyan-500/40 bg-gradient-to-b from-[#07111f]/80 to-[#050816]/95 shadow-[0_0_24px_rgba(34,211,238,0.22)]"
      title="拖曳可 360 度旋轉預覽車體"
    >
      <div className="absolute top-2 left-3 text-[10px] tracking-widest uppercase font-display text-cyan-400/80 pointer-events-none">
        3D HOLO TURNTABLE // 全息車台
      </div>
      <div className="absolute bottom-2 right-3 text-[10px] tracking-wider font-display text-muted/70 pointer-events-none">
        左右拖曳旋轉
      </div>
    </div>
  );
}
