import { useState, useMemo } from 'react';
import { heroes, getHeroById, bpPositions, tierColors, type Hero } from '../data/heroes';

function tierToClass(tier: string) {
  return 'tier-' + tier.toLowerCase().replace('.', '_');
}

type Side = 'blue' | 'red';
type Phase = 'ban' | 'pick' | 'done';

const PHASES: { key: Phase; label: string }[] = [
  { key: 'ban', label: '禁用阶段' },
  { key: 'pick', label: '选择阶段' },
  { key: 'done', label: '阵容分析' },
];

export default function BPPage() {
  const [phase, setPhase] = useState<Phase>('ban');
  const [bans, setBans] = useState<{ blue: string[]; red: string[] }>({ blue: [], red: [] });
  const [picks, setPicks] = useState<{ blue: string[]; red: string[] }>({ blue: [], red: [] });
  const [search, setSearch] = useState('');
  const [filterPos, setFilterPos] = useState<string>('all');
  const [activePick, setActivePick] = useState<Side>('blue');

  const takenIds = useMemo(() => {
    const picksTaken = [...picks.blue, ...picks.red];
    // Ban阶段：只排除双方已pick的，不排除己方ban（允许双方重复ban）
    if (phase === 'ban') {
      return picksTaken;
    }
    // Pick阶段：排除所有已ban和已pick的
    return [...picksTaken, ...bans.blue, ...bans.red];
  }, [bans, picks, phase]);

  const filteredHeroes = useMemo(() => {
    return heroes.filter(h => {
      if (takenIds.includes(h.id)) return false;
      if (filterPos !== 'all' && !h.position.includes(filterPos as any)) return false;
      if (search && !h.name.includes(search)) return false;
      return true;
    });
  }, [takenIds, filterPos, search]);

  const handleSelectHero = (hero: Hero) => {
    if (phase === 'done') return;

    if (phase === 'ban') {
      const side = activePick;
      if (bans[side].length >= 5) return;
      setBans(prev => ({ ...prev, [side]: [...prev[side], hero.id] }));
      advanceTurn();
    } else if (phase === 'pick') {
      const side = activePick;
      if (picks[side].length >= 5) return;
      setPicks(prev => ({ ...prev, [side]: [...prev[side], hero.id] }));
      advanceTurn();
    }
  };

  // Pick顺序：蓝1→红2→蓝2→红2→蓝2→红1（双方各5）
  const advanceTurn = () => {
    const nextSide: Side = activePick === 'blue' ? 'red' : 'blue';

    if (phase === 'ban') {
      if (bans.blue.length === 5 && bans.red.length === 5) {
        setPhase('pick');
        setActivePick('blue');
      } else {
        setActivePick(nextSide);
      }
    } else if (phase === 'pick') {
      // 蓝方已满5个 → 红方继续直到5
      // 红方已满5个 → 完成
      if (picks.blue.length === 5) {
        if (picks.red.length === 5) {
          setPhase('done');
        } else {
          setActivePick('red');
        }
      } else {
        setActivePick(nextSide);
      }
    }
  };

  const reset = () => {
    setPhase('ban');
    setBans({ blue: [], red: [] });
    setPicks({ blue: [], red: [] });
    setSearch('');
    setFilterPos('all');
    setActivePick('blue');
  };

  const analysis = useMemo(() => {
    if (picks.blue.length === 0 && picks.red.length === 0) return null;

    const calcScore = (sidePicks: string[]) => {
      let score = 0;
      let synergyCount = 0;
      let weaknessCount = 0;
      const heroObjs = sidePicks.map(id => getHeroById(id)).filter(Boolean) as Hero[];

      heroObjs.forEach(h => {
        score += h.tierScore;
        // 检查是否被敌方克制
        sidePicks.forEach(pickId => {
          const enemy = getHeroById(pickId);
          if (enemy?.counters.includes(h.id)) {
            weaknessCount++;
          }
        });
        // 检查配合
        h.synergies.forEach(synId => {
          if (sidePicks.includes(synId)) synergyCount++;
        });
      });

      // 检查阵容完整性
      const roles = new Set<string>();
      heroObjs.forEach(h => {
        if (h.position.includes('warrior') || h.position.includes('tank')) roles.add('tank');
        if (h.position.includes('mage')) roles.add('mage');
        if (h.position.includes('marksman')) roles.add('marksman');
        if (h.position.includes('assassin')) roles.add('assassin');
        if (h.position.includes('support')) roles.add('support');
      });

      const completeness = Math.min(roles.size / 4 * 30, 30);
      return {
        total: Math.round(score + synergyCount * 3 - weaknessCount * 2 + completeness),
        synergyCount,
        weaknessCount,
        completeness: Math.round(completeness),
      };
    };

    const blue = calcScore(picks.blue);
    const red = calcScore(picks.red);

    return { blue, red };
  }, [picks]);

  return (
    <div className="bp-page">
      {/* 顶部BP阶段指示器 */}
      <div className="phase-bar">
        {PHASES.map((p, i) => (
          <div
            key={p.key}
            className={`phase-step ${phase === p.key ? 'current' : ''} ${
              PHASES.findIndex(x => x.key === phase) > i ? 'done' : ''
            }`}
          >
            <div className="phase-dot" />
            <span>{p.label}</span>
          </div>
        ))}
      </div>

      {/* 阵容面板 */}
      <div className="teams-panel">
        {/* 蓝方 */}
        <div className={`team-panel blue-team ${activePick === 'blue' && phase !== 'done' ? 'active-turn' : ''}`}>
          <div className="team-header">
            <span className="team-name">🔵 蓝方</span>
            {analysis && <span className="team-score">{analysis.blue.total}分</span>}
          </div>

          {/* Ban区 */}
          <div className="ban-zone">
            <span className="zone-label">禁用</span>
            <div className="ban-slots">
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} className="ban-slot">
                  {bans.blue[i] ? (
                    <HeroMini id={bans.blue[i]} isBan />
                  ) : (
                    <div className="slot-empty">Ban</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Pick区 */}
          <div className="pick-zone">
            <div className="pick-slots">
              {bpPositions.map((pos, i) => (
                <div key={pos.role} className="pick-slot">
                  {picks.blue[i] ? (
                    <HeroMini id={picks.blue[i]} />
                  ) : (
                    <div className={`slot-empty ${activePick === 'blue' && phase === 'pick' ? 'highlight' : ''}`}>
                      <span className="pos-label">{pos.label}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* VS */}
        <div className="vs-divider">
          <span>VS</span>
          {analysis && (
            <div className="score-compare">
              <span className={analysis.blue.total > analysis.red.total ? 'winner' : ''}>
                蓝{analysis.blue.total}
              </span>
              <span className="divider">:</span>
              <span className={analysis.red.total > analysis.blue.total ? 'winner' : ''}>
                红{analysis.red.total}
              </span>
            </div>
          )}
        </div>

        {/* 红方 */}
        <div className={`team-panel red-team ${activePick === 'red' && phase !== 'done' ? 'active-turn' : ''}`}>
          <div className="team-header">
            <span className="team-name">🔴 红方</span>
            {analysis && <span className="team-score">{analysis.red.total}分</span>}
          </div>

          {/* Ban区 */}
          <div className="ban-zone">
            <span className="zone-label">禁用</span>
            <div className="ban-slots">
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} className="ban-slot">
                  {bans.red[i] ? (
                    <HeroMini id={bans.red[i]} isBan />
                  ) : (
                    <div className="slot-empty">Ban</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Pick区 */}
          <div className="pick-zone">
            <div className="pick-slots">
              {bpPositions.map((pos, i) => (
                <div key={pos.role} className="pick-slot">
                  {picks.red[i] ? (
                    <HeroMini id={picks.red[i]} />
                  ) : (
                    <div className={`slot-empty ${activePick === 'red' && phase === 'pick' ? 'highlight' : ''}`}>
                      <span className="pos-label">{pos.label}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 当前操作提示 */}
      {phase !== 'done' && (
        <div className="turn-indicator">
          <span className={`turn-badge ${activePick}`}>
            {activePick === 'blue' ? '🔵' : '🔴'} {activePick === 'blue' ? '蓝方' : '红方'}
            {phase === 'ban' ? ' 禁用' : ' 选择'}
          </span>
          <span className="turn-tip">
            {phase === 'ban' && `禁用 · 蓝方 ${bans.blue.length}/5 · 红方 ${bans.red.length}/5`}
            {phase === 'pick' && `选择 · 蓝方 ${picks.blue.length}/5 · 红方 ${picks.red.length}/5`}
          </span>
        </div>
      )}

      {phase === 'done' && (
        <div className="done-panel">
          <div className="analysis-summary">
            <div className="analysis-card blue">
              <h3>🔵 蓝方分析</h3>
              {analysis && (
                <div className="analysis-detail">
                  <div className="stat-row">
                    <span>阵容评分</span>
                    <span className="val">{analysis.blue.total}</span>
                  </div>
                  <div className="stat-row">
                    <span>阵容完整度</span>
                    <span className="val">{analysis.blue.completeness}/30</span>
                  </div>
                  <div className="stat-row">
                    <span>配合加成</span>
                    <span className="val good">+{analysis.blue.synergyCount * 3}</span>
                  </div>
                  <div className="stat-row">
                    <span>被克制风险</span>
                    <span className="val bad">-{analysis.blue.weaknessCount * 2}</span>
                  </div>
                </div>
              )}
              {picks.blue.map(id => <HeroAnalysisCard key={id} heroId={id} side="blue" enemyPicks={[...picks.red]} allPicks={picks.blue} />)}
            </div>
            <div className="analysis-card red">
              <h3>🔴 红方分析</h3>
              {analysis && (
                <div className="analysis-detail">
                  <div className="stat-row">
                    <span>阵容评分</span>
                    <span className="val">{analysis.red.total}</span>
                  </div>
                  <div className="stat-row">
                    <span>阵容完整度</span>
                    <span className="val">{analysis.red.completeness}/30</span>
                  </div>
                  <div className="stat-row">
                    <span>配合加成</span>
                    <span className="val good">+{analysis.red.synergyCount * 3}</span>
                  </div>
                  <div className="stat-row">
                    <span>被克制风险</span>
                    <span className="val bad">-{analysis.red.weaknessCount * 2}</span>
                  </div>
                </div>
              )}
              {picks.red.map(id => <HeroAnalysisCard key={id} heroId={id} side="red" enemyPicks={[...picks.blue]} allPicks={picks.red} />)}
            </div>
          </div>
        </div>
      )}

      {/* 英雄选择区 */}
      {phase !== 'done' && (
        <div className="hero-picker">
          <div className="picker-toolbar">
            <input
              className="search-input"
              placeholder="搜索英雄..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div className="pos-filter">
              <button className={`filter-btn ${filterPos === 'all' ? 'active' : ''}`} onClick={() => setFilterPos('all')}>全部</button>
              <button className={`filter-btn ${filterPos === 'tank' || filterPos === 'warrior' ? 'active' : ''}`} onClick={() => setFilterPos('warrior')}>对抗</button>
              <button className={`filter-btn ${filterPos === 'assassin' ? 'active' : ''}`} onClick={() => setFilterPos('assassin')}>打野</button>
              <button className={`filter-btn ${filterPos === 'mage' ? 'active' : ''}`} onClick={() => setFilterPos('mage')}>中路</button>
              <button className={`filter-btn ${filterPos === 'marksman' ? 'active' : ''}`} onClick={() => setFilterPos('marksman')}>射手</button>
              <button className={`filter-btn ${filterPos === 'support' ? 'active' : ''}`} onClick={() => setFilterPos('support')}>辅助</button>
            </div>
            <button className="reset-btn" onClick={reset}>🔄 重置</button>
          </div>

          <div className="hero-grid">
            {filteredHeroes.map(hero => (
              <div
                key={hero.id}
                className={`hero-card ${tierToClass(hero.tier)}`}
                onClick={() => handleSelectHero(hero)}
                title={`${hero.tier} · ${hero.reason}`}
              >
                <div className="hero-avatar">{hero.name[0]}</div>
                <div className="hero-info">
                  <span className="hero-name">{hero.name}</span>
                  <span className="hero-tier" style={{ color: tierColors[hero.tier] }}>{hero.tier}</span>
                </div>
                <div className="hero-pos">{hero.position.map(p => p[0].toUpperCase()).join('/')}</div>
              </div>
            ))}
            {filteredHeroes.length === 0 && (
              <div className="no-result">没有符合条件的英雄</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// 英雄迷你卡片
function HeroMini({ id, isBan = false }: { id: string; isBan?: boolean }) {
  const hero = getHeroById(id);
  if (!hero) return null;
  return (
    <div className={`hero-mini ${isBan ? 'is-ban' : ''}`} title={`${hero.name} ${hero.tier}`}>
      <span className="mini-name">{hero.name}</span>
      {isBan && <span className="ban-x">✕</span>}
    </div>
  );
}

// 英雄分析卡片
function HeroAnalysisCard({ heroId, enemyPicks, allPicks }: { heroId: string; side?: 'blue' | 'red'; enemyPicks: string[]; allPicks: string[] }) {
  const hero = getHeroById(heroId);
  if (!hero) return null;

  const counters = enemyPicks.filter(eId => hero.counters.includes(eId));
  const counteredBy = enemyPicks.filter(eId => hero.counteredBy.includes(eId));
  const synergies = allPicks.filter(aId => hero.synergies.includes(aId) && aId !== heroId);

  return (
    <div className="analysis-hero-card">
      <div className="ah-name">{hero.name} <span style={{ color: tierColors[hero.tier] }}>{hero.tier}</span></div>
      <div className="ah-tags">
        <span className="ah-pos">{hero.position.map(p => p[0].toUpperCase()).join('/')}</span>
        <span className="ah-score">强度 {hero.tierScore}</span>
      </div>
      <div className="ah-reason">{hero.reason}</div>
      {counters.length > 0 && (
        <div className="ah-badges good">
          <span>✅ 克制：{counters.map(id => getHeroById(id)?.name).filter(Boolean).join('、')}</span>
        </div>
      )}
      {counteredBy.length > 0 && (
        <div className="ah-badges bad">
          <span>⚠️ 被克制：{counteredBy.map(id => getHeroById(id)?.name).filter(Boolean).join('、')}</span>
        </div>
      )}
      {synergies.length > 0 && (
        <div className="ah-badges syn">
          <span>🤝 配合：{synergies.map(id => getHeroById(id)?.name).filter(Boolean).join('、')}</span>
        </div>
      )}
    </div>
  );
}
