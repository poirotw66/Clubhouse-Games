import React, { useState } from 'react';
import { Scroll, ChevronLeft, ChevronRight } from 'lucide-react';

interface BushidoScrollItem {
  id: string;
  name: string;
  summary: string;
  quote: string;
  tag: string;
}

const BUSHIDO_SCROLLS: readonly BushidoScrollItem[] = [
  {
    id: 'calm',
    name: '靜心凝神',
    summary: '敵刃未至，莫動如山',
    quote: '心如止水，雙目洞悉暗器軌跡。勿受長短遲延所惑，唯以電光火石之瞬拔刃。',
    tag: '心法',
  },
  {
    id: 'direction',
    name: '破綻捕捉',
    summary: '上偏引左，下偏振右',
    quote: '暗器升空偏上者，引左刃自下而上挑擊；貼地沉降偏下者，振右刃橫掃千軍。',
    tag: '招式',
  },
  {
    id: 'see-through',
    name: '看破假相',
    summary: '佯攻若現，以靜制動',
    quote: '狡詰對手常以虛晃紅芒誘使早拔。見暗器消散於半空，切莫出鞘，看破即得高分。',
    tag: '洞察',
  },
  {
    id: 'zanshin',
    name: '殘心收刀',
    summary: '刀出必收，方應萬變',
    quote: '斬擊過後鋒芒不散，收刀入鞘方能迎接連綿攻勢。心神常存，百斬不殆。',
    tag: '步法',
  },
  {
    id: 'perfect-heal',
    name: '氣韻回流',
    summary: '完美一閃，金石療傷',
    quote: '精準卡入極致完美時空窗，刀鳴清越如鐘，可使護體元氣瞬間回復 15 點。',
    tag: '回氣',
  },
];

export const BushidoScrolls: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [index, setIndex] = useState(0);
  const current = BUSHIDO_SCROLLS[index];

  const prev = () => {
    setIndex((i) => (i - 1 + BUSHIDO_SCROLLS.length) % BUSHIDO_SCROLLS.length);
  };
  const next = () => {
    setIndex((i) => (i + 1) % BUSHIDO_SCROLLS.length);
  };

  return (
    <div
      className={`rounded-xl border border-emerald-500/20 bg-slate-950/80 p-3.5 backdrop-blur-md shadow-lg ${className}`}
    >
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
        <div className="flex items-center gap-1.5 text-emerald-400">
          <Scroll size={15} />
          <span className="font-display text-xs font-bold tracking-widest uppercase">
            心法大師錦囊
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={prev}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-800 text-slate-400 hover:text-white"
            aria-label="上一條心法"
          >
            <ChevronLeft size={13} />
          </button>
          <span className="text-[10px] text-slate-400 font-display">
            {index + 1}/{BUSHIDO_SCROLLS.length}
          </span>
          <button
            type="button"
            onClick={next}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-800 text-slate-400 hover:text-white"
            aria-label="下一條心法"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      <div className="mb-1 flex items-center gap-2">
        <span className="text-sm font-bold text-emerald-300 font-display">
          「{current.name}」
        </span>
        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950/70 text-emerald-400 border border-emerald-500/30">
          {current.tag}
        </span>
      </div>

      <div className="text-xs font-semibold text-slate-200 mb-1">
        {current.summary}
      </div>

      <p className="text-[11px] text-slate-400 leading-relaxed italic border-l-2 border-emerald-500/50 pl-2">
        {current.quote}
      </p>
    </div>
  );
};
