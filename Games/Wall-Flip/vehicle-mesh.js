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
    const m={...materials,led:materials.led||materials.trim,tail:materials.tail||materials.trim,seam:materials.seam||materials.dark};
    if(vehicle.id==='mars') {m.body=materials.roverBody||m.body;m.trim=materials.roverTrim||m.trim;m.glass=materials.roverGlass||m.glass;}
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
      let geometry;
      if(material==='glass' && ['nova','sparrow','mars'].includes(vehicle.id)) {
        const key='canopy:'+vehicle.id;
        if(!geometryCache.has(key)) {
          const canopy=new THREE.SphereGeometry(1,24,12);canopy.scale(w/2,h/2,d/2);geometryCache.set(key,canopy);
        }
        geometry=geometryCache.get(key);
      } else geometry=roundedBox(THREE,w,h,d);
      const mesh=new THREE.Mesh(geometry,m[material]);
      mesh.position.set(x,y,z);mesh.rotation.z=rz;group.add(mesh);
    }
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
          const arch=new THREE.Mesh(new THREE.TorusGeometry(.395,.045,6,28,Math.PI),m.dark);
          arch.position.set(x,-.3,side*.94);group.add(arch);
          box(.19,.035,.055,x+.12,.12,side*.94,side===1?'led':'tail');
        }
        box(.2,.07,.14,.64,.15,side*.95,'dark');
        box(.15,.024,.06,.64,.19,side*.95,'trim');
      } else {
        for(const x of [-1.38,1.38])tube([[x,-.27,side*.38],[x-.18,-.22,side*.82]],.022,'trim');
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
    // Bonnet panels, cooling slats and an offset racing stripe.
    if(vehicle.id!=='mars') {
      box(.98,.018,width*.72,1.12,.085,0,'dark',-.045);
      for(let i=0;i<6;i++)box(.045,.022,width*.57,.76+i*.11,.102-i*.004,0,'trim');
    }
    box(.7,.018,.065,-1.47,.145, width*.55,'led');
    if(vehicle.id==='roadster') {
      box(1.28,.04,1.14,-.27,.14,0,'seam');
      for(const side of [-1,1]) {
        box(.35,.22,.4,-.58,.24,side*.31,'dark');
        box(.13,.28,.4,-.78,.35,side*.31,'dark',-.16);
        box(.13,.055,.18,-.8,.51,side*.31,'dark');
        tube([[-.94,.15,side*.55],[-1.01,.45,side*.55],[-.9,.52,side*.4]],.025,'trim');
      }
      box(.15,.1,1.12,.32,.22,0,'dark',-.1);
      box(.015,.055,.23,.22,.28,.25,'led',-.15);
      const steering=new THREE.Mesh(new THREE.TorusGeometry(.115,.015,6,20).rotateY(Math.PI/2),m.dark);
      steering.position.set(.04,.3,.31);group.add(steering);
      tube([[.48,.12,-.65],[.38,.47,-.65],[.38,.48,.65],[.48,.12,.65]],.018,'trim');
    } else if(vehicle.id==='atlas') {
      for(const side of [-1,1]) {
        box(.065,.24,.035,-.31,.31,side*.845,'dark');
        box(1.55,.018,.025,-.24,.45,side*.855,'trim');
        tube([[-1.1,.45,side*.63],[-1.08,.535,side*.63],[.51,.535,side*.63],[.59,.46,side*.63]],.018,'trim');
      }
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
    } else {
      tube([[-.78,.19,0],[-.45,.38,0],[.38,.3,0],[.69,.13,0]],.018,'trim');
      if(vehicle.id==='nova')for(const side of [-1,1]) {
        box(.7,.15,.3,-1.35,.16,side*.65,'dark');
        for(let i=0;i<5;i++)box(.045,.024,.27,-1.62+i*.1,.245,side*.65,'trim');
        box(.45,.022,.035,-1.38,.26,side*.65,'led');
      }
    }
    return bake(THREE,group);
  }
  function wheel(THREE,radius,side,materials,style='road') {
    const group=new THREE.Group();
    const rover=style==='rover';
    const add=(geometry,material,z=0)=>{
      const mesh=new THREE.Mesh(geometry,material);mesh.position.z=z;group.add(mesh);return mesh;
    };
    const ring=(r,tube,material,z)=>add(new THREE.TorusGeometry(r,tube,rover?6:8,rover?28:40),material,z);
    add(new THREE.CylinderGeometry(rover?radius-.025:radius,rover?radius-.025:radius,.28,48).rotateX(Math.PI/2),materials.tire);
    for(const z of [-.135,.135]) {
      ring(radius-(rover?.06:.055),rover?.035:.05,materials.tire,z);
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
    for(let i=0;i<10;i++) {
      const a=i*Math.PI/5;
      const spoke=add(roundedBox(THREE,.032,.19,.025),materials.trim,face);
      spoke.position.x=Math.sin(a)*.15;spoke.position.y=Math.cos(a)*.15;spoke.rotation.z=-a-.2;
    }
    add(new THREE.CylinderGeometry(.065,.065,.035,20).rotateX(Math.PI/2),materials.dark,face);
    ring(.045,.008,materials.led||materials.trim,face+side*.019);
    if(rover) {
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
    } else for(let i=0;i<32;i++) {
      const a=i*Math.PI/16;
      const rib=add(roundedBox(THREE,.016,.045,.019),materials.dark,side*.148);
      rib.position.x=Math.sin(a)*(radius-.038);rib.position.y=Math.cos(a)*(radius-.038);rib.rotation.z=-a+.25;
    }
    return bake(THREE,group);
  }
  global.WallFlipMesh=Object.freeze({build,wheel});
})(globalThis);
