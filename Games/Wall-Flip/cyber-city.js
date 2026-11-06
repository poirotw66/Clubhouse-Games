/* Deterministic city scenery shared by the WebGL district and Canvas skyline. */
(function(global) {
  'use strict';
  let seed=9137;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const towers=Array.from({length:96},(_,i)=>({
    x:-1450+i*17+random()*8,z:-50-random()*85,
    w:9+random()*11,d:9+random()*12,h:20+random()*65,variant:i%3,
  }));
  function canvasTexture(THREE,draw,w=256,h=512) {
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    draw(canvas.getContext('2d'),w,h);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    texture.anisotropy=4;return texture;
  }
  function build(THREE,scene) {
    const group=new THREE.Group();group.name='night-district';
    const colors=['#63e7f2','#ed4d96','#ddb06c'];
    const geometry=new THREE.BoxGeometry(1,1,1);
    const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),scale=new THREE.Vector3(),rotation=new THREE.Quaternion();
    for(let variant=0;variant<3;variant++) {
      const texture=canvasTexture(THREE,(ctx,w,h)=>{
        ctx.fillStyle='#080d1c';ctx.fillRect(0,0,w,h);
        for(let y=7;y<h;y+=14)for(let x=6;x<w;x+=15) {
          ctx.fillStyle=random()>.43?colors[variant]:'#172235';
          ctx.globalAlpha=.18+random()*.58;ctx.fillRect(x,y,random()>.85?5:8,3);
        }
        ctx.globalAlpha=1;ctx.fillStyle='#34415a';
        for(let x=0;x<w;x+=64)ctx.fillRect(x,0,2,h);
      });
      const material=new THREE.MeshStandardMaterial({map:texture,emissiveMap:texture,emissive:0xffffff,emissiveIntensity:.8,roughness:.65,metalness:.35});
      const subset=towers.filter(t=>t.variant===variant);
      const mesh=new THREE.InstancedMesh(geometry,material,subset.length);
      subset.forEach((t,i)=>{
        matrix.compose(position.set(t.x,t.h/2,t.z),rotation,scale.set(t.w,t.h,t.d));mesh.setMatrixAt(i,matrix);
      });
      group.add(mesh);
    }
    const dark=new THREE.MeshStandardMaterial({color:0x10172b,roughness:.5,metalness:.6});
    const cyan=new THREE.MeshBasicMaterial({color:0x4ed8ef});
    const pink=new THREE.MeshBasicMaterial({color:0xe84b91});
    const boxes=new Map();
    const box=(w,h,d,x,y,z,material)=>{
      if(!boxes.has(material))boxes.set(material,[]);
      boxes.get(material).push([w,h,d,x,y,z]);
    };
    // The nearest structures sit behind the runway; the flight corridor stays clear.
    for(let x=-1380;x<80;x+=100) {
      box(25,10,8,x,5,-34,dark);
      box(25,.065,.065,x,10.1,-29.95,x%200===-180?pink:cyan);
      for(let i=-2;i<=2;i++)box(.13,5,.15,x+i*4,6,-29.9,cyan);
      box(2,2,3,x-7,11,-34,dark);box(3,.4,4,x+5,10.3,-34,dark);
    }
    const signTexture=canvasTexture(THREE,(ctx,w,h)=>{
      ctx.fillStyle='#101427';ctx.fillRect(0,0,w,h);
      ctx.strokeStyle='#ef4e9a';ctx.lineWidth=3;ctx.strokeRect(4,4,w-8,h-8);
      ctx.fillStyle='#e9f9ff';ctx.font='600 66px sans-serif';ctx.textAlign='center';ctx.fillText('夜航',w/2,92);
      ctx.fillStyle='#65e6f4';ctx.font='500 18px monospace';ctx.fillText('NIGHT RUN // 09',w/2,127);
      ctx.fillStyle='#ed4d96';ctx.fillRect(22,147,w-44,3);
      ctx.fillStyle='#a1b1ca';ctx.font='14px monospace';ctx.fillText('WALL FLIP MOTOR CLUB',w/2,177);
    },512,208);
    const signMaterial=new THREE.MeshBasicMaterial({map:signTexture,side:THREE.DoubleSide});
    for(const x of [-470,-210,-55,55]) {
      box(.4,18,.4,x-7,9,-27,dark);box(.4,18,.4,x+7,9,-27,dark);
      const sign=new THREE.Mesh(new THREE.PlaneGeometry(17,6.9),signMaterial);sign.position.set(x,17,-27);group.add(sign);
    }
    // Thin, broken light pools suggest a rain-darkened apron without a reflection pass.
    const poolTexture=canvasTexture(THREE,(ctx,w,h)=>{
      const gradient=ctx.createLinearGradient(0,0,0,h);
      gradient.addColorStop(0,'#ffffff00');gradient.addColorStop(.4,'#ffffff88');gradient.addColorStop(1,'#ffffff00');
      ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
      ctx.globalCompositeOperation='destination-out';
      for(let i=0;i<70;i++)ctx.fillRect(0,random()*h,w,1+random()*3);
    },64,256);
    for(const [parity,color] of [[0,0xec368b],[1,0x28c6e0]]) {
      const material=new THREE.MeshBasicMaterial({map:poolTexture,color,transparent:true,opacity:.13,depthWrite:false});
      const mesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(2.5,18).rotateX(-Math.PI/2),material,24);
      for(let i=0;i<24;i++){matrix.makeTranslation(-1390+(i*2+parity)*30,.065,-7);mesh.setMatrixAt(i,matrix);}
      group.add(mesh);
    }
    for(const [material,parts] of boxes) {
      const mesh=new THREE.InstancedMesh(geometry,material,parts.length);
      parts.forEach(([w,h,d,x,y,z],i)=>{
        matrix.compose(position.set(x,y,z),rotation,scale.set(w,h,d));mesh.setMatrixAt(i,matrix);
      });
      group.add(mesh);
    }
    scene.add(group);
  }
  function studio(THREE) {
    const room=new THREE.Scene();room.background=new THREE.Color(0x17223a);
    const panel=(color,intensity,x,y,z,w,h,rx,ry)=>{
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}));
      mesh.material.color.multiplyScalar(intensity);mesh.position.set(x,y,z);mesh.rotation.set(rx,ry,0);room.add(mesh);
    };
    panel(0xbfeaff,3,0,6,0,12,2,-Math.PI/2,0);
    panel(0x4de3ff,2,0,1,5,14,.6,0,Math.PI);
    panel(0xec378b,2,0,1,-5,14,.65,0,0);
    panel(0xffffff,1.6,6,2,0,3,5,0,-Math.PI/2);
    return room;
  }
  function draw2d(ctx,w,h,camX,camY) {
    ctx.save();
    const sky=ctx.createLinearGradient(0,0,0,h);
    sky.addColorStop(0,'#070914');sky.addColorStop(.55,'#20162f');sky.addColorStop(1,'#091723');
    ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
    const base=h*.76+Math.min(0,camY-10)*1.5;
    for(let layer=0;layer<2;layer++) {
      const size=layer===0?2.8:4.2,span=1650*size;
      for(const t of towers) {
        let x=((t.x*size-camX*(layer===0?.45:.85))%span+span)%span;
        if(x>w+100)x-=span;
        const y=base-t.h*size*.65,tw=t.w*size,th=t.h*size*.65;
        if(x+tw<0||x>w)continue;
        ctx.fillStyle=layer===0?'#0d1323':'#101a2b';ctx.fillRect(x,y,tw,th);
        ctx.fillStyle=colors2d[t.variant];ctx.globalAlpha=layer===0?.22:.5;
        for(let row=1;row<th/10;row++)for(let col=1;col<tw/8;col++) {
          if((row*7+col*3+t.variant)%5>1)ctx.fillRect(x+col*8,y+row*10,3,1.5);
        }
        if(layer===1)ctx.fillRect(x+tw-2,y,1,th*.8);
        ctx.globalAlpha=1;
      }
    }
    ctx.restore();
  }
  const colors2d=['#4ad5ee','#df4e9c','#e1ad66'];
  global.WallFlipCity=Object.freeze({build,studio,draw2d});
})(globalThis);
