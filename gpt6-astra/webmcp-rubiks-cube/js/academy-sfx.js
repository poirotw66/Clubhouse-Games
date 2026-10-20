/**
 * Gated SFX bridge for Rubik's Cube Academy (classic script).
 * Dynamically imports gpt6-astra/shared/sfx.mjs; mute persists in localStorage.
 */
(function (root) {
  "use strict";

  const SFX_KEY = "rubiks-cube-academy:sfx:v1";

  function loadMuted() {
    try {
      const raw = localStorage.getItem(SFX_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.muted === "boolean") return parsed.muted;
      if (parsed && parsed.enabled === false) return true;
    } catch {
      /* ignore */
    }
    return false;
  }

  function saveMuted(muted) {
    try {
      localStorage.setItem(
        SFX_KEY,
        JSON.stringify({ version: 1, muted: Boolean(muted), updatedAt: Date.now() }),
      );
    } catch {
      /* quota */
    }
  }

  let muted = loadMuted();
  let api = null;
  let ready = false;

  function gate(fn) {
    return (...args) => {
      if (muted || !api) return;
      try {
        fn(...args);
      } catch {
        /* audio may fail before user gesture */
      }
    };
  }

  const CubeSfx = {
    KEY: SFX_KEY,
    get ready() {
      return ready;
    },
    isMuted() {
      return muted;
    },
    setMuted(next) {
      muted = Boolean(next);
      saveMuted(muted);
      return muted;
    },
    toggleMute() {
      return CubeSfx.setMuted(!muted);
    },
    playTurn: gate(() => {
      if (typeof api.playCubeTurn === "function") api.playCubeTurn();
      else api.playMove();
    }),
    playInspectTick: gate((n) => {
      if (typeof api.playInspectTick === "function") api.playInspectTick(n);
      else api.playSelect();
    }),
    playTimerStart: gate(() => {
      if (typeof api.playTimerStart === "function") api.playTimerStart();
      else api.playSelect();
    }),
    playTimerStop: gate(() => {
      if (typeof api.playTimerStop === "function") api.playTimerStop();
      else api.playError();
    }),
    playSolve: gate((isRecord) => {
      if (typeof api.playSolveComplete === "function") api.playSolveComplete(Boolean(isRecord));
      else if (isRecord) api.playWin();
      else api.playGoal();
    }),
  };

  root.CubeSfx = CubeSfx;

  // Resolve relative to the document (classic-script dynamic import).
  const url = new URL("../shared/sfx.mjs", root.location?.href || "http://localhost/");
  import(url.href)
    .then((mod) => {
      api = mod;
      ready = true;
    })
    .catch(() => {
      ready = false;
    });
})(typeof globalThis !== "undefined" ? globalThis : window);
