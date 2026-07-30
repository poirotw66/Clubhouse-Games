import { useCallback, useEffect, useRef, useState } from 'react';
import { BGM_TRACKS, getBgmUrl, pickRandomTrackIndex } from '../bgm';

const BGM_MUTED_KEY = 'koi-koi-bgm-muted';
const BGM_VOLUME = 0.35;

export function useBgm() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trackIndexRef = useRef(pickRandomTrackIndex(-1));
  const unlockedRef = useRef(false);
  const mutedRef = useRef(localStorage.getItem(BGM_MUTED_KEY) === 'true');
  const [muted, setMutedState] = useState(mutedRef.current);
  const [currentTitle, setCurrentTitle] = useState(BGM_TRACKS[trackIndexRef.current].title);

  const playTrack = useCallback((index: number) => {
    const track = BGM_TRACKS[index];
    trackIndexRef.current = index;
    setCurrentTitle(track.title);

    let audio = audioRef.current;
    if (!audio) {
      audio = new Audio();
      audio.loop = false;
      audio.volume = BGM_VOLUME;
      audioRef.current = audio;

      audio.addEventListener('ended', () => {
        playTrack(pickRandomTrackIndex(trackIndexRef.current));
      });
    }

    audio.src = getBgmUrl(track.file);
    audio.muted = mutedRef.current;
    if (!mutedRef.current && unlockedRef.current) {
      void audio.play().catch(() => {});
    }
  }, []);

  useEffect(() => {
    playTrack(trackIndexRef.current);
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, [playTrack]);

  const unlock = useCallback(() => {
    if (unlockedRef.current) return;
    unlockedRef.current = true;
    const audio = audioRef.current;
    if (audio && !mutedRef.current) {
      void audio.play().catch(() => {});
    }
  }, []);

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMutedState(next);
    localStorage.setItem(BGM_MUTED_KEY, String(next));

    const audio = audioRef.current;
    if (!audio) return;

    audio.muted = next;
    if (!next) {
      unlockedRef.current = true;
      void audio.play().catch(() => {});
    }
  }, []);

  return { muted, toggleMute, unlock, currentTitle };
}
