import { Player } from '../types';

export function Opponent({ position, player, isActive }: { position: 'top' | 'left' | 'right', player: Player, isActive: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-1.5 sm:gap-2 transition-all duration-300 ${isActive ? 'scale-110 drop-shadow-[0_0_15px_rgba(250,204,21,0.4)]' : 'opacity-60 grayscale-[0.3]'}`}>
      <div className={`px-2 py-0.5 sm:px-4 sm:py-1.5 rounded-full text-[10px] sm:text-sm font-bold shadow-md transition-colors whitespace-nowrap flex items-center gap-1.5 sm:gap-2 ${isActive ? 'bg-yellow-400 text-yellow-900 ring-4 ring-yellow-400/50 animate-pulse' : 'bg-black/40 text-white'}`}>
        <span>{player.name}</span>
        <span className={`px-1.5 py-0.5 rounded text-[9px] sm:text-xs font-mono ${isActive ? 'bg-yellow-900/20' : 'bg-black/40 text-emerald-300'}`}>{player.score}</span>
      </div>
      <div className="flex -space-x-3 sm:-space-x-6">
        {player.hand.map((_, i) => (
          <div key={i} className={`w-5 h-8 sm:w-8 sm:h-12 rounded bg-indigo-700 border shadow-sm transition-all ${isActive ? 'border-yellow-400/80 shadow-[0_0_10px_rgba(250,204,21,0.5)]' : 'border-white/20'}`}></div>
        ))}
      </div>
      <div className={`text-[9px] sm:text-xs font-mono px-1.5 py-0.5 rounded-full whitespace-nowrap transition-colors ${isActive ? 'text-yellow-200 bg-black/60' : 'text-emerald-200 bg-black/40'}`}>
        {player.hand.length} cards
      </div>
    </div>
  );
}
