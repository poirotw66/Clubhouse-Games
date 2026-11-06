/* Sculpted shells share the catalogue and leave the physical stunt chassis unchanged. */
(function (global) {
  'use strict';
  const geometryCache=new Map();
  function roundedBox(THREE,w,h,d) {
    const key=[w,h,d].join(':');
    if(geometryCache.has(key)) return geometryCache.get(key);
    if(Math.min(w,h,d)<=.035) {
      const geometry=new THREE.BoxGeometry(w,h,d);geometryCache.set(key,geometry);return geometry;
    }
    const r=Math.min(w,h,d)*.2, x=w/2-r, y=h/2-r;
    const shape=new THREE.Shape();
    shape.moveTo(-x+r,-y);shape.lineTo(x-r,-y);shape.quadraticCurveTo(x,-y,x,-y+r);
    shape.lineTo(x,y-r);shape.quadraticCurveTo(x,y,x-r,y);
    shape.lineTo(-x+r,y);shape.quadraticCurveTo(-x,y,-x,y-r);
    shape.lineTo(-x,-y+r);shape.quadraticCurveTo(-x,-y,-x+r,-y);
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:d-2*r,bevelEnabled:true,bevelThickness:r,bevelSize:r,bevelSegments:3,curveSegments:4,steps:1});
    geometry.translate(0,0,-d/2+r);geometry.computeVertexNormals();
    geometryCache.set(key,geometry);
    return geometry;
  }
  function hull(THREE,vehicle) {
    const key='hull:'+vehicle.id;
    if(geometryCache.has(key)) return geometryCache.get(key);
    const points=[],indices=[],uv=[];
    const firstX=vehicle.hull[0][0],length=vehicle.hull.at(-1)[0]-firstX;
    for(const [x,width,bottom,top] of vehicle.hull) {
      const bevel=Math.min(.07,(top-bottom)*.23);
      const ring=[[bottom,-width*.8],[bottom+bevel,-width],[top-bevel,-width],[top,-width*.8],[top,width*.8],[top-bevel,width],[bottom+bevel,width],[bottom,width*.8]];
      for(let side=0;side<=8;side++) {
        const [y,z]=ring[side%8];points.push(x,y,z);uv.push((x-firstX)/length,side/8);
      }
    }
    for(let section=0;section<vehicle.hull.length-1;section++) {
      for(let side=0;side<8;side++) {
        const a=section*9+side,b=a+1,c=a+9,d=b+9;
        indices.push(a,b,c,b,d,c);
      }
    }
    const last=(vehicle.hull.length-1)*9;
    for(let i=1;i<7;i++) indices.push(0,i+1,i,last,last+i,last+i+1);
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    geometry.setIndex(indices);geometry.computeVertexNormals();
    geometryCache.set(key,geometry);
    return geometry;
  }
  // Static details are baked into one mesh per material, including their transforms.
  function bake(THREE,group) {
    const buckets=new Map();
    group.updateMatrixWorld(true);
    group.traverse(object=>{
      if(!object.isMesh) return;
      const geometry=object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone();
      geometry.applyMatrix4(object.matrixWorld);
      if(!buckets.has(object.material))buckets.set(object.material,[]);
      buckets.get(object.material).push(geometry);
    });
    group.clear();
    for(const [material,geometries] of buckets) {
      const geometry=new THREE.BufferGeometry();
      for(const attribute of ['position','normal','uv']) {
        const size=attribute==='uv'?2:3;
        const values=new Float32Array(geometries.reduce((n,g)=>n+g.getAttribute('position').count*size,0));
        let offset=0;
        for(const g of geometries) {
          const data=g.getAttribute(attribute)?.array;
          if(data)values.set(data,offset);
          offset+=g.getAttribute('position').count*size;
        }
        geometry.setAttribute(attribute,new THREE.BufferAttribute(values,size));
      }
      group.add(new THREE.Mesh(geometry,material));
      for(const g of geometries)g.dispose();
    }
    return group;
  }
  function build(THREE,vehicle,materials) {
    const m={...materials,led:materials.led||materials.trim,tail:materials.tail||materials.trim,seam:materials.seam||materials.dark,accent:materials.accent||materials.trim};
    const group=new THREE.Group();group.name='vehicle-'+vehicle.id;
    const skin=new THREE.Mesh(hull(THREE,vehicle),m.body);group.add(skin);
    if(vehicle.roof)group.add(new THREE.Mesh(hull(THREE,{id:vehicle.id+'-roof',hull:vehicle.roof}),m.body));
    const box=(w,h,d,x,y,z,material,rz=0)=>{
      const mesh=new THREE.Mesh(roundedBox(THREE,w,h,d),m[material]);
      mesh.position.set(x,y,z);mesh.rotation.z=rz;group.add(mesh);return mesh;
    };
    const tube=(points,radius,material)=>{
      const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'catmullrom',0);
      group.add(new THREE.Mesh(new THREE.TubeGeometry(curve,points.length*5,radius,6,false),m[material]));
    };
    for(const [w,h,d,x,y,z,material,rz=0] of vehicle.parts.slice(vehicle.hullParts)) {
      if(material==='glass'&&vehicle.canopy) {
        group.add(new THREE.Mesh(hull(THREE,{id:vehicle.id+'-canopy',hull:vehicle.canopy}),m.glass));continue;
      }
      const geometry=roundedBox(THREE,w,h,d);
      const mesh=new THREE.Mesh(geometry,m[material]);
      mesh.position.set(x,y,z);mesh.rotation.z=rz;group.add(mesh);
    }
    const loft=(name,stations,material)=>{
      const mesh=new THREE.Mesh(hull(THREE,{id:vehicle.id+'-'+name,hull:stations}),m[material]);group.add(mesh);return mesh;
    };
    const cylinder=(r,length,x,y,z,material)=>{
      const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,length,20).rotateZ(Math.PI/2),m[material]);
      mesh.position.set(x,y,z);group.add(mesh);return mesh;
    };
    const narrow=vehicle.id==='sparrow', width=narrow?.55:.96;
    // Splitters, battery tray, fasteners, door shut lines and illuminated sill rails.
    box(3.4,.12,width*1.85,0,-.38,0,'dark');
    for(const side of [-1,1]) {
      const z=side*width;
      box(2.05,.12,.09,-.05,-.24,z,'dark');
      box(1.78,.025,.025,-.05,-.21,z+side*.04,'led');
      tube([[-.96,.13,z],[-.94,-.07,z+side*.035],[-.68,-.17,z+side*.035],[.5,-.17,z],[.68,.08,z]],.009,'seam');
      box(.22,.025,.025,-.47,.035,z+side*.02,'trim');
      for(let i=0;i<5;i++) box(.032,.12,.032,-1.03-i*.08,-.05,z, 'seam',-.25);
      if(!narrow) {
        // The wheel arches stay inside the original collision envelope.
        if(vehicle.id!=='mars')for(const x of [-1.38,1.38]) {
          const key='fender:'+vehicle.id;
          if(!geometryCache.has(key)) {
            const profile=new THREE.Shape(),outer=vehicle.id==='atlas'?.46:.43;
            profile.absarc(0,0,outer,0,Math.PI,false);profile.lineTo(-.375,0);profile.absarc(0,0,.375,Math.PI,0,true);profile.closePath();
            const arch=new THREE.ExtrudeGeometry(profile,{depth:.12,bevelEnabled:true,bevelSize:.012,bevelThickness:.012,bevelSegments:1,curveSegments:12,steps:1});
            arch.translate(0,0,-.06);geometryCache.set(key,arch);
          }
          const arch=new THREE.Mesh(geometryCache.get(key),vehicle.id==='atlas'?m.dark:m.body);
          arch.position.set(x,-.3,side*.94);group.add(arch);
          const edge=new THREE.Mesh(new THREE.TorusGeometry(vehicle.id==='atlas'?.448:.421,.007,4,24,Math.PI),m.trim);
          edge.position.set(x,-.3,side*1.015);group.add(edge);
          if(vehicle.id==='atlas')for(let i=1;i<5;i++) {
            const a=i*Math.PI/5;
            box(.023,.023,.012,x+Math.cos(a)*.44,-.3+Math.sin(a)*.44,side*1.022,'accent');
          }
        }
        box(.2,.07,.14,.64,.15,side*.95,'dark');
        box(.15,.024,.06,.64,.19,side*.95,'trim');
      } else {
        for(const x of [-1.38,1.38])for(const y of [-.18,-.32]) {
          tube([[x-.3,y,side*.25],[x,y-.03,side*.82],[x+.2,y,side*.32]],.018,'trim');
        }
      }
    }
    const nose=vehicle.hull.at(-1),rear=vehicle.hull[0];
    box(.12,.13,nose[1]*1.7,nose[0]-.025,nose[2]+.06,0,'dark');
    box(.11,.09,rear[1]*1.7,rear[0]+.025,rear[2]+.05,0,'dark');
    // Separate LED projectors, their dark housings and a segmented rear light signature.
    for(const side of [-1,1]) {
      const z=side*nose[1]*.5;
      box(.08,.08,nose[1]*.58,nose[0]+.015,nose[3]-.045,z,'seam');
      for(let i=0;i<3;i++)box(.085,.025,.052,nose[0]+.025,nose[3]-.025,z+(i-1)*.065,'led');
      for(let i=0;i<4;i++)box(.08,.026,.07,rear[0]-.025,rear[3]-.045,side*(.14+i*.1),'tail');
      const tip=new THREE.Mesh(new THREE.CylinderGeometry(.065,.08,.14,16).rotateZ(Math.PI/2),m.trim);
      tip.position.set(rear[0]-.055,-.25,side*.36);group.add(tip);
      const core=new THREE.Mesh(new THREE.CylinderGeometry(.043,.043,.145,12).rotateZ(Math.PI/2),m.seam);
      core.position.copy(tip.position);group.add(core);
    }
    for(let i=-2;i<=2;i++)box(.36,.07,.025,-1.93,-.35,i*.18,'dark');
    for(const x of [-1.38,1.38])for(const side of [-1,1])box(.09,.16,.04,x+.13,-.26,side*.975,'tail');
    if(vehicle.id==='roadster') {
      loft('bonnet',[[.52,.68,.065,.115],[.95,.75,.04,.13],[1.65,.69,.01,.08],[2.06,.45,-.035,-.01]],'body');
      box(1.39,.012,.065,1.22,.109,0,'trim',-.04);
      box(1.28,.04,1.14,-.27,.14,0,'seam');
      for(const side of [-1,1]) {
        const fairing=loft('fairing-'+side,[[-1.65,.2,.1,.14],[-1.16,.24,.11,.3],[-.84,.2,.11,.38]],'body');
        fairing.position.z=side*.33;
        box(.43,.11,.39,-.5,.19,side*.31,'accent');
        box(.12,.25,.38,-.76,.32,side*.31,'accent',-.16);
        box(.1,.055,.19,-.8,.49,side*.31,'accent');
        for(let i=0;i<4;i++)box(.012,.015,.32,-.66+i*.07,.25,side*.31,'trim');
        tube([[-.95,.16,side*.55],[-1,.43,side*.55],[-.95,.51,side*.4],[-.9,.43,side*.2]],.02,'trim');
        tube([[-.82,.3,side*.5],[-.72,.44,side*.5]],.006,'trim');
        box(.3,.02,.02,-.34,.16,side*.71,'trim');
        for(let i=0;i<4;i++)box(.024,.065,.025,1.05+i*.085,.02,side*.84,'seam',-.3);
      }
      box(.16,.1,1.1,.32,.22,0,'accent',-.1);
      box(.015,.06,.22,.22,.28,.25,'led',-.15);
      box(.52,.07,.12,-.28,.18,0,'dark');
      cylinder(.026,.04,-.23,.29,0,'trim');
      const steering=new THREE.Mesh(new THREE.TorusGeometry(.115,.015,6,20).rotateY(Math.PI/2),m.accent);
      steering.position.set(.04,.3,.31);group.add(steering);
      tube([[.48,.12,-.65],[.38,.43,-.65],[.38,.44,.65],[.48,.12,.65]],.014,'trim');
      box(.2,.04,1.5,-1.97,.22,0,'trim');
    } else if(vehicle.id==='sparrow') {
      for(const side of [-1,1]) {
        const pod=loft('sidepod-'+side,[[-1.33,.17,-.25,.03],[-.8,.22,-.25,.15],[.1,.2,-.25,.1],[.46,.13,-.21,-.02]],'dark');pod.position.z=side*.49;
        box(.045,.13,.3,.45,-.035,side*.49,'seam');
        box(.055,.017,.29,.48,.045,side*.49,'accent');
        for(let i=0;i<5;i++)box(.035,.016,.22,-1.1+i*.11,.17,side*.49,'trim',-.05);
        box(.36,.19,.035,-1.91,.4,side*.98,'accent');
        box(.29,.14,.035,2,-.21,side*.98,'accent');
        tube([[-.75,.21,side*.31],[-.43,.46,side*.34],[.22,.4,side*.28],[.49,.22,0]],.025,'trim');
        box(.17,.025,.065,-.24,.4,side*.34,'accent');
        box(.16,.08,.04,.46,.2,side*.55,'body');
      }
      box(.35,.05,.35,-.27,.19,0,'dark');
      box(.09,.19,.32,-.6,.29,0,'dark',-.18);
      box(.023,.19,.06,-.56,.32,.11,'accent',-.18);
      box(.023,.19,.06,-.56,.32,-.11,'accent',-.18);
      tube([[.16,.21,0],[.25,.39,0]],.022,'trim');
      loft('nose-stripe',[[.62,.055,-.015,.002],[1.41,.04,-.065,-.05],[2.07,.025,-.12,-.105]],'accent');
      box(.12,.04,.14,-.83,.49,0,'accent');
    } else if(vehicle.id==='atlas') {
      for(const side of [-1,1]) {
        tube([[-1.61,.22,side*.68],[-1.3,.47,side*.79],[.32,.47,side*.76],[.94,.17,side*.59]],.025,'body');
        box(.058,.31,.035,-.37,.3,side*.8,'dark');
        tube([[-.98,.14,side*.78],[-.98,.45,side*.8]],.024,'dark');
        box(1.4,.018,.025,-.24,.47,side*.79,'trim');
        tube([[-.94,.49,side*.62],[-.85,.532,side*.62],[.22,.532,side*.62],[.3,.49,side*.62]],.016,'trim');
        for(const x of [-1.38,1.38])box(.08,.23,.035,x-.33,-.39,side*.94,'dark');
        box(.65,.04,.08,1.13,.12,side*.42,'dark',-.07);
        for(let i=0;i<4;i++)box(.025,.015,.07,.91+i*.13,.148-i*.009,side*.42,'accent');
        const tow=new THREE.Mesh(new THREE.TorusGeometry(.053,.012,5,12).rotateY(Math.PI/2),m.accent);
        tow.position.set(2.19,-.23,side*.54);group.add(tow);
        tube([[2.15,-.23,side*.78],[2.23,-.08,side*.76],[2.23,-.02,side*.53]],.035,'trim');
        for(const z of [side*.18,side*.43]) {
          cylinder(.09,.04,2.18,.07,z,'dark');cylinder(.066,.045,2.205,.07,z,'led');
          box(.025,.12,.01,2.23,.07,z,'trim');
        }
        box(.03,.3,.04,-1.66,.25,side*.78,'tail',-.25);
      }
      box(.26,.035,1.35,1.99,-.29,0,'trim',.17);
      box(.045,.19,1.1,2.16,-.06,0,'seam');
      for(let i=-3;i<=3;i++)box(.055,.14,.015,2.19,-.06,i*.14,'trim');
      for(const x of [-.6,.05])box(.04,.02,1.25,x,.535,0,'dark');
    } else if(vehicle.id==='mars') {
      const archKey='mars-fender';
      if(!geometryCache.has(archKey)) {
        const profile=new THREE.Shape();profile.absarc(0,0,.475,0,Math.PI,false);profile.lineTo(-.405,0);profile.absarc(0,0,.405,Math.PI,0,true);profile.closePath();
        const arch=new THREE.ExtrudeGeometry(profile,{depth:.075,bevelEnabled:true,bevelSize:.014,bevelThickness:.014,bevelSegments:1,curveSegments:16,steps:1});
        arch.translate(0,0,-.0375);arch.computeVertexNormals();geometryCache.set(archKey,arch);
      }
      for(const side of [-1,1]) {
        for(const x of [-1.38,0,1.38]) {
          const fender=new THREE.Mesh(geometryCache.get(archKey),m.body);fender.position.set(x,-.3,side*.975);group.add(fender);
          const edge=new THREE.Mesh(new THREE.TorusGeometry(.46,.007,5,28,Math.PI),m.trim);edge.position.set(x,-.3,side*1.029);group.add(edge);
          tube([[x-.19,-.1,side*.85],[x+.12,-.32,side*.86],[x+.24,-.15,side*.85]],.018,'trim');
        }
        for(const x of [-.69,.69]) {
          tube([[x-.32,-.3,side*.89],[x,-.12,side*.86],[x+.32,-.3,side*.89]],.025,'seam');
          const coil=new THREE.Mesh(new THREE.TorusGeometry(.045,.009,5,10),m.trim);
          coil.rotation.x=Math.PI/2;coil.position.set(x,-.21,side*.88);group.add(coil);
        }
        tube([[-1.1,.22,side*.56],[-.72,.465,side*.69],[.38,.49,side*.68],[.94,.21,side*.48]],.012,'trim');
        tube([[-.12,.15,side*.69],[-.12,.49,side*.69]],.022,'seam');
        box(1.23,.018,.025,-.18,.535,side*.62,'trim');
        box(1.07,.065,.29,1.26,.13,side*.49,'body',-.065);
        box(.1,.065,.36,2.14,.01,side*.39,'seam');
        box(.112,.021,.29,2.16,.02,side*.39,'led');
        const turbine=new THREE.Mesh(new THREE.CylinderGeometry(.135,.15,.28,20).rotateX(side*Math.PI/2),m.body);
        turbine.position.set(-1.62,.27,side*.83);group.add(turbine);
        const intake=new THREE.Mesh(new THREE.CylinderGeometry(.105,.105,.02,20).rotateX(Math.PI/2),m.seam);
        intake.position.set(-1.62,.27,side*.98);group.add(intake);
        const rim=new THREE.Mesh(new THREE.TorusGeometry(.115,.012,6,24),m.trim);
        rim.position.set(-1.62,.27,side*.997);group.add(rim);
        for(let i=0;i<8;i++) {
          const a=i*Math.PI/4,blade=box(.018,.08,.012,-1.62+Math.sin(a)*.055,.27+Math.cos(a)*.055,side*1.003,'trim');blade.rotation.z=-a+.45;
        }
        const hub=new THREE.Mesh(new THREE.SphereGeometry(.025,8,6),m.led);hub.position.set(-1.62,.27,side*1.01);group.add(hub);
        box(.21,.13,.33,-.48,.25,side*.29,'dark',-.12);
        box(.08,.2,.33,-.61,.34,side*.29,'dark',-.18);
      }
      box(.5,.02,.21,1.36,.175,0,'seam',-.05);
      for(let i=0;i<4;i++)box(.025,.015,.18,1.16+i*.13,.19-i*.006,0,'trim');
      for(let i=0;i<5;i++)box(.012,.008,1.05,-1.76+i*.14,.275,0,'led');
      for(const z of [-.35,0,.35])box(.62,.008,.009,-1.48,.275,z,'trim');
      box(.22,.04,.15,-1.96,.22,0,'dark');box(.06,.012,.07,-1.96,.246,0,'led');
    } else if(vehicle.id==='nova') {
      tube([[-1,.16,0],[-.56,.42,0],[.16,.39,0],[.83,.1,0]],.014,'trim');
      for(const side of [-1,1]) {
        tube([[-1,.15,side*.31],[-.56,.41,side*.48],[.16,.38,side*.4],[.83,.1,side*.12]],.012,'accent');
        const pod=loft('engine-'+side,[[-1.99,.19,-.06,.2],[-1.65,.25,-.06,.31],[-.94,.24,-.05,.28],[-.69,.14,-.04,.14]],'body');pod.position.z=side*.67;
        cylinder(.177,.05,-2.025,.085,side*.67,'trim');
        cylinder(.147,.058,-2.058,.085,side*.67,'seam');
        cylinder(.075,.06,-2.062,.085,side*.67,'led');
        for(let i=0;i<9;i++) {
          const a=i*Math.PI*2/9;
          box(.02,.06,.018,-2.095,.085+Math.cos(a)*.11,side*.67+Math.sin(a)*.11,'accent',a);
        }
        for(let i=0;i<5;i++)box(.045,.017,.3,-1.67+i*.12,.32,side*.67,'trim',.035);
        box(.5,.014,.025,-1.45,.34,side*.66,'led');
        const fin=loft('fin-'+side,[[-1.94,.023,.16,.22],[-1.6,.023,.21,.51],[-1.3,.023,.21,.32]],'accent');fin.position.z=side*.84;
        box(.78,.025,.06,.91,-.09,side*.65,'accent',-.08);
        box(.3,.1,.027,.18,-.035,side*.85,'seam',-.25);
      }
      loft('nose-ridge',[[.52,.08,.04,.06],[1.22,.06,-.005,.02],[2.04,.025,-.055,-.035]],'accent');
    }
    return bake(THREE,group);
  }
  function wheel(THREE,radius,side,materials,style='road') {
    const group=new THREE.Group();
    const rover=style==='rover',rally=style==='rally',treaded=rover||rally;
    const add=(geometry,material,z=0)=>{
      const mesh=new THREE.Mesh(geometry,material);mesh.position.z=z;group.add(mesh);return mesh;
    };
    const ring=(r,tube,material,z)=>add(new THREE.TorusGeometry(r,tube,6,28),material,z);
    add(new THREE.CylinderGeometry(treaded?radius-.025:radius,treaded?radius-.025:radius,.28,rover?48:40).rotateX(Math.PI/2),materials.tire);
    for(const z of [-.135,.135]) {
      ring(radius-(treaded?.06:.055),treaded?.035:.05,materials.tire,z);
      ring(.271,.013,materials.trim,z+side*.01);
    }
    const face=side*.158;
    add(new THREE.CylinderGeometry(.256,.256,.02,40).rotateX(Math.PI/2),materials.dark,face-side*.055);
    ring(.2,.024,materials.trim,face-side*.036);
    for(let i=0;i<12;i++) {
      const a=i*Math.PI/6;
      const hole=add(new THREE.CircleGeometry(.012,5),materials.dark,face-side*.009);
      hole.position.x=Math.cos(a)*.2;hole.position.y=Math.sin(a)*.2;
      if(side<0)hole.rotation.y=Math.PI;
    }
    const spokes=style==='formula'||rally?6:style==='turbine'?12:10;
    if(style==='turbine')add(new THREE.CylinderGeometry(.225,.225,.015,32).rotateX(Math.PI/2),materials.trim,face-side*.018);
    for(let i=0;i<spokes;i++) {
      const a=style==='touring'?(Math.floor(i/2)*Math.PI*2/5+(i%2-.5)*.17):i*Math.PI*2/spokes;
      const spoke=add(roundedBox(THREE,style==='turbine'?.042:rally?.05:rover?.032:.026,rover?.19:.18,rover?.025:.02),style==='turbine'?materials.dark:materials.trim,face);
      spoke.position.x=Math.sin(a)*.155;spoke.position.y=Math.cos(a)*.155;
      spoke.rotation.z=-a+(style==='turbine'?.55:style==='touring'?(i%2?.08:-.18):rover?-.2:-.13);
    }
    add(new THREE.CylinderGeometry(.065,.065,.035,20).rotateX(Math.PI/2),materials.dark,face);
    ring(.045,.008,materials.led||materials.trim,face+side*.019);
    if(treaded) {
      for(let i=0;i<32;i++)for(const lane of [-1,1]) {
        const a=i*Math.PI/16;
        const tread=add(roundedBox(THREE,.065,.025,.12),materials.tire,lane*.067);
        tread.position.x=Math.sin(a)*(radius-.018);tread.position.y=Math.cos(a)*(radius-.018);
        tread.rotation.set(0,lane*.28,-a,'ZYX');
      }
      for(let i=0;i<8;i++) {
        const a=i*Math.PI/4,bolt=add(new THREE.CylinderGeometry(.011,.011,.02,6).rotateX(Math.PI/2),materials.dark,face+side*.016);
        bolt.position.x=Math.cos(a)*.091;bolt.position.y=Math.sin(a)*.091;
      }
    } else if(style!=='formula')for(let i=0;i<24;i++) {
      const a=i*Math.PI/12;
      const rib=add(roundedBox(THREE,.016,.045,.019),materials.dark,side*.148);
      rib.position.x=Math.sin(a)*(radius-.038);rib.position.y=Math.cos(a)*(radius-.038);rib.rotation.z=-a+.25;
    }
    return bake(THREE,group);
  }
  global.WallFlipMesh=Object.freeze({build,wheel});
})(globalThis);
