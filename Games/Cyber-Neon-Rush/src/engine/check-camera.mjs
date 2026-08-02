/**
 * Guard against the +Z chase-cam upside-down bug:
 * assigning camera.rotation.z after lookAt flips local up.
 */
import assert from 'node:assert/strict';
import * as THREE from 'three';

const cam = new THREE.PerspectiveCamera(62, 1.5, 0.1, 400);
cam.position.set(0, 7.2, -11);
cam.up.set(0, 1, 0);
cam.lookAt(0, 0.6, 16);

const upAfterLook = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
assert.ok(upAfterLook.y > 0.5, `lookAt chase cam must be upright, up.y=${upAfterLook.y}`);

cam.rotateZ(0.12);
const upAfterBank = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
assert.ok(upAfterBank.y > 0.5, `rotateZ bank must stay upright, up.y=${upAfterBank.y}`);

cam.lookAt(0, 0.6, 16);
cam.rotation.z = 0;
const upAfterEulerWrite = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
assert.ok(
  upAfterEulerWrite.y < 0,
  'sanity: writing rotation.z after lookAt should invert (documents the bug)',
);

console.log('check-camera: ok');
