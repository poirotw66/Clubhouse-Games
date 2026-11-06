/* One vehicle catalogue drives handling, showroom silhouettes and both game views. */
(function (global) {
  'use strict';
  const KEY = 'wallflip.vehicle.v1';
  // Parts are [width, height, depth, x, y, z, material, rotationZ].
  // Every shell uses the original stunt chassis, wheelbase and collision envelope.
  const vehicles = [
    {
      id: 'roadster', name: 'ROADSTER', number: '01',
      handling: { motor: 1, rotation: 1, damping: 1, thrust: 1, airUse: 1 },
      tc: { title: '經典敞篷', role: '均衡入門', tip: '熟悉的原版手感，適合練習每一種挑戰。', trade: '各項能力均衡，沒有額外性能加成。' },
      en: { title: 'Classic roadster', role: 'Balanced', tip: 'Original handling. A dependable starting point for every contract.', trade: 'Balanced across the board, with no extra performance boost.' },
      parts: [[4.3,.36,1.94,0,-.2,0,'body'], [1.5,.3,.9,-.55,.3,0,'glass'], [.55,.26,.85,.42,.3,0,'glass',.3], [1.6,.16,1.6,-1.3,.18,0,'body'], [.3,.08,1.5,-2.1,.3,0,'dark']],
    },
    {
      id: 'sparrow', name: 'SPARROW', number: '02',
      handling: { motor: 1.1, rotation: 1.4, damping: .9, thrust: .92, airUse: 1.2 },
      tc: { title: '飛雀方程式', role: '靈活翻滾', tip: '翻滾反應更快，適合衝圈數；提早放開單側噴射。', trade: '推力較弱、耗氣較快，落地前需要更多修正。' },
      en: { title: 'Open-wheel racer', role: 'Agile flipper', tip: 'Fast roll response rewards ambitious flips. Release the single jet early.', trade: 'Weaker lift and faster air use leave less room for late corrections.' },
      parts: [[3.3,.3,.92,-.25,-.22,0,'body'], [1.15,.18,.5,1.45,-.18,0,'body'], [.65,.18,.62,-.35,.04,0,'glass'], [.15,.4,.75,-.8,.2,0,'dark'], [.4,.09,1.94,-1.9,.42,0,'body'], [.25,.09,1.9,2,-.3,0,'dark'], [.08,.32,.08,-1.85,.22,-.6,'dark'], [.08,.32,.08,-1.85,.22,.6,'dark']],
    },
    {
      id: 'atlas', name: 'ATLAS', number: '03',
      handling: { motor: .92, rotation: .75, damping: 1.5, thrust: 1.08, airUse: .75 },
      tc: { title: '磐石拉力', role: '穩定省氣', tip: '轉速收得快、噴射更省氣，適合精準著陸與續航挑戰。', trade: '加速和翻滾較慢，連續多圈需要提早開始。' },
      en: { title: 'Rally hatchback', role: 'Stable & efficient', tip: 'Rotation settles quickly and jets conserve air. Built for controlled landings.', trade: 'Slower acceleration and roll response demand earlier setup for multiple flips.' },
      parts: [[4.15,.46,1.95,0,-.16,0,'body'], [2.1,.45,1.65,-.2,.24,0,'body'], [1.8,.23,1.68,-.2,.32,0,'glass'], [2,.08,1.72,-.2,.5,0,'body'], [.3,.3,1.94,-1.95,-.06,0,'dark'], [.25,.24,1.94,2,-.14,0,'dark'], [.15,.06,1.85,-1.38,.48,0,'body']],
    },
    {
      id: 'nova', name: 'NOVA', number: '04',
      handling: { motor: 1.04, rotation: .95, damping: 1.05, thrust: 1.28, airUse: 1.4 },
      tc: { title: '新星噴射', role: '強力升空', tip: '雙鍵噴射有更強升力，適合延長飛行與挽救下墜。', trade: '耗氣最快；倒掛時強力噴射也會加速墜落。' },
      en: { title: 'Jet prototype', role: 'Powerful lift', tip: 'Stronger twin jets extend flight and brake a steep descent.', trade: 'The fastest air drain. Powerful jets also push you down harder when inverted.' },
      parts: [[4.2,.22,1.85,0,-.2,0,'body'], [2.2,.18,1.6,-.55,-.01,0,'body'], [1.65,.38,.85,-.15,.2,0,'glass'], [1.3,.07,2.02,-1.1,.05,0,'dark'], [.55,.25,.07,-1.5,.34,-.7,'body'], [.55,.25,.07,-1.5,.34,.7,'body'], [.32,.14,1.8,1.9,-.12,0,'body']],
    },
  ].map(v => Object.freeze({ ...v, handling: Object.freeze(v.handling), parts: Object.freeze(v.parts.map(Object.freeze)) }));
  Object.freeze(vehicles);
  const get = id => vehicles.find(v => v.id === id) || vehicles[0];
  function readSelection() {
    try { return get(localStorage.getItem(KEY)); } catch (_) { return vehicles[0]; }
  }
  function tune(base, id) {
    const h = get(id).handling;
    return { ...base, MOTOR_A: base.MOTOR_A * h.motor, MOTOR_P: base.MOTOR_P * h.motor,
      ANG: base.ANG * h.rotation, ROLL_DAMP: base.ROLL_DAMP * h.damping, SPIN_DAMP: base.SPIN_DAMP * h.damping,
      THRUST: base.THRUST * h.thrust, AIR_JET: base.AIR_JET * h.airUse, AIR_SUCK: base.AIR_SUCK * h.airUse };
  }
  function recordKey(base, id) {
    const vehicle = get(id);
    return base + (vehicle.id === 'roadster' ? '' : '.vehicle.' + vehicle.id);
  }
  function svg(vehicle) {
    const parts = vehicle.parts.map(([w,h,,x,y,,material,rz=0]) =>
      `<rect x="${x-w/2}" y="${-y-h/2}" width="${w}" height="${h}" rx=".035" fill="${material === 'body' ? 'currentColor' : material === 'glass' ? '#314f61' : '#17232c'}" transform="rotate(${-rz*180/Math.PI} ${x} ${-y})"/>`).join('');
    const wheels = [-1.38,1.38].map(x => `<circle cx="${x}" cy=".3" r=".36" fill="#0a1119" stroke="#7c9aa6" stroke-width=".06"/><circle cx="${x}" cy=".3" r=".16" fill="#a2bac2"/>`).join('');
    return `<svg viewBox="-2.6 -1.05 5.2 2" aria-hidden="true"><path d="M-2.5 .69H2.5" stroke="#45616d" stroke-width=".02"/>${parts}${wheels}<rect x="2.03" y="-.03" width=".12" height=".08" fill="#ffe3a7"/></svg>`;
  }
  function draw2d(ctx, vehicle, color) {
    for (const [w,h,,x,y,,material,rz=0] of vehicle.parts) {
      ctx.save(); ctx.translate(x,y); ctx.rotate(rz);
      if (material === 'body' || material === 'glass') {
        const finish=ctx.createLinearGradient(0,-h/2,0,h/2);
        finish.addColorStop(0,material === 'body' ? '#526d70' : '#112536');
        finish.addColorStop(.55,material === 'body' ? color : '#315d70');
        finish.addColorStop(1,material === 'body' ? '#e4fff1' : '#a6d9df');
        ctx.fillStyle=finish;
      } else ctx.fillStyle='#17232c';
      ctx.fillRect(-w/2,-h/2,w,h);
      ctx.strokeStyle = '#c5fff044'; ctx.lineWidth = .025; ctx.strokeRect(-w/2,-h/2,w,h);
      ctx.restore();
    }
    ctx.fillStyle = '#ffe4aa'; ctx.fillRect(2.03,-.01,.12,.08);
    ctx.fillStyle = '#ff725e'; ctx.fillRect(-2.12,-.06,.1,.08);
    ctx.fillStyle = '#a7ffdf'; ctx.fillRect(-1.25,-.3,2.65,.025);
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
          row.innerHTML = `<span>${label}</span><meter aria-label="${label}" min="0" max="1.5" value="${value}"></meter><b>${Math.round(value*100)}%</b>`;
          host.querySelector('.wf-vehicle-stats').append(row);
        }
      }
      if (live) { live.textContent = active.name + ' / ' + active[locale].role; live.dataset.activeVehicle = active.id; }
    }
    return {
      get selected() { return selected; }, get active() { return active; },
      begin() { if (active !== selected) { active = selected; onChange(active); } refresh(); },
      attach(host, nextRun = false) { const slot = document.createElement('section'); slot.dataset.testid = nextRun ? 'vehicle-garage-review' : 'vehicle-garage'; host.append(slot); hosts.push({host:slot,nextRun}); last = ''; refresh(); },
      attachCoach(host) { live = document.createElement('div'); live.className = 'wf-vehicle-live'; host.prepend(live); last = ''; refresh(); },
      refresh,
    };
  }
  global.WallFlipGarage = Object.freeze({ vehicles, get, readSelection, tune, recordKey, svg, draw2d, mount });
})(globalThis);
