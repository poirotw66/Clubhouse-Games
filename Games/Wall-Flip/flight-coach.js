/* Skill objectives and coaching read the simulation; they never control it or alter scores. */
(function (global) {
  'use strict';
  const TAU = Math.PI * 2;
  const limits = Object.freeze({ tilt: 25 * Math.PI / 180, descent: 5, spin: 2.5 });
  function tiltOf(angle, pitch = 0) {
    const wrapped = ((angle % TAU) + TAU) % TAU;
    return Math.max(Math.min(wrapped, TAU - wrapped), Math.abs(pitch));
  }
  function orientation(state) {
    const roll = state.mode === 'road' ? 0 : state.roll;
    const pitch = state.mode === 'road' ? state.th : state.pitch;
    return {roll, pitch, tilt:tiltOf(roll,pitch), level:Math.cos(roll)*Math.cos(pitch)};
  }
  function advance(completed, result) {
    const level = Math.max(0, Math.min(3, Math.floor(Number(completed) || 0)));
    if (!result.win || level === 3) return level;
    const achieved = level === 0 || (level === 1 && result.rolls >= 1) ||
      (level === 2 && result.soft >= 20 && result.level >= 15);
    return level + (achieved ? 1 : 0);
  }
  function analyse(state) {
    const tilt = Math.max(0, state.tilt || 0);
    const descent = Math.max(0, -(state.vy || 0));
    const spin = Math.abs(state.rw || 0);
    const airborne = state.mode === 'air';
    let stage = 'runup', action = 'drive';
    if (state.mode === 'landed') { stage = 'landed'; action = 'landed'; }
    else if (state.mode === 'crash') { stage = 'crash'; action = state.reason || 'tilt'; }
    else if (airborne) {
      stage = state.vy > 0 ? 'climb' : 'descent';
      if (state.air <= 0) action = 'empty';
      else if (tilt > limits.tilt) action = 'level';
      else if (spin > limits.spin) action = 'damp';
      else if (descent > limits.descent) action = 'brake';
      else action = stage === 'climb' ? 'coast' : 'hold';
    } else if (state.u >= 0) {
      stage = 'wall'; action = state.th > Math.PI / 2 ? 'stick' : 'prepare';
    }
    return { stage, action, tilt, descent, spin,
      // This is a current-state envelope, not a probability or impact prediction.
      aligned: airborne && tilt <= limits.tilt,
      slow: airborne && descent <= limits.descent,
      settled: airborne && spin <= limits.spin,
    };
  }
  const words = {
    tc: {
      label:'飛行駕照', goals:['01 安全著陸','02 翻滾著陸','03 精準著陸','飛行駕照已完成'],
      targets:['用輪胎成功落地','翻滾至少 1 圈，並成功落地','落地柔軟 ≥20/30、水平 ≥15/20','自由挑戰：把三項技巧串成一趟'],
      stages:{runup:'01 加速助跑',wall:'02 攀上弧牆',climb:'03 起飛翻滾',descent:'04 準備落地',landed:'著陸成功',crash:'這次先記住一件事'},
      actions:{drive:'按住油門一路上牆，先別用噴射器。',prepare:'繼續油門；彎過頭頂前準備按住吸附。',stick:'反翹段：油門＋吸附一起按住，直到離牆。',level:'用單側噴射把車身轉正；接近水平就放開。',damp:'停止單側翻滾，讓轉速收住；先求穩再求圈數。',brake:'輪胎已朝下：按 B 或雙鍵噴射減緩下墜，留意空氣。',coast:'姿態已扶正；還在上升，放開噴射保留空氣。',hold:'保持輪胎朝下，放開單側噴射，穩住迎接地面。',empty:'空氣用盡：放開噴射；下一輪少做一次修正。',landed:'漂亮落地。下一趟試著收得更穩。',fall:'下次先練吸附：反翹段持續按住 X，再追翻滾。',wall:'下次先留出離牆距離，再開始翻滾。',tilt:'下次提早轉正，輪胎朝下後放開單側噴射。',hard:'下次更早扶正，再用雙鍵噴射減速；別等到貼地。'},
      keys:{drive:'SPACE / W',prepare:'SPACE ＋ 準備 X',stick:'SPACE ＋ X',level:'← 或 → / A 或 D',damp:'放開 ← →',brake:'B / ← ＋ →',coast:'放開 ← →',hold:'保持姿態',empty:'重新規劃用氣'},
      tilt:'姿態',descent:'下墜',spin:'轉速',live:'目前狀態，不代表落地保證',fold:'收起教練',unfold:'展開教練',passed:'駕照任務通過',retry:'帶著這個提示再試 →',continue:'挑戰下一項 →',practice:'本輪練習重點',next:'下一項',mastered:'三項技巧完成，接著挑戰更高分。',checkpoint:'助跑 → 上牆 → 起飛 → 落地',
    },
    en: {
      label:'FLIGHT LICENSE',goals:['01 Clean landing','02 Flip & land','03 Precision landing','Flight license complete'],
      targets:['Land successfully on your tires','Complete at least one roll and land','Land with SOFT ≥20/30 and LEVEL ≥15/20','Free flight: link all three skills in one run'],
      stages:{runup:'01 Build speed',wall:'02 Climb the wall',climb:'03 Airborne',descent:'04 Landing approach',landed:'Touchdown confirmed',crash:'One thing to try next'},
      actions:{drive:'Hold the throttle all the way up. Save the jets for flight.',prepare:'Keep driving. Get ready to hold suction over the overhang.',stick:'Overhang: hold throttle + suction until you leave the wall.',level:'Use one jet to roll upright. Release it as you reach level.',damp:'Release the single jet to settle rotation. Stability before rolls.',brake:'Tires down: hold B or both jets to slow descent. Watch your air.',coast:'Aligned and still climbing. Release the jets to save air.',hold:'Keep tires down. Release the single jet and settle for touchdown.',empty:'Out of air. Next run, make fewer corrections.',landed:'Clean touchdown. Try a softer, flatter landing next run.',fall:'Next run: hold suction over the entire overhang before chasing rolls.',wall:'Next run: clear the wall before starting a roll.',tilt:'Next run: level out earlier and release the single jet when upright.',hard:'Next run: level out earlier, then hold B or both jets to slow descent.'},
      keys:{drive:'SPACE / W',prepare:'SPACE + prepare X',stick:'SPACE + X',level:'← or → / A or D',damp:'Release ← →',brake:'B / ← + →',coast:'Release ← →',hold:'Keep level',empty:'Plan your air'},
      tilt:'Tilt',descent:'Descent',spin:'Spin',live:'Current state, not an impact prediction',fold:'Minimize coach',unfold:'Expand coach',passed:'License objective cleared',retry:'Try that adjustment →',continue:'Try the next skill →',practice:'This run’s practice target',next:'Next skill',mastered:'All three skills cleared. Chase a higher score.',checkpoint:'Run-up → Wall → Launch → Land',
    }
  };
  function mount({ language, onRetry, mode, club, garage, onUpload, canUpload = () => false }) {
    const key = 'wallflip.flightLicense.v1';
    let completed = 0;
    try { completed = Math.max(0, Math.min(3, Math.floor(Number(localStorage.getItem(key)) || 0))); } catch (_) {}
    let target = completed, result = null, unlocked = false, compact = true;
    const root = document.createElement('section');
    root.className = 'wf-flight-coach compact'; root.hidden = true; root.dataset.testid = 'flight-coach';
    root.setAttribute('aria-label','Flight coach');
    root.innerHTML = '<header><span data-flight-license></span><button type="button" data-flight-toggle aria-expanded="true">−</button></header><div class="wf-flight-body"><div class="wf-flight-target"></div><p class="wf-flight-target-detail"></p><div class="wf-flight-checkpoints" aria-hidden="true"></div><div class="wf-flight-instruction" aria-live="polite"><strong data-flight-stage></strong><p data-flight-action></p></div><kbd data-flight-keys></kbd><div class="wf-flight-metrics"><span data-coach-metric="tilt"></span><span data-coach-metric="descent"></span><span data-coach-metric="spin"></span></div><small data-flight-caveat></small></div>';
    document.body.append(root);
    const review = document.createElement('aside'); review.className='wf-flight-review'; review.hidden=true; review.dataset.testid='flight-review';
    review.innerHTML='<span data-review-label></span><strong data-review-title></strong><p data-review-tip></p><button type="button" data-coach-retry></button>';
    const reviewContainer = mode === '3d' ? document.getElementById('result') : document.body;
    reviewContainer.append(review);
    const upload = document.createElement('button');
    upload.type='button'; upload.className='wf-upload-score'; upload.hidden=true; upload.dataset.testid='upload-score';
    upload.addEventListener('click', () => onUpload?.());
    review.append(upload);
    club?.attachCoach(root.querySelector('.wf-flight-body'), review);
    garage?.attachCoach(root.querySelector('.wf-flight-body'));
    garage?.attach(review, true);
    const $ = selector => root.querySelector(selector);
    const text = (el, value) => { if (el.textContent !== value) el.textContent = value; };
    const strings = () => words[language() === 'en' ? 'en' : 'tc'];
    $('[data-flight-toggle]').addEventListener('click', () => {
      compact = !compact; root.classList.toggle('compact',compact); $('[data-flight-toggle]').setAttribute('aria-expanded',String(!compact));
      $('[data-flight-toggle]').blur();
    });
    review.addEventListener('click', event => event.stopPropagation());
    review.querySelector('button').addEventListener('click', () => { onRetry(); review.querySelector('button').blur(); });
    function begin(record=true) { club?.begin(record); target=completed;result=null;unlocked=false;review.hidden=true; }
    function finish(outcome, record=true) {
      if (result) return;
      result = { ...outcome };
      club?.finish(result, record);
      const next = record ? advance(completed,result) : completed;
      unlocked = next > completed; completed=next;
      if (unlocked) { try { localStorage.setItem(key,String(completed)); } catch (_) {} }
    }
    function render(state, { active, reviewing, blocked=false } = {}) {
      root.hidden=!active || blocked; review.hidden=!reviewing || blocked || !result;
      const w=strings();
      upload.hidden=!result?.win || !canUpload();
      upload.textContent=language()==='en' ? 'Upload this score' : '上傳這次成績';
      club?.render(state);
      garage?.refresh();
      if (!root.hidden) {
        const a=analyse(state), level=Math.min(target,3);
        root.dataset.flightStage=a.stage; root.dataset.missionLevel=String(level); root.dataset.mode=mode;
        text($('[data-flight-license]'),w.label+' · '+Math.min(completed,3)+'/3');
        text($('.wf-flight-target'),w.goals[level]);text($('.wf-flight-target-detail'),w.targets[level]);
        text($('.wf-flight-checkpoints'),w.checkpoint);
        text($('[data-flight-stage]'),w.stages[a.stage]);text($('[data-flight-action]'),w.actions[a.action] || w.actions.tilt);
        text($('[data-flight-keys]'),w.keys[a.action] || '');
        if(garage?.active.handling.landingAssist&&state.mode==='air'&&a.action!=='empty') {
          text($('[data-flight-action]'),language()==='en'?'Release roll to level out. Hold X / ↓ for fast descent, or B / both jets for a gentle descent. Braking slows you near the ground.':'放開翻滾先回正；按 X／↓ 快降，B／雙鍵穩降，近地面會自動減速。');
          text($('[data-flight-keys]'),language()==='en'?'X / ↓ descend · B land':'X / ↓ 快降 · B 穩降');
        }
        const airborne=state.mode==='air'; root.classList.toggle('airborne',airborne);
        const values=[['tilt',a.tilt*180/Math.PI,25,'°',a.aligned],['descent',a.descent*3.6,18,' km/h',a.slow],['spin',a.spin,2.5,' rad/s',a.settled]];
        for(const [name,value,limit,unit,ok] of values){const el=$('[data-coach-metric="'+name+'"]');text(el,w[name]+' '+value.toFixed(name==='spin'?1:0)+unit+' / '+limit+unit);el.classList.toggle('within',ok);}
        text($('[data-flight-caveat]'),w.live);
        $('[data-flight-toggle]').setAttribute('aria-expanded',String(!compact));
        text($('[data-flight-toggle]'),compact?'+':'−'); $('[data-flight-toggle]').setAttribute('aria-label',compact?w.unfold:w.fold);
      }
      if (!review.hidden) {
        review.dataset.missionLevel=String(completed);review.classList.toggle('cleared',unlocked);
        text(review.querySelector('[data-review-label]'),unlocked?w.passed:w.practice);
        text(review.querySelector('[data-review-title]'),w.goals[Math.min(target,3)]);
        let tip;
        if(unlocked) tip=completed===3?w.mastered:w.next+' / '+w.targets[completed];
        else if(!result.win) tip=w.actions[result.reason] || w.actions.tilt;
        else if(target===1) tip=language()==='en'?'Landing secured. Add one controlled roll high above the ground next run.':'落地已經穩住。下次在高空多完成一圈，提早收住轉速。';
        else if(target===2) tip=language()==='en'?'Aim for a softer, flatter touchdown. Level out and reduce descent earlier.':'下次更早扶正、降低下墜，爭取柔軟 20、水平 15。';
        else tip=w.mastered;
        text(review.querySelector('[data-review-tip]'),tip);
        text(review.querySelector('button'),unlocked?w.continue:w.retry);
      }
    }
    return {begin,finish,render};
  }
  global.WallFlipFlight=Object.freeze({tiltOf,orientation,analyse,advance,limits,mount});
})(globalThis);
