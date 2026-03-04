import { X } from 'lucide-react';

export function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto text-slate-200 shadow-2xl border border-slate-700 relative animate-in zoom-in-95 duration-200">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-slate-800 hover:bg-slate-700 rounded-full transition-colors"
        >
          <X className="w-5 h-5 text-slate-300" />
        </button>
        
        <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-white pr-8">最後一張牌 (Last Card / Crazy Eights)</h2>
        
        <div className="space-y-6 text-sm sm:text-base">
          <section>
            <h3 className="text-xl font-bold text-emerald-400 mb-2">概述 (Overview)</h3>
            <p className="leading-relaxed">
              最後一張牌（Last Card）泛指「指定牌可當百搭、先出完手牌者勝」的脫手牌戲，規則接近歐美的 Crazy Eights（瘋狂八）。玩家輪流出牌，需與牌堆頂張同花色或同點數，8 可指定下一張要跟的花色；無法出牌則抽牌。先把手牌出完者獲勝。
            </p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-emerald-400 mb-2">遊戲目標與計分 (Objective & Scoring)</h3>
            <p className="leading-relaxed mb-2"><strong>先把手牌全部出完</strong> 的玩家贏得該回合。</p>
            <p className="leading-relaxed">回合結束時，其他玩家手中未出完的牌將計算為罰分：</p>
            <ul className="list-disc pl-5 space-y-1 mt-2 text-slate-300">
              <li><strong>8</strong>：50 分</li>
              <li><strong>K, Q, J</strong>：10 分</li>
              <li><strong>A</strong>：1 分</li>
              <li><strong>其他數字牌</strong>：依牌面點數計分</li>
            </ul>
            <p className="leading-relaxed mt-2">當有玩家累積達到 <strong>100 分</strong> 時遊戲結束，總分最低的玩家獲得最終勝利！</p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-emerald-400 mb-2">回合流程 (Turn Flow)</h3>
            <ul className="list-disc pl-5 space-y-2 leading-relaxed">
              <li>每人發 5 張手牌，其餘為牌堆，牌面朝下。翻開一張作為起始牌。</li>
              <li>輪到的玩家可打出一張牌，需與棄牌堆頂張 <strong>同花色</strong> 或 <strong>同點數</strong>。</li>
              <li><strong>無法出牌時</strong>：從牌堆頂抽一張牌；若抽到的牌可出，可選擇立即打出。若仍不能出牌，則點擊「Pass Turn」過牌。</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-bold text-emerald-400 mb-2">特殊牌 (Special Cards)</h3>
            <ul className="list-disc pl-5 space-y-3 leading-relaxed">
              <li><strong className="text-yellow-400 text-lg">8 (百搭牌)</strong>：可隨時打出（無視目前花色/點數），打出後可 <strong>指定</strong> 下一家要跟的花色。</li>
              <li><strong className="text-yellow-400 text-lg">Q (跳過)</strong>：跳過下一家的回合。</li>
              <li><strong className="text-yellow-400 text-lg">A (反轉)</strong>：反轉出牌方向（順時針變逆時針，反之亦然）。</li>
              <li><strong className="text-yellow-400 text-lg">2 (抽 2 張)</strong>：下一家必須抽 2 張牌（若有多張 2 可疊加抽牌數，必須打出 2 來防禦，否則需點擊牌堆抽取累積的罰牌數量並結束該回合）。</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
