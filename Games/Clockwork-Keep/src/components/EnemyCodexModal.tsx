import type { ReactElement } from 'react';
import { ENEMY_DEFS, type EnemyType } from '../game/constants';

interface EnemyCodexModalProps {
  onClose: () => void;
}

interface EnemyCodexEntry {
  type: EnemyType;
  name: string;
  role: string;
  description: string;
  counters: string;
  weakness: string;
}

const CODEX_DATA: Record<EnemyType, EnemyCodexEntry> = {
  grunt: {
    type: 'grunt',
    name: '步兵玩偶',
    role: '基礎突擊部隊',
    description: '標準發條機關步兵，無護甲，移動平穩。通常成群結隊出現作為先鋒。',
    counters: '十字弩、齒輪磨盤均能輕鬆處決。',
    weakness: '所有塔種皆可有效傷害。',
  },
  runner: {
    type: 'runner',
    name: '疾走鼠',
    role: '極速突破斥候',
    description: '發條齒輪疾走鼠，體型小巧但移動速度極快（2.6 格/秒），極易在防禦漏洞處溜走。',
    counters: '部署冰霜噴罐進行群體減速，或以電磁線圈連鎖連擊擊殺。',
    weakness: '生命極低，懼怕連鎖與群體緩速。',
  },
  ironclad: {
    type: 'ironclad',
    name: '鐵皮兵',
    role: '重裝前線盾衛',
    description: '外層包覆厚實鍛造鋼甲（護甲 6），每下攻擊固定扣減 6 點傷害。低傷害射擊幾乎無效！',
    counters: '必須使用破甲彈簧錘或高等迫擊砲。十字弩建議走破甲分支（A 分支穿甲釘）。',
    weakness: '移動緩慢，懼怕高額破甲單發爆發。',
  },
  kite: {
    type: 'kite',
    name: '紙鳶',
    role: '高空飛行偵察機',
    description: '飛行機關，完全無視地面迷宮與城牆路障，直接沿直線由入口飛向出口！',
    counters: '地面專用塔（磨盤、彈簧錘）完全無法對空！必須佈署十字弩、電弧線圈或迫擊砲。',
    weakness: '血量偏薄，對空塔命中即可迅速摧毀。',
  },
  gearbug: {
    type: 'gearbug',
    name: '齒輪蟲',
    role: '裝甲掠襲蟲',
    description: '兼具 4 點護甲與 1.9 格/秒高速的機關甲蟲，常出現在中後期混編波次。',
    counters: '電弧線圈跳躍電擊或彈簧錘重擊。',
    weakness: '成群時懼怕濺射與連鎖閃電。',
  },
  bloater: {
    type: 'bloater',
    name: '腫脹兵',
    role: '超高耐久蒸氣肉盾',
    description: '巨大的蓄壓蒸氣機關人，擁有高達 120 點生命值（無護甲），會替後排單位吸收大量單體傷害。',
    counters: '迫擊砲範圍轟炸與齒輪磨盤貼身碾壓。',
    weakness: '移動極慢（0.85 格/秒），懼怕長時間迷宮拉扯與範圍持續碾壓。',
  },
  shellbug: {
    type: 'shellbug',
    name: '鐵殼甲蟲',
    role: '重裝甲飛行要塞',
    description: '融合飛行能力與 5 點厚實護甲的空中噩夢！防空不足或穿甲不足時極容易失守。',
    counters: '迫擊砲（高單發傷害）與高等電磁線圈，或升級滿級破甲十字弩。',
    weakness: '懼怕高階對空單發重傷害。',
  },
  boss: {
    type: 'boss',
    name: '發條泰坦 (首領)',
    role: '毀滅級巨型機關',
    description: '重型發條泰坦領主，擁有 600+ 巨額生命與 10 點極致護甲，突破防線將直接扣除 5 點城池生命！',
    counters: '全城發條超頻（按 F 鍵）集中爆發！迷宮步數拉到極致，彈簧錘破甲配合迫擊砲重擊。',
    weakness: '移動緩慢，在超頻火力與極限迷宮中會被持續瓦解。',
  },
};

const ENEMY_ORDER: EnemyType[] = [
  'grunt',
  'runner',
  'ironclad',
  'kite',
  'gearbug',
  'bloater',
  'shellbug',
  'boss',
];

export function EnemyCodexModal({ onClose }: EnemyCodexModalProps): ReactElement {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ck-codex-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[88vh] overflow-y-auto bg-[#1c1409] border border-amber-900/60 rounded-2xl p-5 shadow-2xl text-amber-50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4 border-b border-amber-900/50 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">📖</span>
              <h2 id="ck-codex-title" className="text-xl font-bold text-amber-100">
                發條敵軍圖鑑手冊
              </h2>
            </div>
            <p className="text-xs text-amber-200/70 mt-1">
              敵軍特性、護甲機制與戰術剋制指南。掌握情報以構築完美的城防迷宮。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-lg hover:bg-white/10 text-amber-200/80 flex items-center justify-center text-lg"
            aria-label="關閉圖鑑"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          {ENEMY_ORDER.map((type) => {
            const def = ENEMY_DEFS[type];
            const info = CODEX_DATA[type];
            return (
              <div
                key={type}
                className="rounded-xl border border-amber-900/40 bg-black/30 p-3 flex flex-col sm:flex-row gap-3 items-start"
              >
                <div className="flex items-center gap-3 shrink-0">
                  <img
                    src={`${import.meta.env.BASE_URL}enemies/${type}.jpg`}
                    alt={info.name}
                    className="w-14 h-14 rounded-xl object-cover border border-amber-900/50"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="sm:hidden">
                    <p className="font-bold text-amber-100 text-sm">{info.name}</p>
                    <p className="text-xs text-amber-400">{info.role}</p>
                  </div>
                </div>

                <div className="flex-1 min-w-0 text-xs">
                  <div className="hidden sm:flex items-center justify-between mb-1">
                    <p className="font-bold text-amber-100 text-sm">
                      {info.name}
                      <span className="ml-2 text-xs font-normal text-amber-400">· {info.role}</span>
                    </p>
                    <div className="flex items-center gap-2 font-mono text-[11px] text-amber-300">
                      <span>❤ {def.hp}</span>
                      <span>🛡️ {def.armor}</span>
                      <span>⚡ {def.speed}格/s</span>
                      {def.flying && <span className="text-sky-300">🚀飛行</span>}
                    </div>
                  </div>

                  <div className="sm:hidden flex items-center gap-2 font-mono text-[11px] text-amber-300 mb-1.5">
                    <span>❤ {def.hp}</span>
                    <span>🛡️ {def.armor}</span>
                    <span>⚡ {def.speed}格/s</span>
                    {def.flying && <span className="text-sky-300">🚀飛行</span>}
                  </div>

                  <p className="text-amber-200/80 leading-relaxed mb-1.5">{info.description}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] pt-1 border-t border-amber-900/30">
                    <p className="text-rose-300/90">
                      <span className="font-bold">弱點：</span> {info.weakness}
                    </p>
                    <p className="text-emerald-300/90">
                      <span className="font-bold">應對方案：</span> {info.counters}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 font-bold text-sm min-h-[44px]"
        >
          返回戰場
        </button>
      </div>
    </div>
  );
}
