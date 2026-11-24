import type { Card } from '../types';
import { rateDeal } from './deck';

self.onmessage = (event: MessageEvent<Card[][]>) => {
  self.postMessage(rateDeal(event.data));
};
