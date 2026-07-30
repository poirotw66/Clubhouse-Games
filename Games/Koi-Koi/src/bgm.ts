export interface BgmTrack {
  id: string;
  title: string;
  file: string;
}

export const BGM_TRACKS: BgmTrack[] = [
  { id: 'yume', title: '夢のあとさき', file: '夢のあとさき.mp3' },
  { id: 'tatami', title: '畳の上の嵐', file: '畳の上の嵐.mp3' },
  { id: 'nishi', title: '西日の窓辺', file: '西日の窓辺.mp3' },
  { id: 'shunkan', title: '研ぎ澄ます、この一瞬', file: '研ぎ澄ます、この一瞬.mp3' },
];

export function getBgmUrl(filename: string): string {
  return `${import.meta.env.BASE_URL}mp3/${encodeURIComponent(filename)}`;
}

export function pickRandomTrackIndex(exclude: number): number {
  if (BGM_TRACKS.length <= 1) return 0;
  let next = exclude;
  while (next === exclude) {
    next = Math.floor(Math.random() * BGM_TRACKS.length);
  }
  return next;
}
