import React, { ReactNode } from 'react';

interface TestTubeRackProps {
  children: ReactNode;
}

/**
 * Aesthetic laboratory rack shelf for test tubes.
 * Grounds the bottles with an authentic alchemy/chemistry test-tube rack stand.
 */
export const TestTubeRack: React.FC<TestTubeRackProps> = ({ children }) => {
  return (
    <div className="relative flex flex-col items-center pt-8">
      {/* Test Tubes in this row */}
      <div className="relative z-10 flex items-end justify-center gap-x-4 md:gap-x-6 pb-2">
        {children}
      </div>

      {/* Wooden / Brass Test Tube Rack Base with tactile mahogany texture */}
      <div
        className="w-full max-w-md h-4 rounded-full border-t border-amber-200/40 shadow-[0_4px_16px_rgba(0,0,0,0.7)] flex items-center justify-around px-4 pointer-events-none -mt-1 z-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(${import.meta.env.BASE_URL ?? '/'}rack-wood.jpg)`,
        }}
      >
        <div className="w-full h-[1px] bg-white/20" />
      </div>
    </div>
  );
};
