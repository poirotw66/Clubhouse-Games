import React, { useEffect, useState } from 'react';
import {
  type JuiceFxLevel,
  type JuiceSettings,
  loadJuiceSettings,
  saveJuiceSettings,
  subscribeJuiceSettings,
} from './juice.ts';

export interface JuiceSettingsPanelProps {
  /** Optional class for the outer fieldset. */
  className?: string;
  /** Compact single-row layout for dense game menus. */
  compact?: boolean;
  /** Hide the fieldset legend when the host already has a heading. */
  hideLegend?: boolean;
}

const FX_OPTIONS: { value: JuiceFxLevel; label: string }[] = [
  { value: 'full', label: '完整' },
  { value: 'low', label: '輕量' },
  { value: 'off', label: '無特效' },
];

/**
 * Drop-in controls for the shared `clubhouse:juice` preferences.
 * Games can mount this inside their own settings / rules dialog.
 */
export function JuiceSettingsPanel({
  className,
  compact = false,
  hideLegend = false,
}: JuiceSettingsPanelProps): React.ReactElement {
  const [settings, setSettings] = useState<JuiceSettings>(() => loadJuiceSettings());

  useEffect(() => subscribeJuiceSettings(setSettings), []);

  const setHaptics = (haptics: boolean) => {
    setSettings(saveJuiceSettings({ haptics }));
  };

  const setFx = (fx: JuiceFxLevel) => {
    setSettings(saveJuiceSettings({ fx }));
  };

  return (
    <fieldset
      className={className}
      data-juice-settings="1"
      style={{
        border: '1px solid rgba(45,212,191,0.4)',
        borderRadius: 10,
        padding: compact ? '10px 12px' : '12px 14px',
        margin: 0,
        minWidth: 0,
        background: 'rgba(4, 12, 22, 0.55)',
        boxShadow: 'inset 0 0 24px rgba(45,212,191,0.08), 0 0 18px rgba(45,212,191,0.12)',
      }}
    >
      {!hideLegend && (
        <legend
          style={{
            padding: '0 6px',
            fontSize: 14,
            fontWeight: 700,
            color: '#ecfeff',
            textShadow: '0 0 12px rgba(45,212,191,0.45)',
          }}
        >
          手感與特效
        </legend>
      )}
      <div
        style={{
          display: 'flex',
          flexDirection: compact ? 'row' : 'column',
          flexWrap: 'wrap',
          gap: compact ? 12 : 10,
          alignItems: compact ? 'center' : 'stretch',
          fontSize: 13,
        }}
      >
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            minHeight: 44,
            cursor: 'pointer',
            touchAction: 'manipulation',
          }}
        >
          <input
            type="checkbox"
            checked={settings.haptics}
            onChange={(e) => setHaptics(e.target.checked)}
            aria-label="觸覺震動"
            style={{ width: 18, height: 18 }}
          />
          <span>觸覺震動</span>
        </label>
        <div
          role="group"
          aria-label="特效強度"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            alignItems: 'center',
          }}
        >
          <span style={{ opacity: 0.8, marginRight: 4 }}>畫面特效</span>
          {FX_OPTIONS.map((opt) => {
            const active = settings.fx === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={active}
                onClick={() => setFx(opt.value)}
                style={{
                  minHeight: 44,
                  minWidth: 44,
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: active
                    ? '1px solid rgba(45,212,191,0.95)'
                    : '1px solid rgba(100,116,139,0.7)',
                  background: active ? 'rgba(45,212,191,0.28)' : 'rgba(15,23,42,0.45)',
                  boxShadow: active ? '0 0 18px rgba(45,212,191,0.35)' : 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  touchAction: 'manipulation',
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </fieldset>
  );
}

export default JuiceSettingsPanel;
