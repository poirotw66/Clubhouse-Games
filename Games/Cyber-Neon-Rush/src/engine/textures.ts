import * as THREE from 'three';

const loader = new THREE.TextureLoader();

function loadTile(path: string, repeatX = 2, repeatY = 2): THREE.Texture {
  const tex = loader.load(`${import.meta.env.BASE_URL}${path}`);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  return tex;
}

let roadMap: THREE.Texture | null = null;
let barrierMap: THREE.Texture | null = null;
let carMap: THREE.Texture | null = null;
let coneMap: THREE.Texture | null = null;
let droneMap: THREE.Texture | null = null;

/** Lazy-load shared material maps (safe to call many times). */
export function getRoadMap(): THREE.Texture {
  if (!roadMap) roadMap = loadTile('textures/road.jpg', 1.5, 4);
  return roadMap;
}

export function getBarrierMap(): THREE.Texture {
  if (!barrierMap) barrierMap = loadTile('textures/barrier.jpg', 1, 1);
  return barrierMap;
}

export function getCarMap(): THREE.Texture {
  if (!carMap) carMap = loadTile('textures/car.jpg', 1, 1);
  return carMap;
}

export function getConeMap(): THREE.Texture {
  if (!coneMap) coneMap = loadTile('textures/cone.jpg', 1, 1);
  return coneMap;
}

export function getDroneMap(): THREE.Texture {
  if (!droneMap) droneMap = loadTile('textures/drone.jpg', 1, 1);
  return droneMap;
}
