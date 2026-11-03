import React from 'react';

interface RingCockpitProps {
  children: React.ReactNode;
  leftWing: React.ReactNode;
  rightWing: React.ReactNode;
  mobileTicker?: React.ReactNode;
  keypadHud?: React.ReactNode;
  inBout: boolean;
}

export const RingCockpit: React.FC<RingCockpitProps> = ({
  children,
  leftWing,
  rightWing,
  mobileTicker,
  keypadHud,
  inBout,
}) => {
  return (
    <div className="relative mx-auto w-full max-w-7xl px-2 sm:px-4">
      {/* Mobile tactical ticker above arena */}
      {inBout && mobileTicker && (
        <div className="mb-3 lg:hidden">
          {mobileTicker}
        </div>
      )}

      {/* Main 3-Column Arena Cockpit */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] xl:grid-cols-[310px_1fr_310px] gap-4 items-start">
        {/* Left Wing (Desktop) */}
        <div className="hidden lg:block sticky top-4">
          {leftWing}
        </div>

        {/* Center Arena Canvas Container with Corner Posts */}
        <div className="relative flex flex-col items-center">
          {/* Arena Frame with Corner Posts & Ring Rope Aesthetics */}
          <div className="relative w-full rounded-3xl p-1 bg-gradient-to-b from-neutral-800 via-neutral-900 to-neutral-950 shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-white/10">
            {/* Left Red Corner Post Glow */}
            <div className="absolute -left-2 top-4 bottom-4 w-2 rounded-full bg-gradient-to-b from-rose-500 via-rose-600 to-rose-700 shadow-[0_0_15px_rgba(244,63,94,0.6)] pointer-events-none hidden sm:block" />
            {/* Right Blue Corner Post Glow */}
            <div className="absolute -right-2 top-4 bottom-4 w-2 rounded-full bg-gradient-to-b from-blue-500 via-blue-600 to-blue-700 shadow-[0_0_15px_rgba(59,130,246,0.6)] pointer-events-none hidden sm:block" />

            {/* Canvas and overlay container */}
            <div className="relative w-full rounded-2xl overflow-hidden bg-neutral-950 shadow-inner">
              {children}
            </div>
          </div>
        </div>

        {/* Right Wing (Desktop) */}
        <div className="hidden lg:block sticky top-4">
          {rightWing}
        </div>
      </div>

      {/* Keypad HUD below arena */}
      {keypadHud && (
        <div className="mt-6 hidden sm:block">
          {keypadHud}
        </div>
      )}
    </div>
  );
};
