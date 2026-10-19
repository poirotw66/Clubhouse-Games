import type { ReactElement } from 'react';
import {
  COSMETIC_CATALOG,
  UPGRADE_COST,
  UPGRADE_LABELS,
  UPGRADE_MAX,
  type CosmeticId,
  type MetaSave,
  type UpgradeId,
} from '../engine/progress';

const UPGRADE_ORDER: UpgradeId[] = [
  'powerDuration',
  'startShield',
  'magnetBonus',
  'dashCooldown',
  'nearMissBonus',
];

const COSMETIC_ORDER: CosmeticId[] = ['cyan', 'magenta', 'lime', 'ice', 'gold'];

interface MetaHubProps {
  meta: MetaSave;
  onBuyUpgrade: (id: UpgradeId) => void;
  onBuyCosmetic: (id: CosmeticId) => void;
  onEquipCosmetic: (id: CosmeticId) => void;
  onClaimMission: (id: string) => void;
  onClose: () => void;
}

export function MetaHub({
  meta,
  onBuyUpgrade,
  onBuyCosmetic,
  onEquipCosmetic,
  onClaimMission,
  onClose,
}: MetaHubProps): ReactElement {
  return (
    <div
      className="howto-shell"
      role="dialog"
      aria-modal="true"
      aria-label="車庫與任務"
      onClick={onClose}
    >
      <div className="meta-card" onClick={(e) => e.stopPropagation()}>
        <div className="meta-header">
          <h2 className="font-display text-2xl neon-text">車庫</h2>
          <p className="meta-credits">
            霓虹幣 <strong>{meta.credits.toLocaleString('zh-Hant')}</strong>
          </p>
        </div>

        <section className="meta-section" aria-label="每日任務">
          <h3 className="meta-section-title">今日任務</h3>
          <ul className="mission-list">
            {meta.missions.map((m) => {
              const done = m.progress >= m.target;
              return (
                <li key={m.id} className="mission-row">
                  <div className="mission-info">
                    <div className="mission-label">{m.label}</div>
                    <div className="mission-bar">
                      <div
                        className="mission-fill"
                        style={{ width: `${Math.min(100, (m.progress / m.target) * 100)}%` }}
                      />
                    </div>
                    <div className="mission-meta">
                      {Math.min(m.progress, m.target)} / {m.target} ・ 獎勵 {m.reward}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="mission-claim"
                    disabled={!done || m.claimed}
                    onClick={() => onClaimMission(m.id)}
                  >
                    {m.claimed ? '已領' : done ? '領取' : '進行中'}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="meta-section" aria-label="永久升級">
          <h3 className="meta-section-title">永久升級</h3>
          <ul className="upgrade-list">
            {UPGRADE_ORDER.map((id) => {
              const level = meta.upgrades[id];
              const max = UPGRADE_MAX[id];
              const maxed = level >= max;
              const cost = maxed ? 0 : UPGRADE_COST[id][level];
              const canBuy = !maxed && meta.credits >= cost;
              const info = UPGRADE_LABELS[id];
              return (
                <li key={id} className="upgrade-row">
                  <div>
                    <div className="upgrade-name">
                      {info.name}{' '}
                      <span className="upgrade-lv">
                        Lv.{level}/{max}
                      </span>
                    </div>
                    <div className="upgrade-desc">{info.desc}</div>
                  </div>
                  <button
                    type="button"
                    className="upgrade-buy"
                    disabled={!canBuy}
                    onClick={() => onBuyUpgrade(id)}
                  >
                    {maxed ? '滿級' : `${cost} 幣`}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="meta-section" aria-label="塗裝解鎖">
          <h3 className="meta-section-title">車體塗裝</h3>
          <div className="cosmetic-grid">
            {COSMETIC_ORDER.map((id) => {
              const cat = COSMETIC_CATALOG[id];
              const unlocked = meta.unlockedCosmetics.includes(id);
              const equipped = meta.equippedCosmetic === id;
              return (
                <button
                  key={id}
                  type="button"
                  className={`cosmetic-chip${equipped ? ' is-equipped' : ''}${unlocked ? '' : ' is-locked'}`}
                  style={{
                    borderColor: `#${cat.emissive.toString(16).padStart(6, '0')}`,
                    boxShadow: equipped
                      ? `0 0 16px #${cat.trail.toString(16).padStart(6, '0')}88`
                      : undefined,
                  }}
                  onClick={() => {
                    if (unlocked) onEquipCosmetic(id);
                    else onBuyCosmetic(id);
                  }}
                >
                  <span className="cosmetic-swatch" style={{ background: `#${cat.emissive.toString(16).padStart(6, '0')}` }} />
                  <span className="cosmetic-name">{cat.name}</span>
                  <span className="cosmetic-cost">
                    {equipped ? '裝備中' : unlocked ? '裝備' : `${cat.cost} 幣`}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <button type="button" className="cta" onClick={onClose}>
          返回選單
        </button>
      </div>
    </div>
  );
}
