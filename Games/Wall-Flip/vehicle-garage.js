/* One vehicle catalogue drives handling, showroom silhouettes and both game views. */
(function (global) {
  'use strict';
  const KEY = 'wallflip.vehicle.v1';
  // Parts are [width, height, depth, x, y, z, material, rotationZ].
  // Every shell uses the original stunt chassis, wheelbase and collision envelope.
  const vehicles = [
    {
      id: 'roadster', hullParts:1, hull:[[-2.16,.62,-.31,-.02],[-1.82,.9,-.37,.12],[-.8,.98,-.37,.11],[.65,.94,-.34,.08],[1.68,.81,-.28,.03],[2.16,.55,-.2,-.05]], name: 'ROADSTER', number: '01',
      handling: { motor: 1, rotation: 1, damping: 1, thrust: 1, airUse: 1 },
      tc: { title: '經典敞篷', role: '均衡入門', tip: '熟悉的原版手感，適合練習每一種挑戰。', trade: '各項能力均衡，沒有額外性能加成。' },
      en: { title: 'Classic roadster', role: 'Balanced', tip: 'Original handling. A dependable starting point for every contract.', trade: 'Balanced across the board, with no extra performance boost.' },
      parts: [[4.3,.36,1.94,0,-.2,0,'body'], [.15,.4,1.35,.5,.28,0,'glass',.28], [.48,.2,.5,-.6,.18,-.33,'dark'], [.48,.2,.5,-.6,.18,.33,'dark'], [.08,.4,.08,-1,.34,-.5,'trim'], [.08,.4,.08,-1,.34,.5,'trim'], [.08,.08,1.08,-1,.5,0,'trim'], [.3,.08,1.5,-2.05,.23,0,'dark']],
    },
    {
      id: 'sparrow', hullParts:2, hull:[[-2.05,.45,-.28,-.02],[-1.5,.56,-.36,.09],[-.6,.52,-.35,.14],[.25,.38,-.32,.06],[1.4,.25,-.27,-.07],[2.08,.18,-.22,-.13]], name: 'SPARROW', number: '02',
      handling: { motor: 1.1, rotation: 1.4, damping: .9, thrust: .92, airUse: 1.2 },
      tc: { title: '飛雀方程式', role: '靈活翻滾', tip: '翻滾反應更快，適合衝圈數；提早放開單側噴射。', trade: '推力較弱、耗氣較快，落地前需要更多修正。' },
      en: { title: 'Open-wheel racer', role: 'Agile flipper', tip: 'Fast roll response rewards ambitious flips. Release the single jet early.', trade: 'Weaker lift and faster air use leave less room for late corrections.' },
      parts: [[3.3,.3,.92,-.25,-.22,0,'body'], [1.15,.18,.5,1.45,-.18,0,'body'], [.65,.18,.62,-.35,.04,0,'glass'], [.15,.4,.75,-.8,.2,0,'dark'], [.4,.09,1.94,-1.9,.42,0,'body'], [.25,.09,1.9,2,-.3,0,'dark'], [.08,.32,.08,-1.85,.22,-.6,'dark'], [.08,.32,.08,-1.85,.22,.6,'dark']],
    },
    {
      id: 'atlas', hullParts:1, hull:[[-2.13,.68,-.31,.06],[-1.7,.98,-.38,.16],[-.85,.99,-.38,.14],[.8,.96,-.36,.13],[1.78,.87,-.3,.06],[2.14,.69,-.24,-.01]], name: 'ATLAS', number: '03',
      handling: { motor: .92, rotation: .75, damping: 1.5, thrust: 1.08, airUse: .75 },
      tc: { title: '磐石拉力', role: '穩定省氣', tip: '轉速收得快、噴射更省氣，適合精準著陸與續航挑戰。', trade: '加速和翻滾較慢，連續多圈需要提早開始。' },
      en: { title: 'Rally hatchback', role: 'Stable & efficient', tip: 'Rotation settles quickly and jets conserve air. Built for controlled landings.', trade: 'Slower acceleration and roll response demand earlier setup for multiple flips.' },
      parts: [[4.15,.46,1.95,0,-.16,0,'body'], [2.1,.45,1.65,-.2,.24,0,'body'], [1.8,.23,1.68,-.2,.32,0,'glass'], [2,.08,1.72,-.2,.5,0,'body'], [.3,.3,1.94,-1.95,-.06,0,'dark'], [.25,.24,1.94,2,-.14,0,'dark'], [.15,.06,1.85,-1.38,.48,0,'body']],
    },
    {
      id: 'nova', hullParts:2, hull:[[-2.15,.67,-.25,-.04],[-1.7,1.0,-.34,.1],[-.65,.95,-.33,.12],[.7,.81,-.29,.03],[1.65,.69,-.23,-.03],[2.16,.32,-.14,-.07]], name: 'NOVA', number: '04',
      handling: { motor: 1.04, rotation: .95, damping: 1.05, thrust: 1.28, airUse: 1.4 },
      tc: { title: '新星噴射', role: '強力升空', tip: '雙鍵噴射有更強升力，適合延長飛行與挽救下墜。', trade: '耗氣最快；倒掛時強力噴射也會加速墜落。' },
      en: { title: 'Jet prototype', role: 'Powerful lift', tip: 'Stronger twin jets extend flight and brake a steep descent.', trade: 'The fastest air drain. Powerful jets also push you down harder when inverted.' },
      parts: [[4.2,.22,1.85,0,-.2,0,'body'], [2.2,.18,1.6,-.55,-.01,0,'body'], [1.65,.38,.85,-.15,.2,0,'glass'], [1.3,.07,2.02,-1.1,.05,0,'dark'], [.55,.25,.07,-1.5,.34,-.7,'body'], [.55,.25,.07,-1.5,.34,.7,'body'], [.32,.14,1.8,1.9,-.12,0,'body']],
    },
    {
      id:'mars',hullParts:1,hull:[[-2.12,.64,-.16,.08],[-1.73,.9,-.2,.21],[-.82,.94,-.19,.23],[.7,.91,-.18,.2],[1.76,.8,-.16,.12],[2.13,.61,-.12,.015]],name:'MARS ROYALE',number:'05',
      canopy:[[-1.13,.55,.15,.22],[-.72,.69,.15,.46],[.38,.68,.15,.49],[.95,.48,.14,.21]],
      roof:[[-.92,.51,.475,.495],[-.72,.72,.5,.53],[.39,.71,.5,.535],[.72,.48,.48,.5]],
      handling:{motor:1,rotation:1.15,damping:1.35,thrust:1.5,airUse:.12,landingAssist:true},
      tc:{title:'尊榮火星車',role:'輕鬆著陸・超長續航',tip:'六輪尊榮座艙。單側噴射做特技，X／↓ 快降，B／雙鍵穩降；近地面自動減速，耗氣僅原版的 12%。',trade:'輔助仍會消耗空氣；太貼近地面才放開翻滾，仍可能來不及救回。'},
      en:{title:'Royal Mars rover',role:'Easy landing · Long endurance',tip:'Six wheels and a panoramic cabin. Hold one jet for stunts. X / down descends fast; B / both jets descend gently. Jets use 12% of the original air.',trade:'Assistance still spends air. Releasing a roll too close to the ground can leave too little time to recover.'},
      parts:[[4.2,.38,1.8,0,-.06,0,'body'],[2.08,.36,1.38,-.08,.32,0,'glass'],[.66,.025,1.13,-1.48,.255,0,'dark']],
    },
  ].map(v => Object.freeze({ ...v, handling: Object.freeze(v.handling), hull:Object.freeze(v.hull.map(Object.freeze)), canopy:v.canopy?Object.freeze(v.canopy.map(Object.freeze)):null, roof:v.roof?Object.freeze(v.roof.map(Object.freeze)):null, parts: Object.freeze(v.parts.map(Object.freeze)) }));
  Object.freeze(vehicles);
  const get = id => vehicles.find(v => v.id === id) || vehicles[0];
  function readSelection() {
    try { return get(localStorage.getItem(KEY)); } catch (_) { return vehicles[0]; }
  }
  function tune(base, id) {
    const h = get(id).handling;
    const tuned={ ...base, MOTOR_A: base.MOTOR_A * h.motor, MOTOR_P: base.MOTOR_P * h.motor,
      ANG: base.ANG * h.rotation, ROLL_DAMP: base.ROLL_DAMP * h.damping, SPIN_DAMP: base.SPIN_DAMP * h.damping,
      THRUST: base.THRUST * h.thrust, AIR_JET: base.AIR_JET * h.airUse, AIR_SUCK: base.AIR_SUCK * h.airUse };
    if(h.landingAssist)tuned.LANDING_ASSIST=true;
    return tuned;
  }
  function airControl({angle,pitch=0,spin,y,vy,air,clear},input,{damping,thrust,gravity}) {
    if(input.left!==input.right||air<=0)return input;
    if(!clear)return {left:false,right:false};
    const turn=Math.PI*2,target=Math.round(angle/turn)*turn;
    const error=target-angle-spin/damping;
    if(Math.abs(error)>.025)return {left:error>0,right:error<0};
    // Brake for the remaining stopping distance, never merely because B is held.
    const braking=Math.max(1,2*thrust*Math.cos(angle)*Math.cos(pitch)-gravity)*.65;
    const height=Math.max(0,y-.66-.35);
    const safeSpeed=Math.sqrt(1.2**2+2*braking*height);
    const targetSpeed=input.suck?safeSpeed:Math.min(18,safeSpeed);
    const brake=vy < -targetSpeed;
    return {left:brake,right:brake};
  }
  function recordKey(base, id) {
    const vehicle = get(id);
    return base + (vehicle.id === 'roadster' ? '' : '.vehicle.' + vehicle.id);
  }
  function svg(vehicle) {
    const parts = vehicle.parts.slice(vehicle.hullParts).map(([w,h,,x,y,,material,rz=0]) => {
      const fill=material==='body'?'currentColor':material==='glass'?'#314f61':material==='trim'&&vehicle.id==='mars'?'#dfbd7f':'#17232c';
      if(material==='glass'&&vehicle.canopy) {
        const outline='M'+vehicle.canopy.map(([px,,,top])=>px+','+(-top)).join(' L')+' L'+vehicle.canopy.slice().reverse().map(([px,,bottom])=>px+','+(-bottom)).join(' L')+' Z';
        return `<path d="${outline}" fill="${fill}" stroke="#bc995f" stroke-width=".025"/>`;
      }
      if(material==='glass'&&['nova','sparrow','mars'].includes(vehicle.id))return `<ellipse cx="${x}" cy="${-y}" rx="${w/2}" ry="${h/2}" fill="${fill}"/>`;
      return `<rect x="${x-w/2}" y="${-y-h/2}" width="${w}" height="${h}" rx=".035" fill="${fill}" transform="rotate(${-rz*180/Math.PI} ${x} ${-y})"/>`;
    }).join('');
    const outline='M'+vehicle.hull.map(([x,,,top])=>x+','+(-top)).join(' L')+' L'+vehicle.hull.slice().reverse().map(([x,,bottom])=>x+','+(-bottom)).join(' L')+' Z';
    const skin='<path d="'+outline+'" fill="currentColor"/>';
    const roof=vehicle.roof?'<path d="M'+vehicle.roof.map(([x,,,top])=>x+','+(-top)).join(' L')+' L'+vehicle.roof.slice().reverse().map(([x,,bottom])=>x+','+(-bottom)).join(' L')+' Z" fill="currentColor"/>':'';
    const wheels = (vehicle.id==='mars'?[-1.38,0,1.38]:[-1.38,1.38]).map(x => `<circle cx="${x}" cy=".3" r=".36" fill="#0a1119" stroke="#7c9aa6" stroke-width=".06"/><circle cx="${x}" cy=".3" r=".16" fill="${vehicle.id==='mars'?'#dfbd7f':'#a2bac2'}"/>`).join('');
    return `<svg viewBox="-2.6 -1.05 5.2 2" aria-hidden="true"><path d="M-2.5 .69H2.5" stroke="#45616d" stroke-width=".02"/>${skin}${parts}${roof}${wheels}<rect x="2.03" y="-.03" width=".12" height=".08" fill="#ffe3a7"/></svg>`;
  }
  let roverSurface=null;
  function draw2d(ctx, vehicle, color) {
    if(vehicle.id==='mars') {
      if(!roverSurface&&typeof Image!=='undefined') {
        roverSurface=new Image();roverSurface.src='assets/mars-royale-surface.webp';
        roverSurface.onerror=()=>{if(roverSurface.src.endsWith('.webp'))roverSurface.src='assets/mars-royale-surface.png';};
      }
      const tint=parseInt(color.slice(1),16);
      color='rgb('+[16,8,0].map((shift,i)=>Math.round(((tint>>shift)&255)*.2+[228,224,207][i]*.8)).join(',')+')';
    }
    const skin=ctx.createLinearGradient(0,-.4,0,.2);
    skin.addColorStop(0,'#111b30');skin.addColorStop(.38,'#345464');skin.addColorStop(.7,color);skin.addColorStop(1,'#76b8cf');
    ctx.fillStyle=skin;ctx.beginPath();
    vehicle.hull.forEach(([x,,,top],i)=>i?ctx.lineTo(x,top):ctx.moveTo(x,top));
    for(const [x,,bottom] of vehicle.hull.slice().reverse())ctx.lineTo(x,bottom);
    ctx.closePath();ctx.save();
    if(vehicle.id==='mars') {
      ctx.clip();ctx.beginPath();ctx.rect(-3,-1,6,2);
      for(const x of [-1.38,0,1.38]){ctx.moveTo(x+.405,-.3);ctx.arc(x,-.3,.405,0,Math.PI*2);}
      ctx.clip('evenodd');ctx.fillRect(-2.3,-.5,4.6,1);
      if(roverSurface?.complete&&roverSurface.naturalWidth){ctx.globalAlpha*=.25;ctx.drawImage(roverSurface,-2.2,-.4,4.4,.7);}
    } else {ctx.fill();ctx.strokeStyle='#d5ffef66';ctx.lineWidth=.025;ctx.stroke();}
    ctx.restore();
    for (const [w,h,,x,y,,material,rz=0] of vehicle.parts.slice(vehicle.hullParts)) {
      if(material==='glass'&&vehicle.canopy) {
        const glass=ctx.createLinearGradient(0,.15,0,.5);glass.addColorStop(0,'#071321');glass.addColorStop(.7,'#28485e');glass.addColorStop(1,'#86aec2');
        ctx.fillStyle=glass;ctx.strokeStyle='#d6b274';ctx.lineWidth=.018;ctx.beginPath();
        vehicle.canopy.forEach(([px,,,top],i)=>i?ctx.lineTo(px,top):ctx.moveTo(px,top));
        for(const [px,,bottom] of vehicle.canopy.slice().reverse())ctx.lineTo(px,bottom);
        ctx.closePath();ctx.fill();ctx.stroke();continue;
      }
      ctx.save(); ctx.translate(x,y); ctx.rotate(rz);
      if (material === 'body' || material === 'glass') {
        const finish=ctx.createLinearGradient(0,-h/2,0,h/2);
        finish.addColorStop(0,material === 'body' ? '#526d70' : '#112536');
        finish.addColorStop(.55,material === 'body' ? color : '#315d70');
        finish.addColorStop(1,material === 'body' ? '#e4fff1' : '#a6d9df');
        ctx.fillStyle=finish;
      } else ctx.fillStyle=material==='trim'?(vehicle.id==='mars'?'#dfbd7f':'#98b6c9'):'#101725';
      ctx.strokeStyle = '#a7d7f066'; ctx.lineWidth = .018;
      if(material==='glass'&&['nova','sparrow','mars'].includes(vehicle.id)) {
        ctx.beginPath();ctx.ellipse(0,0,w/2,h/2,0,0,Math.PI*2);ctx.fill();ctx.stroke();
        ctx.strokeStyle='#b3e6ff99';ctx.beginPath();ctx.ellipse(.02,.015,w*.37,h*.33,0,.15,Math.PI*.85);ctx.stroke();
      } else {ctx.fillRect(-w/2,-h/2,w,h);ctx.strokeRect(-w/2,-h/2,w,h);}
      ctx.restore();
    }
    ctx.strokeStyle='#101c30';ctx.lineWidth=.018;
    ctx.beginPath();ctx.moveTo(-.95,.08);ctx.lineTo(-.85,-.12);ctx.lineTo(.48,-.12);ctx.lineTo(.62,.065);ctx.stroke();
    ctx.fillStyle='#1c293d';ctx.fillRect(-1.05,-.29,2.2,.09);
    ctx.fillStyle='#5ce4f5';ctx.fillRect(-.95,-.24,1.9,.022);
    ctx.fillStyle='#9bc5dc';ctx.fillRect(-.6,.01,.22,.018);
    ctx.fillStyle='#101b2b';
    for(let i=0;i<5;i++)ctx.fillRect(-1.12-i*.075,-.025,.025,.09);
    ctx.fillStyle='#030a17';ctx.fillRect(1.93,-.1,.2,.13);ctx.fillRect(-2.12,-.18,.16,.15);
    ctx.fillStyle='#b2f4ff';
    for(let i=0;i<3;i++)ctx.fillRect(2.06+i*.025,-.015,.012,.04);
    ctx.fillStyle='#fb438e';ctx.fillRect(-2.14,-.04,.06,.035);
    if(vehicle.id==='roadster') {
      ctx.fillStyle='#101827';ctx.fillRect(-.85,.17,.38,.3);
      ctx.fillStyle='#4b6074';ctx.fillRect(-.8,.26,.24,.025);ctx.fillRect(-.8,.32,.24,.025);
    }
    if(vehicle.id==='mars') {
      for(const x of [-1.38,0,1.38]) {
        ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,-.3,.49,0,Math.PI);ctx.arc(x,-.3,.405,Math.PI,0,true);ctx.closePath();ctx.fill();
        ctx.strokeStyle='#c5a572';ctx.lineWidth=.012;ctx.beginPath();ctx.arc(x,-.3,.46,0,Math.PI);ctx.stroke();
      }
      ctx.fillStyle=color;ctx.strokeStyle='#d2b47f';ctx.lineWidth=.01;ctx.beginPath();
      vehicle.roof.forEach(([x,,,top],i)=>i?ctx.lineTo(x,top):ctx.moveTo(x,top));
      for(const [x,,bottom] of vehicle.roof.slice().reverse())ctx.lineTo(x,bottom);
      ctx.closePath();ctx.fill();ctx.stroke();
      ctx.fillStyle='#c8ad7d';ctx.fillRect(-.1,.17,.03,.3);ctx.fillRect(-.83,.475,1.35,.017);
      ctx.strokeStyle='#5b6c7b';ctx.lineWidth=.022;
      for(const x of [-.69,.69]) {ctx.beginPath();ctx.moveTo(x-.32,-.3);ctx.lineTo(x,-.11);ctx.lineTo(x+.32,-.3);ctx.stroke();}
      ctx.fillStyle='#b2dcf2';for(let i=0;i<4;i++)ctx.fillRect(-1.75+i*.14,.272,.09,.01);
      ctx.fillStyle='#182338';ctx.beginPath();ctx.arc(-1.63,.24,.12,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#d7b371';ctx.lineWidth=.018;ctx.stroke();
      ctx.strokeStyle='#8495a9';ctx.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.moveTo(-1.63,.24);ctx.lineTo(-1.63+Math.cos(a)*.09,.24+Math.sin(a)*.09);}ctx.stroke();
    }
  }
  function drawWheel2d(ctx,x,y,radius,angle=0,style='road') {
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);
    const rubber=ctx.createRadialGradient(-.1,.1,.03,0,0,radius);
    rubber.addColorStop(0,'#364352');rubber.addColorStop(.75,'#151b29');rubber.addColorStop(1,'#070c15');
    ctx.fillStyle=rubber;ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#172438';ctx.beginPath();ctx.arc(0,0,radius*.72,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=style==='rover'?'#d5ad68':'#91a8c0';ctx.lineWidth=.017;ctx.beginPath();ctx.arc(0,0,radius*.75,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle=style==='rover'?'#e1bd81':'#a1bdd0';ctx.lineWidth=.019;ctx.beginPath();
    for(let i=0;i<10;i++) {
      const a=i*Math.PI/5;
      ctx.moveTo(Math.cos(a)*.075,Math.sin(a)*.075);
      ctx.lineTo(Math.cos(a+.14)*radius*.7,Math.sin(a+.14)*radius*.7);
    }
    ctx.stroke();
    if(style==='rover') {
      ctx.strokeStyle='#405062';ctx.lineWidth=.025;ctx.beginPath();
      for(let i=0;i<24;i++){const a=i*Math.PI/12;ctx.moveTo(Math.cos(a)*radius*.87,Math.sin(a)*radius*.87);ctx.lineTo(Math.cos(a+.045)*radius*.98,Math.sin(a+.045)*radius*.98);}
      ctx.stroke();ctx.fillStyle='#c9a667';ctx.beginPath();ctx.arc(0,0,.065,0,Math.PI*2);ctx.fill();
    }
    ctx.fillStyle='#64e9f7';ctx.beginPath();ctx.arc(0,0,.027,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  function mount({ language, onChange = () => {} }) {
    let selected = readSelection(), active = selected, last = '';
    const hosts = [];
    let live;
    function refresh() {
      const key = language() + selected.id + active.id;
      if (key === last) return;
      last = key;
      const en = language() === 'en', locale = en ? 'en' : 'tc';
      for (const { host, nextRun } of hosts) {
        const open = host.querySelector('details')?.open || false;
        const copy = selected[locale];
        host.innerHTML = `<details class="wf-garage" ${open ? 'open' : ''}><summary><span class="wf-garage-label">${nextRun ? (en ? 'NEXT RUN / GARAGE' : '下一趟 / 選擇車型') : (en ? 'GARAGE / CHOOSE A CAR' : '車庫 / 選擇車型')}</span><strong>${selected.name}</strong><span class="wf-garage-mini">${svg(selected)}</span></summary><div class="wf-garage-grid"></div><div class="wf-vehicle-detail"><div><strong>${copy.title}</strong><span>${copy.role}</span></div><p>${copy.tip}</p><p class="wf-vehicle-trade">${copy.trade}</p><div class="wf-vehicle-stats"></div><small>${en ? 'Performance relative to the original Roadster (100%).' : '數值為相對經典敞篷的性能（原版為 100%）。'}</small><p class="wf-vehicle-record-note">${en ? 'Each car has its own local records and ghost. Online leaderboard: Roadster only.' : '每台車各有本機紀錄與幽靈；線上排行榜限經典敞篷。'}</p></div></details>`;
        for (const vehicle of vehicles) {
          const button = document.createElement('button');
          button.type = 'button'; button.dataset.vehicle = vehicle.id;
          button.setAttribute('aria-pressed', String(vehicle === selected));
          button.innerHTML = `${svg(vehicle)}<span><strong>${vehicle.name}</strong><small>${vehicle[locale].role}</small></span><b>${vehicle.number}</b>`;
          button.addEventListener('click', () => {
            selected = vehicle;
            try { localStorage.setItem(KEY, vehicle.id); } catch (_) {}
            if (!nextRun && active !== selected) { active = selected; onChange(active); }
            refresh();
            host.querySelector('[data-vehicle="' + vehicle.id + '"]').focus({preventScroll:true});
          });
          host.querySelector('.wf-garage-grid').append(button);
        }
        const h = selected.handling;
        const metrics = [
          [en ? 'Engine output' : '引擎出力', h.motor], [en ? 'Roll response' : '翻滾反應', h.rotation],
          [en ? 'Spin settling' : '轉速收斂', h.damping], [en ? 'Jet thrust' : '噴射推力', h.thrust],
          [en ? 'Air endurance' : '空氣續航', 1/h.airUse],
        ];
        for (const [label,value] of metrics) {
          const row = document.createElement('div');
          row.innerHTML = `<span>${label}</span><meter aria-label="${label}" min="0" max="${Math.max(1.5,value)}" value="${value}"></meter><b>${Math.round(value*100)}%</b>`;
          host.querySelector('.wf-vehicle-stats').append(row);
        }
      }
      if (live) { live.textContent = active.name + ' / ' + active[locale].role; live.dataset.activeVehicle = active.id; }
    }
    return {
      get selected() { return selected; }, get active() { return active; },
      get surfaceReady() { return !!(roverSurface?.complete&&roverSurface.naturalWidth); },
      begin() { if (active !== selected) { active = selected; onChange(active); } refresh(); },
      attach(host, nextRun = false) { const slot = document.createElement('section'); slot.dataset.testid = nextRun ? 'vehicle-garage-review' : 'vehicle-garage'; host.append(slot); hosts.push({host:slot,nextRun}); last = ''; refresh(); },
      attachCoach(host) { live = document.createElement('div'); live.className = 'wf-vehicle-live'; host.prepend(live); last = ''; refresh(); },
      refresh,
    };
  }
  global.WallFlipGarage = Object.freeze({ vehicles, get, readSelection, tune, airControl, recordKey, svg, draw2d, drawWheel2d, mount });
})(globalThis);
