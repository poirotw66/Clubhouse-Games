/// <reference types="vite/client" />

import type { LionWorld } from './engine/LionWorld';

declare global {
  interface Window {
    __lionWorld?: LionWorld;
  }
}

export {};
