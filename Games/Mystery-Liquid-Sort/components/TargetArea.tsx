import React from 'react';
import { Order } from '../types';
import { CheckCircle2, Lock } from 'lucide-react';

interface TargetAreaProps {
  orders: Order[];
}

export const TargetArea: React.FC<TargetAreaProps> = ({ orders }) => {
  return (
    <div className="w-full flex flex-col items-center mb-4 md:mb-6 px-3 md:px-4">
      {/* Header - Unified Card Style */}
      <div className="w-full max-w-lg flex justify-between items-center mb-3 bg-white/10 backdrop-blur-xl rounded-2xl px-4 py-2.5 border border-white/20 shadow-lg">
        <span className="text-white/90 text-xs md:text-sm font-bold tracking-wider uppercase drop-shadow-md">Customer Orders</span>
        <div className="flex items-center gap-2 bg-white/10 rounded-xl px-2.5 py-1 border border-white/20">
          <span className="text-white/90 font-mono text-xs md:text-sm tabular-nums">
            {orders.filter(o => o.isCompleted).length} / {orders.length}
          </span>
        </div>
      </div>

      {/* Orders Shelf - Unified Card Design */}
      <div className="w-full max-w-lg bg-white/10 backdrop-blur-xl rounded-2xl p-4 md:p-5 border border-white/20 shadow-lg">
        <div className="flex justify-center items-center gap-2.5 md:gap-3 min-h-[4.5rem] md:min-h-[5.5rem]">
          {orders.map((order) => {
            return (
              <div key={order.id} className="relative group">
                {/* Order Container */}
                <div 
                  className={`
                    relative w-12 h-16 md:w-14 md:h-20 rounded-xl flex flex-col items-center justify-end overflow-hidden transition-all duration-500
                    ${order.isCompleted 
                      ? 'bg-white/20 shadow-lg scale-100 opacity-100 border-2 border-white/30' 
                      : order.isLocked
                        ? 'bg-white/5 border-2 border-white/10 opacity-60'
                        : 'bg-white/5 border-2 border-dashed opacity-80'
                    }
                  `}
                  style={{
                    borderColor: !order.isLocked && !order.isCompleted ? order.color : undefined
                  }}
                >
                  {/* LOCKED STATE */}
                  {order.isLocked && (
                    <div className="absolute inset-0 flex items-center justify-center">
                       <Lock className="w-4 h-4 md:w-5 md:h-5 text-white/40" />
                    </div>
                  )}

                  {/* UNLOCKED & INCOMPLETE: Requested Color Indicator */}
                  {!order.isCompleted && !order.isLocked && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center opacity-60 animate-pulse">
                        <div className="w-5 h-5 md:w-6 md:h-6 rounded-full mb-1 shadow-md" style={{ backgroundColor: order.color }}></div>
                        <span className="text-[9px] md:text-[10px] text-white font-bold uppercase tracking-wider">Need</span>
                    </div>
                  )}

                  {/* COMPLETED STATE: Bottle Icon */}
                  {order.isCompleted && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pt-1.5 md:pt-2 z-10 animate-fade-in-up">
                      <div 
                        className="w-5 h-8 md:w-6 md:h-10 rounded-sm mb-0.5 md:mb-1 shadow-md"
                        style={{ backgroundColor: order.color }}
                      ></div>
                      {/* Cap */}
                      <div className="w-7 h-1.5 md:w-8 md:h-2 bg-gray-800 rounded-sm absolute top-3 md:top-4 shadow-md"></div>
                    </div>
                  )}

                  {/* Handle (Visual for Bag Look) */}
                  <div className={`absolute -top-3 w-8 h-6 rounded-full border-[3px] z-0 transition-colors
                      ${order.isCompleted ? 'border-white/30' : 'opacity-10'}`} 
                      style={{ borderColor: !order.isLocked && !order.isCompleted ? order.color : undefined }}
                  />
                </div>

                {/* Checkmark Overlay */}
                {order.isCompleted && (
                  <div className="absolute -bottom-1.5 -right-1.5 md:-bottom-2 md:-right-2 bg-green-500 rounded-full text-white shadow-lg z-20 animate-bounce-short border-2 border-white/20">
                    <CheckCircle2 size={14} className="md:w-4 md:h-4" fill="white" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};