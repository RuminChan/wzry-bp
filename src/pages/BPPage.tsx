import { useReducer, useMemo, useState } from 'react';
import { heroes, getHeroById, bpPositions, tierColors, type Hero } from '../data/heroes';

type Side = 'blue' | 'red';
type Phase = 'ban' | 'pick' | 'done';

// Pick顺序：蓝1→红2→蓝2→红2→蓝2→红1
const PICK_STEPS: { side: Side; count: number }[] = [
  { side: 'blue', count: 1 },
  { side: 'red',  count: 2 },
  { side: 'blue', count: 2 },
  { side: 'red',  count: 2 },
  { side: 'blue', count: 2 },
  { side: 'red',  count: 1 },
];

const MAX_PICKS = 5;
const MAX_BANS = 5;

type State = {
  phase: Phase;
  bans: { blue: string[]; red: string[] };
  picks: { blue: string[]; red: string[] };
  pickStep: number;
  banTurn: Side;
};

type Action =
  | { type: 'BAN'; heroId: string }
  | { type: 'PICK'; heroId: string }
  | { type: 'UNDO' }
  | { type: 'RESET' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'RESET':
      return { phase: 'ban', bans: { blue: [], red: [] }, picks: { blue: [], red: [] }, pickStep: 0, banTurn: 'blue' };

    case 'BAN': {
      if (state.phase !== 'ban') return state;
      const side = state.banTurn;
      if (state.bans[side].length >= MAX_BANS) return state;
      const nextBans = { ...state.bans, [side]: [...state.bans[side], action.heroId] };
      const done = nextBans.blue.length === MAX_BANS && nextBans.red.length === MAX_BANS;
      return {
        ...state,
        bans: nextBans,
        phase: done ? 'pick' : state.phase,
        pickStep: done ? 0 : state.pickStep,
        banTurn: done ? 'blue' : (side === 'blue' ? 'red' : 'blue'),
      };
    }

    case 'PICK': {
      if (state.phase !== 'pick') return state;
      const step = PICK_STEPS[state.pickStep];
      const side = step.side;
      // 每方最多5个
      if (state.picks[side].length >= MAX_PICKS) return state;
      // 这一步骤已选够了（只限本步骤数量，不是阵营总数）
      if (state.picks[side].length >= step.count) return state;
      const nextPicks = { ...state.picks, [side]: [...state.picks[side], action.heroId] };
      // 这一步骤还没选够，留在这一步
      if (nextPicks[side].length < step.count) {
        return { ...state, picks: nextPicks };
      }
      // 选够了，进入下一步或结束
      const nextStep = state.pickStep + 1;
      if (nextStep >= PICK_STEPS.length) {
        return { ...state, picks: nextPicks, phase: 'done' };
      }
      return { ...state, picks: nextPicks, pickStep: nextStep };
    }

    case 'UNDO': {
      if (state.phase === 'done') {
        return { ...state, phase: 'pick' };
      }
      if (state.phase === 'ban') {
        const prevSide = state.banTurn === 'blue' ? 'red' : 'blue';
        if (state.bans[prevSide].length === 0) return state;
        return {
          ...state,
          bans: { ...state.bans, [prevSide]: state.bans[prevSide].slice(0, -1) },
          banTurn: prevSide,
        };
      }
      // pick阶段：撤销对方最近的操作（找上一个有选的步骤）
      // 找上一个有选的步骤
      let idx = state.pickStep;
      while (idx >= 0) {
        const s = PICK_STEPS[idx];
        if (state.picks[s.side].length > 0) {
          const newPicks = { ...state.picks, [s.side]: state.picks[s.side].slice(0, -1) };
          // 如果这一步还没选完，留在同一步
          if (newPicks[s.side].length < s.count) {
            return { ...state, picks: newPicks };
          }
          // 选够了则退回上一步
          return { ...state, picks: newPicks, pickStep: Math.max(0, idx - 1) };
        }
        idx--;
      }
      // pick全空则退回ban阶段
      if (idx < 0) {
        return { ...state, phase: 'ban', pickStep: 0 };
      }
      return state;
    }

    default:
      return state;
  }
}

const initState: State = {
  phase: 'ban',
  bans: { blue: [], red: [] },
  picks: { blue: [], red: [] },
  pickStep: 0,
  banTurn: 'blue',
};

const PHASES: { key: Phase; label: string }[] = [
  { key: 'ban', label: '禁用阶段' },
  { key: 'pick', label: '选择阶段' },
  { key: 'done', label: '阵容分析' },
];

function tierToClass(tier: string) {
  return 'tier-' + tier.toLowerCase().replace('.', '_');
}

export default function BPPage() {
  const [state, dispatch] = useReducer(reducer, initState);
  const [search, setSearch] = useState('');
  const [filterPos, setFilterPos] = useState<string>('all');

  const { phase, bans, picks, pickStep, banTurn } = state;

  const activePick: Side = phase === 'pick' ? PICK_STEPS[pickStep].side : banTurn;

  const takenIds = useMemo(() => {
    const picksTaken = [...picks.blue, ...picks.red];
    if (phase === 'ban') return [...picksTaken, ...bans[activePick]];
    return [...picksTaken, ...bans.blue, ...bans.red];
  }, [bans, picks, phase, activePick]);

  const filteredHeroes = useMemo(() => {
    return heroes.filter(h => {
      if (takenIds.includes(h.id)) return false;
      if (filterPos !== 'all' && !h.position.includes(filterPos as any)) return false;
      if (search && !h.name.includes(search)) return false;
      return true;
    });
  }, [takenIds, filterPos, search]);

  // 当前步骤信息
  const currentStep = phase === 'pick' ? PICK_STEPS[pickStep] : null;
  const stepLabel = currentStep
    ? `${currentStep.side === 'blue' ? '🔵蓝方' : '🔴红方'} 选${currentStep.count}个`
    : phase === 'ban'
    ? `${activePick === 'blue' ? '🔵蓝方' : '🔴红方'} 禁用`
    : '完成';

  const analysis = useMemo(() => {
    if (picks.blue.length === 0 && picks.red.length === 0) return null;
    const calcScore = (sidePicks: string[]) => {
      let score = 0;
      let synergyCount = 0;
      let weaknessCount = 0;
      const heroObjs = sidePicks.map(id => getHeroById(id)).filter(Boolean) as Hero[];
      heroObjs.forEach(h => {
        score += h.tierScore;
        sidePicks.forEach(pickId => {
          const enemy = getHeroById(pickId);
          if (enemy?.counters.includes(h.id)) weaknessCount++;
        });
        h.synergies.forEach(synId => {
          if (sidePicks.includes(synId)) synergyCount++;
        });
      });
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
    return { blue: calcScore(picks.blue), red: calcScore(picks.red) };
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

      {/* 操作按钮 */}
      <div className="bp-toolbar">
        <button className="undo-btn" onClick={() => dispatch({ type: 'UNDO' })} title="撤销上一步">
          ↩ 返回上一步
        </button>
        <button className="reset-btn" onClick={() => dispatch({ type: 'RESET' })} title="重新开始">
          🔄 重新开始
        </button>
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
            {stepLabel}
          </span>
          <span className="turn-tip">
            {phase === 'ban' && `禁用 · 蓝方 ${bans.blue.length}/${MAX_BANS} · 红方 ${bans.red.length}/${MAX_BANS}`}
            {phase === 'pick' && currentStep && (
              <>
                第{pickStep + 1}/{PICK_STEPS.length}步 ·
                蓝方 {picks.blue.length}/{MAX_PICKS} ·
                红方 {picks.red.length}/{MAX_PICKS}
                {picks[activePick].length < currentStep.count &&
                  ` · 还需选${currentStep.count - picks[activePick].length}个`}
              </>
            )}
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
                  <div className="stat-row"><span>阵容评分</span><span className="val">{analysis.blue.total}</span></div>
                  <div className="stat-row"><span>阵容完整度</span><span className="val">{analysis.blue.completeness}/30</span></div>
                  <div className="stat-row"><span>配合加成</span><span className="val good">+{analysis.blue.synergyCount * 3}</span></div>
                  <div className="stat-row"><span>被克制风险</span><span className="val bad">-{analysis.blue.weaknessCount * 2}</span></div>
                </div>
              )}
              {picks.blue.map(id => <HeroAnalysisCard key={id} heroId={id} side="blue" enemyPicks={[...picks.red]} allPicks={picks.blue} />)}
            </div>
            <div className="analysis-card red">
              <h3>🔴 红方分析</h3>
              {analysis && (
                <div className="analysis-detail">
                  <div className="stat-row"><span>阵容评分</span><span className="val">{analysis.red.total}</span></div>
                  <div className="stat-row"><span>阵容完整度</span><span className="val">{analysis.red.completeness}/30</span></div>
                  <div className="stat-row"><span>配合加成</span><span className="val good">+{analysis.red.synergyCount * 3}</span></div>
                  <div className="stat-row"><span>被克制风险</span><span className="val bad">-{analysis.red.weaknessCount * 2}</span></div>
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
          </div>
          <div className="hero-grid">
            {filteredHeroes.map(hero => (
              <div
                key={hero.id}
                className={`hero-card ${tierToClass(hero.tier)}`}
                onClick={() => dispatch({ type: phase === 'ban' ? 'BAN' : 'PICK', heroId: hero.id })}
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
            {filteredHeroes.length === 0 && <div className="no-result">没有符合条件的英雄</div>}
          </div>
        </div>
      )}
    </div>
  );
}

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
        <div className="ah-counters">✅ 克制：{counters.map(id => getHeroById(id)?.name).join('、')}</div>
      )}
      {counteredBy.length > 0 && (
        <div className="ah-countered">⚠️ 被克：{counteredBy.map(id => getHeroById(id)?.name).join('、')}</div>
      )}
      {synergies.length > 0 && (
        <div className="ah-synergy">🤝 配合：{synergies.map(id => getHeroById(id)?.name).join('、')}</div>
      )}
    </div>
  );
}
