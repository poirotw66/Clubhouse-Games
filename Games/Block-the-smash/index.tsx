/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useRef } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { createRoot } from 'react-dom/client';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    position: 'fixed' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    backgroundImage: [
      'linear-gradient(rgba(0,0,0,0.72), rgba(0,0,0,0.85))',
      `url(${import.meta.env.BASE_URL}menu-bg.jpg)`,
    ].join(', '),
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    overflow: 'hidden',
    fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  },
  header: {
    flexShrink: 0,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    // Left padding clears the fixed back-to-menu pill, which otherwise sits
    // on top of the title.
    padding: '12px 20px 12px 130px',
    background: 'rgba(0,0,0,0.55)',
    zIndex: 20,
    borderBottom: '1px solid #222',
  },
  gameWrapper: {
    flex: 1,
    position: 'relative' as const,
    width: '100%',
    height: '100%',
    background: '#000',
    overflow: 'hidden',
  },
  iframe: {
    width: '100%',
    height: '100%',
    border: 'none',
    display: 'block',
    backgroundColor: '#000',
  },
  buttonGroup: {
    display: 'flex',
    gap: '8px',
  },
  button: (active: boolean) => ({
    background: active ? '#ffffff' : 'rgba(255, 255, 255, 0.05)',
    color: active ? '#000000' : '#ffffff',
    border: '1px solid ' + (active ? '#ffffff' : 'rgba(255, 255, 255, 0.1)'),
    padding: '10px 16px',
    minHeight: 44,
    borderRadius: '100px',
    fontSize: '13px',
    fontWeight: '600' as const,
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    outline: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    touchAction: 'manipulation' as const,
  }),
  title: {
    color: '#fff',
    fontSize: '18px',
    fontWeight: '800',
    letterSpacing: '-0.5px',
    marginRight: '20px',
  },
  modalOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'rgba(0, 0, 0, 0.85)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'auto' as const,
    zIndex: 50,
  },
  modal: {
    backgroundColor: '#111',
    backgroundImage: [
      'linear-gradient(rgba(17,17,17,0.82), rgba(17,17,17,0.9))',
      `url(${import.meta.env.BASE_URL}menu-bg.jpg)`,
    ].join(', '),
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '24px',
    padding: '32px',
    width: '480px',
    maxWidth: '90%',
    color: '#fff',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    animation: 'fadeIn 0.2s ease-out',
  },
  modalHeader: {
    fontSize: '24px',
    fontWeight: '700' as const,
    marginBottom: '8px',
    background: 'linear-gradient(to right, #fff, #aaa)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    margin: '0 0 8px 0',
  },
  modalSub: {
    color: '#888',
    marginBottom: '24px',
    fontSize: '14px',
    lineHeight: '1.5',
    marginTop: 0,
  },
  modeBtn: {
    flex: 1,
    padding: '16px',
    background: '#fff',
    color: '#000',
    border: 'none',
    borderRadius: '12px',
    fontWeight: '700' as const,
    cursor: 'pointer',
    fontSize: '18px',
    fontFamily: 'monospace',
    transition: 'transform 0.1s',
  },
  loadingContainer: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#000',
    zIndex: 5,
  },
  loadingText: {
    color: '#666',
    fontSize: '14px',
    letterSpacing: '2px',
    textTransform: 'uppercase' as const,
    animation: 'pulse 1.5s infinite',
  },
};

function App() {
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const [handedness, setHandedness] = useState<'left' | 'right'>('right');
  const [muted, setMuted] = useState(false);
  const [difficulty, setDifficulty] = useState<'easy' | 'normal' | 'hard'>('normal');
  const [isLoading, setIsLoading] = useState(true);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  const BEST_KEY = 'clubhouse:block-the-smash-best-v2';

  const readBest = (diff: string, balls: number): number | null => {
    try {
      const parsed = JSON.parse(localStorage.getItem(BEST_KEY) || '{}') as Record<string, unknown>;
      const v = parsed[`${diff}:${balls}`];
      return typeof v === 'number' && Number.isFinite(v) ? v : null;
    } catch {
      return null;
    }
  };

  const formatBest = (balls: number): string => {
    const best = readBest(difficulty, balls);
    return best == null ? '尚無紀錄' : `最佳 ${best}%`;
  };

  const toggleHandedness = () => {
    setHandedness((prev) => (prev === 'left' ? 'right' : 'left'));
  };

  const toggleMute = () => {
    setMuted((prev) => !prev);
  };

  const startMatch = (count: number) => {
    setShowDisclaimer(false);
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: 'START_MATCH', payload: { balls: count, difficulty } },
        '*',
      );
    }
  };

  useEffect(() => {
    const iframe = iframeRef.current;
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'PAUSE_GAME', payload: showDisclaimer }, '*');
      iframe.contentWindow.postMessage({ type: 'SET_HANDEDNESS', payload: handedness }, '*');
      iframe.contentWindow.postMessage({ type: 'SET_MUTE', payload: muted }, '*');
    }
  }, [showDisclaimer, handedness, muted, isLoading]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GAME_READY') setIsLoading(false);
      if (event.data?.type === 'SHOW_MENU') {
        setShowDisclaimer(true);
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({ type: 'PAUSE_GAME', payload: true }, '*');
        }
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const handleIFrameLoad = () => {
    setIsLoading(false);
    const iframe = iframeRef.current;
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'PAUSE_GAME', payload: showDisclaimer }, '*');
      iframe.contentWindow.postMessage({ type: 'SET_HANDEDNESS', payload: handedness }, '*');
      iframe.contentWindow.postMessage({ type: 'SET_MUTE', payload: muted }, '*');
    }
  };

  const diffBtn = (id: 'easy' | 'normal' | 'hard', label: string) => (
    <button
      type="button"
      key={id}
      style={{
        ...styles.modeBtn,
        flex: 1,
        fontSize: '16px',
        padding: '12px',
        background: difficulty === id ? '#fff' : 'rgba(255,255,255,0.08)',
        color: difficulty === id ? '#000' : '#ccc',
        border: difficulty === id ? 'none' : '1px solid rgba(255,255,255,0.15)',
      }}
      onClick={() => setDifficulty(id)}
    >
      {label}
    </button>
  );

  return (
    <div style={styles.container}>
      <BackToMenu />
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
        @keyframes pulse { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
      `}</style>

      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={styles.title}>羽毛球接殺</div>
        </div>

        <div style={styles.buttonGroup}>
          <button type="button" style={styles.button(false)} onClick={toggleMute}>
            {muted ? '靜音' : '音效'}
          </button>
          <div style={{ width: 1, height: 20, background: '#333', margin: '0 8px' }} />
          <button type="button" style={styles.button(false)} onClick={toggleHandedness}>
            {handedness === 'left' ? '左手' : '右手'}
          </button>
        </div>
      </div>

      <div style={styles.gameWrapper}>
        {isLoading && (
          <div style={styles.loadingContainer}>
            <div style={styles.loadingText}>載入球場…</div>
          </div>
        )}

        <iframe
          ref={iframeRef}
          src={`${import.meta.env.BASE_URL}game.html`}
          style={{ ...styles.iframe, visibility: isLoading ? 'hidden' : 'visible' }}
          title="Game Canvas"
          sandbox="allow-scripts allow-pointer-lock allow-same-origin allow-forms"
          onLoad={handleIFrameLoad}
        />
      </div>

      {showDisclaimer && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h2 style={styles.modalHeader}>接殺訓練</h2>
            <div style={{ ...styles.modalSub, fontSize: '15px', color: '#ccc' }}>
              <p style={{ marginBottom: '12px' }}>
                <strong>目標：</strong>拖曳移動球拍，在殺球來到時點擊揮拍擋回。會分成熱身→加壓→混戰三波。
              </p>

              <p style={{ marginBottom: '10px' }}>
                <strong>難度</strong>
              </p>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                {diffBtn('easy', '簡單')}
                {diffBtn('normal', '普通')}
                {diffBtn('hard', '困難')}
              </div>

              <p style={{ marginBottom: '12px' }}>
                <strong>球數</strong>
              </p>

              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                {([10, 25, 50] as const).map((count) => (
                  <button
                    key={count}
                    type="button"
                    style={{
                      ...styles.modeBtn,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                    }}
                    onClick={() => startMatch(count)}
                  >
                    <span>{count} 球</span>
                    <span style={{ fontSize: 11, opacity: 0.75, fontWeight: 500, textTransform: 'none' }}>
                      {formatBest(count)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const root = createRoot(document.getElementById('root') || document.body);
root.render(<App />);
