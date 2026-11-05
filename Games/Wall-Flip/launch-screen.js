/* Shared, keyboard-accessible launch experience for both rendering modes. */
window.WallFlipLaunch = {
  mount({ host, mode, onStart, onLanguage, onCourse, onBoard, onGhost }) {
    const old = mode === '3d' ? host.querySelector('.sheet') : null;
    const modes = document.getElementById('startModePick');
    const launch = document.createElement('div');
    launch.className = 'wf-launch';
    launch.innerHTML = `
      <section class="wf-launch-hero" aria-labelledby="launchHeadline">
        <p class="wf-launch-eyebrow" data-copy="brand">牆上翻滾 / WALL FLIP</p>
        <h1 id="launchHeadline"></h1><p class="wf-launch-intro" data-copy="intro"></p>
        <div class="wf-launch-orbit" aria-hidden="true"><span>360°</span><small>DEFY GRAVITY</small></div>
        <div class="wf-launch-caption"><span>01 / FIRST LANDING</span><strong data-copy="mission"></strong></div>
      </section>
      <section class="wf-launch-console" aria-label="Launch controls">
        <div class="wf-launch-console-top"><span data-copy="ready"></span><button type="button" class="wf-launch-lang"></button></div>
        <h2 data-copy="title"></h2><p class="wf-launch-description" data-copy="description"></p>
        <div class="wf-launch-mission"><span>01</span><div><strong data-copy="goal"></strong><p data-copy="goalHint"></p></div></div>
        <div class="wf-launch-modes"></div>
        <div class="wf-launch-course"></div>
        <div class="wf-launch-action"></div><p class="wf-launch-keyhint" data-copy="keyHint"></p>
        <details class="wf-launch-guide"><summary data-copy="guide"></summary><div class="wf-launch-guide-body"></div></details>
        <details class="wf-launch-guide wf-launch-achievements"><summary data-copy="achievements"></summary><div class="wf-launch-achievement-body"></div></details><div class="wf-launch-extras"></div>
      </section>`;
    host.append(launch);
    launch.querySelector('.wf-launch-modes').append(modes);
    modes.hidden = false;
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
        const key = [lang, course, ghost, ...achievements].join('|'); if (key === current) return; current = key;
        const en = lang === 'en';
        const copy = en ? {
          brand:'WALL FLIP / STUNT CLUB', headline:'Leave gravity behind.', intro:'Climb the wall. Own the sky. Stick the landing.', mission:'Your first clean landing starts here.', ready:'● READY FOR TAKEOFF', title:'One wall. One bold leap.', description:'Start with a safe landing. Chase the perfect flip next.', goal:'MISSION / LAND ON YOUR TIRES', goalHint:'Keep driving up the wall. Hold X on the overhang. Level out before touchdown.', keyHint:'SPACE to start · Touch controls on mobile', guide:'The 30-second flight guide', credit:'Inspired by tsuyatt.com 宙返りロードスター · Independent recreation.', achievements:'My stunt collection', ranking:'Leaderboard ↗', ghost:'Ghost ' + (ghost ? 'ON' : 'OFF'), start:'Launch my first run →'
        } : {
          brand:'牆上翻滾 / WALL FLIP', headline:'把地心引力，甩在身後。', intro:'衝上弧牆，翻過夜空。這次，用輪胎漂亮落地。', mission:'你的第一次完美著陸，從這裡開始。', ready:'● 發車準備完成', title:'一面牆，一次大膽起飛。', description:'先挑戰安全落地，再把下一次翻滾交給直覺。', goal:'首輪任務 / 用輪胎落地', goalHint:'油門一路按住，反翹時按 X 吸附；快落地時把車身扶正。', keyHint:'SPACE 開始 · 手機可用觸控操作', guide:'30 秒飛行指南', credit:'靈感致敬：tsuyatt.com 宙返りロードスター · 自製復刻', achievements:'我的特技成就', ranking:'排行榜 ↗', ghost:'幽靈 ' + (ghost ? '開啟' : '關閉'), start:'開始我的第一次起飛 →'
        };
        launch.querySelector('#launchHeadline').textContent=copy.headline;
        launch.querySelectorAll('[data-copy]').forEach(el => { if (copy[el.dataset.copy]) el.textContent=copy[el.dataset.copy]; });
        start.textContent=copy.start;
        launch.querySelector('.wf-launch-lang').textContent=en ? '中文' : 'EN';
        if (mode === '2d') {
          launch.querySelector('.wf-launch-course span').textContent=(en ? 'COURSE / ' : '賽道 / ') + course;
          const steps=en ? ['SPACE — Hold the throttle all the way up.', 'X — Hold suction on the overhang.', '← / → — One jet rolls; both push you upward (downward while inverted).', 'Land level on your tires, below 18 km/h.'] : ['SPACE — 油門一路按住，衝上弧牆。', 'X — 反翹段按住吸附，避免剝離。', '← / → — 單鍵翻滾、雙鍵向上推；倒掛時會推向地面。', '輪胎朝下、車身扶正，以低於 18 km/h 的速度著地。'];
          launch.querySelector('.wf-launch-achievement-body').textContent = achievements.join(' · ');
          guide.querySelector('ol').replaceChildren(...steps.map(text => { const li=document.createElement('li');li.textContent=text;return li; }));
        }
      }
    };
  }
};
