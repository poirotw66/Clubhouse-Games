/* Shared, keyboard-accessible launch experience for both rendering modes. */
window.WallFlipLaunch = {
  mount({ host, mode, onStart, onLanguage, onCourse, onBoard, onGhost, club, garage }) {
    const old = mode === '3d' ? host.querySelector('.sheet') : null;
    const modes = document.getElementById('startModePick');
    const launch = document.createElement('div');
    launch.className = 'wf-launch';
    launch.innerHTML = `
      <section class="wf-launch-hero" aria-labelledby="launchHeadline">
        <p class="wf-launch-eyebrow" data-copy="brand">牆上翻滾 / WALL FLIP</p>
        <h1 id="launchHeadline"></h1><p class="wf-launch-intro" data-copy="intro"></p>
        <canvas class="wf-showroom-2d" width="800" height="400" aria-label="Selected vehicle"></canvas>
        <div class="wf-launch-caption"><span>09 / NIGHT DISTRICT</span><strong data-copy="mission"></strong></div>
      </section>
      <section class="wf-launch-console" aria-label="Launch controls">
        <div class="wf-launch-console-top"><span data-copy="ready"></span><button type="button" class="wf-launch-lang"></button></div>
        <h2 data-copy="title"></h2><p class="wf-launch-description" data-copy="description"></p>
        <div class="wf-launch-primary"><div class="wf-launch-action"></div><p class="wf-launch-keyhint" data-copy="keyHint"></p></div>
        <div class="wf-launch-modes"></div>
        <div class="wf-launch-course"></div>
        <details class="wf-launch-guide"><summary data-copy="guide"></summary><div class="wf-launch-guide-body"></div></details>
        <details class="wf-launch-guide wf-launch-achievements"><summary data-copy="achievements"></summary><div class="wf-launch-achievement-body"></div></details><div class="wf-launch-extras"></div>
      </section>`;
    host.append(launch);
    launch.querySelector('.wf-launch-modes').append(modes);
    modes.hidden = false;
    if (garage) {
      const slot = document.createElement('div');
      launch.querySelector('.wf-launch-modes').before(slot);
      garage.attach(slot);
    }
    if (club) {
      const slot = document.createElement('div');
      launch.querySelector('.wf-launch-course').after(slot);
      club.attachLaunch(slot);
    }
    const action = launch.querySelector('.wf-launch-action');
    const guide = launch.querySelector('.wf-launch-guide-body');
    const extras = launch.querySelector('.wf-launch-extras');
    let start;
    if (old) {
      start = old.querySelector('#startBtn');
      action.append(start);
      for (const selector of ['ol', '#startHint']) { const node = old.querySelector(selector); if (node) guide.append(node); }
      for (const selector of ['#dailyBtn', '#ghostBtn', '#boardBtn', '#dailyInfo', '#startBest']) { const node = old.querySelector(selector); if (node) extras.append(node); }
      launch.querySelector('.wf-launch-achievement-body').append(old.querySelector('#achBox'));
      old.hidden = true;
    } else {
      start = document.createElement('button'); start.type = 'button'; start.id = 'launchStart'; action.append(start);
      const course = launch.querySelector('.wf-launch-course');
      course.innerHTML = '<button type="button" data-direction="-1" aria-label="Previous course">←</button><span></span><button type="button" data-direction="1" aria-label="Next course">→</button>';
      course.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { onCourse(Number(b.dataset.direction)); b.blur(); }));
      guide.innerHTML = '<ol></ol>';
      for (const [label, callback] of [['ranking', onBoard], ['ghost', onGhost]]) {
        const button = document.createElement('button'); button.type='button'; button.dataset.copy=label;
        button.addEventListener('click', () => { callback(); button.blur(); }); extras.append(button);
      }
    }
    start.addEventListener('click', e => { e.stopPropagation(); onStart(); start.blur(); });
    // In 3D the old backdrop starts on click; intentional controls own their events.
    launch.addEventListener('click', e => e.stopPropagation());
    launch.querySelector('.wf-launch-lang').addEventListener('click', () => onLanguage());
    const credit = document.createElement('p'); credit.dataset.copy='credit'; guide.append(credit);
    let current = '';
    return {
      update(lang, course, ghost, achievements = []) {
        club?.refresh();
        garage?.refresh();
        const key = [lang, course, ghost, garage?.active.id, club?.paint.id, ...achievements].join('|'); if (key === current) return; current = key;
        const en = lang === 'en';
        const copy = en ? {
          brand:'NIGHT DISTRICT / WALL FLIP', headline:'Wall Flip.', intro:'Neon streets below. Open sky above. Make the landing count.', mission:'Your first clean landing starts here.', ready:'● READY FOR TAKEOFF', title:'Ready to fly?', description:'Hold the throttle. Stick to the wall. Level out and brake before touchdown.', keyHint:'W / SPACE throttle · X suction · ← → roll · B brake', guide:'The 30-second flight guide', credit:'Inspired by tsuyatt.com 宙返りロードスター · Independent recreation.', achievements:'My stunt collection', ranking:'Leaderboard ↗', ghost:'Ghost ' + (ghost ? 'ON' : 'OFF'), start:'Launch this run →'
        } : {
          brand:'夜航特技俱樂部 / WALL FLIP', headline:'牆上翻滾', intro:'霓虹之下起跑，翻過城市天際線。輪胎朝下，漂亮收場。', mission:'你的第一次完美著陸，從這裡開始。', ready:'● 發車準備完成', title:'選好座駕，準備起飛。', description:'油門衝上牆，反翹時吸附。離牆後扶正車身，再煞降落地。', keyHint:'W / SPACE 油門 · X 吸附 · ← → 翻滾 · B 煞降', guide:'30 秒飛行指南', credit:'靈感致敬：tsuyatt.com 宙返りロードスター · 自製復刻', achievements:'我的特技成就', ranking:'排行榜 ↗', ghost:'幽靈 ' + (ghost ? '開啟' : '關閉'), start:'帶著挑戰起飛 →'
        };
        launch.querySelector('#launchHeadline').textContent=copy.headline;
        launch.querySelectorAll('[data-copy]').forEach(el => { if (copy[el.dataset.copy]) el.textContent=copy[el.dataset.copy]; });
        start.textContent=copy.start;
        launch.querySelector('.wf-launch-caption strong').textContent=garage ? garage.active.name+' / '+garage.active[en?'en':'tc'].title : copy.mission;
        const preview=launch.querySelector('.wf-showroom-2d');
        preview.hidden=mode!=='2d';
        if(mode==='2d' && garage) {
          const ctx=preview.getContext('2d'); ctx.clearRect(0,0,800,400);
          ctx.save(); ctx.translate(400,225);ctx.scale(135,-135);
          ctx.fillStyle='#030b1655';ctx.beginPath();ctx.ellipse(0,-.72,2.4,.1,0,0,Math.PI*2);ctx.fill();
          for(const x of [-1.38,1.38])window.WallFlipGarage.drawWheel2d(ctx,x,-.3,.36);
          window.WallFlipGarage.draw2d(ctx,garage.active,club?.paint.color || '#a4e8d3');ctx.restore();
        }
        launch.querySelector('.wf-launch-lang').textContent=en ? '中文' : 'EN';
        if (mode === '2d') {
          launch.querySelector('.wf-launch-course span').textContent=(en ? 'COURSE / ' : '賽道 / ') + course;
          const steps=en ? ['SPACE — Hold the throttle all the way up.', 'X — Hold suction on the overhang.', '← / → — One jet rolls; both push you upward (downward while inverted).', 'Land level on your tires, below 18 km/h.'] : ['SPACE — 油門一路按住，衝上弧牆。', 'X — 反翹段按住吸附，避免剝離。', '← / → — 單鍵翻滾；扶正後按 B 或雙鍵噴射減緩下墜。', '輪胎朝下、車身扶正，以低於 18 km/h 的速度著地。'];
          launch.querySelector('.wf-launch-achievement-body').textContent = achievements.join(' · ');
          guide.querySelector('ol').replaceChildren(...steps.map(text => { const li=document.createElement('li');li.textContent=text;return li; }));
        }
      }
    };
  }
};
