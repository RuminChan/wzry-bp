import { useState } from 'react';
import { heroes, tierColors, getHeroById, type Hero, type Position } from '../data/heroes';

const POSITIONS: { key: string; label: string }[] = [
  { key: 'all', label: '全位置' },
  { key: 'warrior', label: '对抗路' },
  { key: 'assassin', label: '打野' },
  { key: 'mage', label: '中路' },
  { key: 'marksman', label: '发育路' },
  { key: 'support', label: '游走' },
];

export default function TierPage() {
  const [posFilter, setPosFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Hero | null>(null);

  const filtered = heroes.filter(h => {
    if (posFilter !== 'all' && !h.position.includes(posFilter as Position)) return false;
    if (tierFilter !== 'all' && h.tier !== tierFilter) return false;
    if (search && !h.name.includes(search)) return false;
    return true;
  });

  // 按梯度分组
  const tiers = ['T0', 'T0.5', 'T1', 'T2', 'T3', 'T4'];
  const grouped = tiers.map(t => ({
    tier: t,
    heroes: filtered.filter(h => h.tier === t),
  })).filter(g => g.heroes.length > 0);

  return (
    <div className="tier-page">
      {/* 工具栏 */}
      <div className="tier-toolbar">
        <input
          className="search-input"
          placeholder="搜索英雄..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="pos-filter">
          {POSITIONS.map(p => (
            <button
              key={p.key}
              className={`filter-btn ${posFilter === p.key ? 'active' : ''}`}
              onClick={() => setPosFilter(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="tier-filter">
          <button className={`filter-btn ${tierFilter === 'all' ? 'active' : ''}`} onClick={() => setTierFilter('all')}>全梯度</button>
          {tiers.map(t => (
            <button
              key={t}
              className={`filter-btn ${tierFilter === t ? 'active' : ''}`}
              style={tierFilter === t ? { borderColor: tierColors[t], color: tierColors[t] } : {}}
              onClick={() => setTierFilter(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* 英雄卡片 */}
      <div className="tier-content">
        {grouped.map(({ tier, heroes: tierHeroes }) => (
          <div key={tier} className="tier-section">
            <div className="tier-header">
              <span className="tier-badge" style={{ background: tierColors[tier] }}>{tier}</span>
              <span className="tier-label">
                {tier === 'T0' ? '版本之子 · 非ban必选' :
                 tier === 'T0.5' ? '强势首选 · 优先上分' :
                 tier === 'T1' ? '版本主流 · 稳定上分' :
                 tier === 'T2' ? '强度中等 · 依赖阵容' :
                 tier === 'T3' ? '边缘英雄 · 谨慎选择' :
                 '版本弃子 · 不推荐'}
              </span>
            </div>
            <div className="tier-heroes">
              {tierHeroes.map(hero => (
                <div
                  key={hero.id}
                  className="tier-hero-card"
                  onClick={() => setSelected(hero)}
                >
                  <div className="thc-avatar" style={{ borderColor: tierColors[hero.tier] }}>
                    {hero.name[0]}
                  </div>
                  <div className="thc-info">
                    <span className="thc-name">{hero.name}</span>
                    <span className="thc-pos">{hero.position.map(p => p[0].toUpperCase()).join('/')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {grouped.length === 0 && (
          <div className="no-result">没有符合条件的英雄</div>
        )}
      </div>

      {/* 英雄详情弹窗 */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <span className="modal-name">{selected.name}</span>
                <span className="modal-tier" style={{ color: tierColors[selected.tier] }}>
                  {selected.tier}
                </span>
              </div>
              <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="modal-tags">
                {selected.position.map(p => <span key={p} className="pos-tag">{p}</span>)}
                <span className="score-tag">强度 {selected.tierScore}</span>
              </div>
              <div className="modal-reason">
                <span className="section-label">版本说明</span>
                <p>{selected.reason}</p>
              </div>
              <div className="modal-source">
                数据来源：{selected.source} · {selected.sourceDate}
              </div>

              {selected.counters.length > 0 && (
                <div className="modal-section">
                  <span className="section-label">✅ 克制</span>
                  <div className="hero-list">
                    {selected.counters.map(id => {
                      const h = getHeroById(id);
                      return h ? (
                        <div key={id} className="hero-pill counter">{h.name}</div>
                      ) : null;
                    })}
                  </div>
                </div>
              )}

              {selected.counteredBy.length > 0 && (
                <div className="modal-section">
                  <span className="section-label">⚠️ 被克制</span>
                  <div className="hero-list">
                    {selected.counteredBy.map(id => {
                      const h = getHeroById(id);
                      return h ? (
                        <div key={id} className="hero-pill countered">{h.name}</div>
                      ) : null;
                    })}
                  </div>
                </div>
              )}

              {selected.synergies.length > 0 && (
                <div className="modal-section">
                  <span className="section-label">🤝 最佳配合</span>
                  <div className="hero-list">
                    {selected.synergies.map(id => {
                      const h = getHeroById(id);
                      return h ? (
                        <div key={id} className="hero-pill synergy">{h.name}</div>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
