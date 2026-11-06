import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import * as THREE from '../vendor/three.module.js';

const context={};
for(const file of ['vehicle-garage.js','vehicle-mesh.js']) vm.runInNewContext(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),context);

test('sculpted vehicle shells face outward and fit inside the stunt chassis',()=>{
  const material=new THREE.MeshBasicMaterial();
  for(const vehicle of context.WallFlipGarage.vehicles) {
    const mesh=context.WallFlipMesh.build(THREE,vehicle,{body:material,glass:material,dark:material,trim:material});
    const bounds=new THREE.Box3().setFromObject(mesh);
    assert.ok(bounds.min.x>=-2.3&&bounds.max.x<=2.3,vehicle.id+' length');
    assert.ok(bounds.min.y>=-.66&&bounds.max.y<=.56,vehicle.id+' height');
    assert.ok(bounds.min.z>=-1.05&&bounds.max.z<=1.05,vehicle.id+' width');
    const geometry=mesh.children[0].geometry;
    const normals=geometry.getAttribute('normal');
    assert.ok(normals.getY(0)<0&&normals.getZ(0)<0,vehicle.id+' lower shell faces outward');
    for(const n of normals.array) assert.ok(Number.isFinite(n));
  }
});

test('detailed cars stay within the mobile geometry and draw budgets',()=>{
  const materials=Object.fromEntries(['body','glass','dark','trim','seam','led','tail','tire','roverBody','roverGlass','roverTrim'].map(key=>[key,new THREE.MeshStandardMaterial()]));
  const triangleCount=group=>group.children.reduce((n,mesh)=>n+mesh.geometry.getAttribute('position').count/3,0);
  const styles=Object.fromEntries(['road','rover'].map(style=>[style,[-1,1].map(side=>context.WallFlipMesh.wheel(THREE,.36,side,materials,style))]));
  for(const wheel of Object.values(styles).flat()) {
    const bounds=new THREE.Box3().setFromObject(wheel);
    assert.ok(bounds.min.x>=-.361&&bounds.max.x<=.361,'Tire radius remains unchanged');
    assert.ok(bounds.min.y>=-.361&&bounds.max.y<=.361,'Tire radius remains unchanged');
    assert.ok(wheel.children.length<=4,'Wheel details share material batches');
  }
  for(const vehicle of context.WallFlipGarage.vehicles) {
    const shell=context.WallFlipMesh.build(THREE,vehicle,materials);
    const wheelCount=vehicle.id==='mars'?6:4;
    const wheels=styles[vehicle.id==='mars'?'rover':'road'];
    assert.ok(shell.children.length+wheelCount*wheels[0].children.length<=(wheelCount===6?32:24),vehicle.id+' draw budget');
    assert.ok(triangleCount(shell)+wheelCount*triangleCount(wheels[0])<(wheelCount===6?44000:32000),vehicle.id+' triangle budget');
    shell.traverse(mesh=>{
      if(!mesh.geometry)return;
      for(const name of ['position','normal','uv'])for(const value of mesh.geometry.getAttribute(name).array)assert.ok(Number.isFinite(value),vehicle.id+' finite '+name);
    });
    if(vehicle.id==='mars') {
      const hull=shell.children.find(mesh=>mesh.material===materials.roverBody);
      const uv=hull.geometry.getAttribute('uv');
      assert.ok(uv.array.some(value=>value>.9),'Generated armor material has usable texture coordinates');
    }
  }
});
