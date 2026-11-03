import * as THREE from 'three';

/**
 * Steeplechase hurdle obstacle manager for Royal Derby.
 * Spawns 3D hurdles along the 50m track, tracks approach timing,
 * handles clearance detection and knockdown animation.
 */
export class SteeplechaseManager {
  constructor() {
    this.hurdlePositions = [15.0, 28.0, 41.0];
    this.hurdles = [];
    this.scene = null;
    this.particles = [];
    this.particleGroup = null;
    this.hurdleHeight = 0.46;
    this.clearThreshold = 1.34;
  }

  init(scene) {
    this.scene = scene;
    this.createHurdles();
    this.createParticleSystem();
  }

  createHurdles() {
    const postMat = new THREE.MeshStandardMaterial({ color: 0xf5eedb, roughness: 0.6 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.3 });
    const brushMat = new THREE.MeshStandardMaterial({ color: 0x1f4724, roughness: 0.95 });

    // Alternating red/white striped bar texture
    const barTex = this.createStripedTexture(256, 32);
    const barMat = new THREE.MeshStandardMaterial({ map: barTex, roughness: 0.7 });

    this.hurdles = this.hurdlePositions.map((x, idx) => {
      const group = new THREE.Group();
      group.position.set(x, 0, 0);

      // Two side posts at z = -2.0 and +2.0
      const postGeo = new THREE.CylinderGeometry(0.06, 0.07, 0.95, 10);
      const capGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.08, 10);

      [-2.0, 2.0].forEach(z => {
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(0, 0.475, z);
        post.castShadow = true;
        group.add(post);

        const cap = new THREE.Mesh(capGeo, goldMat);
        cap.position.set(0, 0.97, z);
        group.add(cap);
      });

      // Green brush hedge at the base
      const brush = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.24, 4.0),
        brushMat
      );
      brush.position.set(0, 0.12, 0);
      brush.castShadow = true;
      group.add(brush);

      // Top knockable crossbar pivot group
      const barPivot = new THREE.Group();
      barPivot.position.set(0, this.hurdleHeight, 0);

      const crossbar = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.14, 4.04),
        barMat
      );
      crossbar.castShadow = true;
      barPivot.add(crossbar);

      // Small center brass plaque
      const plaque = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.1, 0.4),
        goldMat
      );
      barPivot.add(plaque);

      group.add(barPivot);

      // Pennant flags atop the posts (Red on right, white on left)
      const flagLeft = this.createFlagMesh(0xf0ece1);
      flagLeft.position.set(0, 0.95, -2.0);
      group.add(flagLeft);

      const flagRight = this.createFlagMesh(0xc92a2a);
      flagRight.position.set(0, 0.95, 2.0);
      group.add(flagRight);

      this.scene.add(group);

      return {
        id: idx + 1,
        x,
        group,
        barPivot,
        cleared: false,
        hit: false,
        knockRot: 0,
        knockVel: 0,
      };
    });
  }

  createStripedTexture(w, h) {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext('2d');
    const seg = 16;
    for (let x = 0; x < w; x += seg) {
      ctx.fillStyle = (Math.floor(x / seg) % 2 === 0) ? '#d92b2b' : '#f5f0e6';
      ctx.fillRect(x, 0, seg, h);
    }
    // Border lines
    ctx.fillStyle = '#4a2f18';
    ctx.fillRect(0, 0, w, 2);
    ctx.fillRect(0, h - 2, w, 2);

    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  createFlagMesh(colorHex) {
    const geo = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      0, 0, 0,
      0.3, 0.12, 0,
      0, 0.24, 0
    ]);
    geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide });
    return new THREE.Mesh(geo, mat);
  }

  createParticleSystem() {
    this.particleGroup = new THREE.Group();
    this.scene.add(this.particleGroup);

    // Pool of gold sparkles for perfect clearance
    const pGeo = new THREE.SphereGeometry(0.045, 6, 6);
    const pMat = new THREE.MeshBasicMaterial({ color: 0xffe259 });

    for (let i = 0; i < 40; i++) {
      const mesh = new THREE.Mesh(pGeo, pMat);
      mesh.visible = false;
      this.particleGroup.add(mesh);
      this.particles.push({
        mesh,
        active: false,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
      });
    }
  }

  reset() {
    for (const h of this.hurdles) {
      h.cleared = false;
      h.hit = false;
      h.knockRot = 0;
      h.knockVel = 0;
      h.barPivot.rotation.x = 0;
      h.barPivot.position.y = this.hurdleHeight;
    }
    for (const p of this.particles) {
      p.active = false;
      p.mesh.visible = false;
    }
  }

  getNextHurdle(horseX) {
    for (const h of this.hurdles) {
      if (horseX < h.x + 0.8) {
        return h;
      }
    }
    return null;
  }

  getApproachInfo(horseX) {
    const next = this.getNextHurdle(horseX);
    if (!next) return { active: false, dist: 99, frac: 0 };
    const dist = next.x - horseX;
    if (dist > 7.0 || dist < -0.6) {
      return { active: false, dist, frac: 0, hurdle: next };
    }
    // Window: 6m approach down to 0m
    const frac = THREE.MathUtils.clamp(1 - dist / 6.0, 0, 1);
    const inPerfectZone = dist >= 1.2 && dist <= 2.8;
    const inGreatZone = (dist >= 0.5 && dist < 1.2) || (dist > 2.8 && dist <= 3.8);
    return {
      active: true,
      dist,
      frac,
      hurdle: next,
      inPerfectZone,
      inGreatZone,
    };
  }

  triggerJump(horse) {
    const next = this.getNextHurdle(horse.x);
    if (!next) return { grade: 'free' };
    const dist = next.x - horse.x;

    if (dist >= 1.2 && dist <= 2.8) {
      next.cleared = true;
      this.burstGoldSparkles(next.x, horse.z || 0);
      return { grade: 'perfect', boost: 0.9, hurdle: next };
    }
    if ((dist >= 0.4 && dist < 1.2) || (dist > 2.8 && dist <= 4.0)) {
      next.cleared = true;
      return { grade: 'great', boost: 0.4, hurdle: next };
    }
    return { grade: 'free' };
  }

  checkPassing(horse) {
    for (const h of this.hurdles) {
      if (h.hit || h.cleared) continue;
      const dist = h.x - horse.x;
      // When horse reaches hurdle footprint
      if (dist <= 0.4 && dist >= -0.5) {
        // If horse body is lower than clearance threshold, it strikes the hurdle
        if (horse.y < this.clearThreshold) {
          h.hit = true;
          h.knockVel = 8.0;
          return { hit: true, hurdle: h };
        } else {
          h.cleared = true;
        }
      }
    }
    return null;
  }

  burstGoldSparkles(x, z) {
    let spawned = 0;
    for (const p of this.particles) {
      if (!p.active && spawned < 24) {
        p.active = true;
        p.mesh.visible = true;
        p.mesh.position.set(x + (Math.random() - 0.5) * 0.4, 0.7 + Math.random() * 0.8, z + (Math.random() - 0.5) * 2.2);
        p.vx = (Math.random() - 0.5) * 2.5;
        p.vy = 2.0 + Math.random() * 3.0;
        p.vz = (Math.random() - 0.5) * 2.5;
        p.life = 0;
        p.maxLife = 0.55 + Math.random() * 0.35;
        spawned++;
      }
    }
  }

  update(dt) {
    // Update knocked hurdles
    for (const h of this.hurdles) {
      if (h.hit && h.knockRot < Math.PI * 0.48) {
        h.knockRot += h.knockVel * dt;
        h.barPivot.rotation.x = -h.knockRot;
        h.barPivot.position.y = Math.max(0.12, this.hurdleHeight - h.knockRot * 0.2);
      }
    }

    // Update gold spark particles
    for (const p of this.particles) {
      if (p.active) {
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.active = false;
          p.mesh.visible = false;
        } else {
          p.vy -= 9.8 * dt;
          p.mesh.position.x += p.vx * dt;
          p.mesh.position.y = Math.max(0.05, p.mesh.position.y + p.vy * dt);
          p.mesh.position.z += p.vz * dt;
          const s = Math.max(0.1, 1 - p.life / p.maxLife);
          p.mesh.scale.set(s, s, s);
        }
      }
    }
  }
}
