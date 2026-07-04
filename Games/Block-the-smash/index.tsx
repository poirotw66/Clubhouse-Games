/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useRef } from 'react';
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
    background: '#000',
    overflow: 'hidden',
    fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  },
  header: {
    flexShrink: 0,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 20px',
    background: '#000',
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
    padding: '6px 16px',
    borderRadius: '100px',
    fontSize: '13px',
    fontWeight: '600' as const,
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    outline: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
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
    background: '#111',
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

  const [gameHtml, setGameHtml] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  const toggleHandedness = () => {
    setHandedness((prev) => (prev === 'left' ? 'right' : 'left'));
  };

  const toggleMute = () => {
    setMuted((prev) => !prev);
  };

  const startMatch = (count: number) => {
    setShowDisclaimer(false);
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 'START_MATCH', payload: count }, '*');
    }
  };

  useEffect(() => {
    const iframe = iframeRef.current;
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'PAUSE_GAME', payload: showDisclaimer }, '*');
      iframe.contentWindow.postMessage({ type: 'SET_HANDEDNESS', payload: handedness }, '*');
      iframe.contentWindow.postMessage({ type: 'SET_MUTE', payload: muted }, '*');
    }
  }, [showDisclaimer, handedness, muted, gameHtml]);

  useEffect(() => {
    let isMounted = true;
    const baseUrl = import.meta.env.BASE_URL;
    const url = `${baseUrl}init/gemini3.html`;

    const loadGame = async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to load game');
        let html = await response.text();

        const baseTag = `<base href="${baseUrl}init/">`;
        if (html.includes('<head')) {
          html = html.replace(/<head[^>]*>/i, `$&${baseTag}`);
        } else {
          html = `${baseTag}${html}`;
        }

        if (isMounted) {
          setGameHtml(html);
          setIsLoading(false);
        }
      } catch (e) {
        console.error(e);
        if (isMounted) {
          setGameHtml(
            '<div style="color:white;display:flex;height:100%;justify-content:center;align-items:center;font-family:sans-serif;">Failed to load game engine.</div>',
          );
          setIsLoading(false);
        }
      }
    };

    loadGame();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleIFrameLoad = () => {
    const iframe = iframeRef.current;
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'PAUSE_GAME', payload: showDisclaimer }, '*');
      iframe.contentWindow.postMessage({ type: 'SET_HANDEDNESS', payload: handedness }, '*');
      iframe.contentWindow.postMessage({ type: 'SET_MUTE', payload: muted }, '*');
    }
  };

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
        @keyframes pulse { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
      `}</style>

      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={styles.title}>BADMINTON DEFENDER</div>
        </div>

        <div style={styles.buttonGroup}>
          <button type="button" style={styles.button(false)} onClick={toggleMute}>
            {muted ? 'SOUND OFF' : 'SOUND ON'}
          </button>
          <div style={{ width: 1, height: 20, background: '#333', margin: '0 8px' }} />
          <button type="button" style={styles.button(false)} onClick={toggleHandedness}>
            {handedness === 'left' ? 'LEFT HAND' : 'RIGHT HAND'}
          </button>
        </div>
      </div>

      <div style={styles.gameWrapper}>
        {(isLoading || !gameHtml) && (
          <div style={styles.loadingContainer}>
            <div style={styles.loadingText}>Initializing System...</div>
          </div>
        )}

        {!isLoading && gameHtml && (
          <iframe
            ref={iframeRef}
            srcDoc={gameHtml}
            style={styles.iframe}
            title="Game Canvas"
            sandbox="allow-scripts allow-pointer-lock allow-same-origin allow-forms"
            onLoad={handleIFrameLoad}
          />
        )}
      </div>

      {showDisclaimer && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h2 style={styles.modalHeader}>DEFENSE DRILL</h2>
            <div style={{ ...styles.modalSub, fontSize: '15px', color: '#ccc' }}>
              <p style={{ marginBottom: '12px' }}>
                <strong>Objective:</strong> Return the shuttlecocks! Don&apos;t let them pass.
              </p>

              <p style={{ marginBottom: '24px' }}>
                <strong>Select Drill Duration:</strong>
              </p>

              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <button type="button" style={styles.modeBtn} onClick={() => startMatch(10)}>
                  10 BALLS
                </button>
                <button type="button" style={styles.modeBtn} onClick={() => startMatch(25)}>
                  25 BALLS
                </button>
                <button type="button" style={styles.modeBtn} onClick={() => startMatch(50)}>
                  50 BALLS
                </button>
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
