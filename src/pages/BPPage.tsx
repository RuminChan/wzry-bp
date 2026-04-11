import { useReducer, useMemo, useState } from 'react';
import { heroes, getHeroById, bpPositions, tierColors, type Hero } from '../data/heroes';

type Side = 'blue' | 'red';
type Phase = 'ban' | 'pick' | 'done';

const MAX_BANS = 5;
const MAX_PICKS = 5;

const BLUE_STEPS = [{ count: 1 }, { count: 2 }, { count: 2 }];
const RED_STEPS  = [{ count: 2 }, { count: 2 }, { count: 1 }];

// 全局流程编排：蓝1 → 红2 → 蓝2 → 红2 → 蓝2 → 红1
type OrchItem =
  | { kind: 'blue'; blueStep: 0 | 1 | 2 }
  | { kind: 'red';  redStep:  0 | 1 | 2 };

const ORCH: OrchItem[] = [
  { kind: 'blue', blueStep: 0 },
  { kind: 'red',  redStep:  0 },
  { kind: 'blue', blueStep: 1 },
  { kind: 'red',  redStep:  1 },
  { kind: 'blue', blueStep: 2 },
  { kind: 'red',  redStep:  2 },
];

type State = {
  phase: Phase;
  bans: { blue: string[]; red: string[] };
  // pick
  blueHistory: [string[], string[], string[]]; // 每步完成后固化到这里
  blueStep: number;   // 0/1/2，当前进行到哪步
  blueCurrent: string[];
  redHistory: [string[], string[], string[]];
  redStep: number;
  redCurrent: string[];
  orchIdx: number; // 全局进度 0~6
  banTurn: Side;
};

type Action =
  | { type: 'BAN'; heroId: string }
  | { type: 'PICK'; heroId: string }
  | { type: 'UNDO' }
  | { type: 'RESET' };

const initState: State = {
  phase: 'ban',
  bans: { blue: [], red: [] },
  blueHistory: [[], [], []],
  blueStep: 0,
  blueCurrent: [],
  redHistory: [[], [], []],
  redStep: 0,
  redCurrent: [],
  orchIdx: 0,
  banTurn: 'blue',
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'RESET':
      return { ...initState };

    case 'BAN': {
      if (state.phase !== 'ban') return state;
      const side = state.banTurn;
      if (state.bans[side].length >= MAX_BANS) return state;
      const nextBans = { ...state.bans, [side]: [...state.bans[side], action.heroId] };
      const done = nextBans.blue.length === MAX_BANS && nextBans.red.length === MAX_BANS;
      return {
        ...state, bans: nextBans,
        phase: done ? 'pick' : state.phase,
        banTurn: done ? 'blue' : (side === 'blue' ? 'red' : 'blue'),
      };
    }

    case 'PICK': {
      if (state.phase !== 'pick') return state;
      const orch = ORCH[state.orchIdx];

      if (orch.kind === 'blue') {
        const step = BLUE_STEPS[state.blueStep];
        if (state.blueCurrent.length >= step.count) return state;
        const next = [...state.blueCurrent, action.heroId];
        if (next.length < step.count) return { ...state, blueCurrent: next };
        // 固化历史，进入下一步
        const newHistory: [string[], string[], string[]] = [...state.blueHistory];
        newHistory[state.blueStep] = next;
        const ni = state.orchIdx + 1;
        if (ni >= ORCH.length) return { ...state, blueHistory: newHistory, blueCurrent: [], orchIdx: ni, phase: 'done' };
        return { ...state, blueHistory: newHistory, blueCurrent: [], orchIdx: ni };
      }

      // red
      const step = RED_STEPS[state.redStep];
      if (state.redCurrent.length >= step.count) return state;
      const next = [...state.redCurrent, action.heroId];
      if (next.length < step.count) return { ...state, redCurrent: next };
      const newHistory: [string[], string[], string[]] = [...state.redHistory];
      newHistory[state.redStep] = next;
      const ni = state.orchIdx + 1;
      if (ni >= ORCH.length) return { ...state, redHistory: newHistory, redCurrent: [], orchIdx: ni, phase: 'done' };
      return { ...state, redHistory: newHistory, redCurrent: [], orchIdx: ni };
    }

    case 'UNDO': {
      if (state.phase === 'done') return { ...state, phase: 'pick' };
      if (state.phase === 'ban') {
        const prev = state.banTurn === 'blue' ? 'red' : 'blue';
        if (state.bans[prev].length === 0) return state;
        return {
          ...state,
          bans: { ...state.bans, [prev]: state.bans[prev].slice(0, -1) },
          banTurn: prev,
        };
      }
      // pick：退回上一步 orch
      if (state.orchIdx === 0) return { ...state, phase: 'ban', orchIdx: 0 };

      const prevOrch = ORCH[state.orchIdx - 1];

      if (prevOrch.kind === 'blue') {
        const ps = prevOrch.blueStep;
        if (state.blueStep === ps) {
          // 还在同一步，撤销当前步骤最后1个
          if (state.blueCurrent.length === 0) {
            const prevDone = state.blueStep - 1;
            if (prevDone < 0) return state;
            const recovered = state.blueHistory[prevDone];
            const nh: [string[], string[], string[]] = [...state.blueHistory];
            nh[prevDone] = [];
            return { ...state, blueHistory: nh, blueStep: prevDone, blueCurrent: recovered.length > 0 ? recovered.slice(-1) : [], orchIdx: state.orchIdx - 1 };
          }
          return { ...state, blueCurrent: state.blueCurrent.slice(0, -1) };
        }
        // orch已前进，退回上一步
        const recovered = state.blueHistory[ps];
        const nh: [string[], string[], string[]] = [...state.blueHistory];
        nh[ps] = [];
        return { ...state, blueHistory: nh, blueStep: ps, blueCurrent: recovered.length > 0 ? recovered.slice(-1) : [], orchIdx: state.orchIdx - 1 };
      }

      // red
      const rs = prevOrch.redStep;
      if (state.redStep === rs) {
        if (state.redCurrent.length === 0) {
          const prevDone = state.redStep - 1;
          if (prevDone < 0) return state;
          const recovered = state.redHistory[prevDone];
          const nh: [string[], string[], string[]] = [...state.redHistory];
          nh[prevDone] = [];
          return { ...state, redHistory: nh, redStep: prevDone, redCurrent: recovered.length > 0 ? recovered.slice(-1) : [], orchIdx: state.orchIdx - 1 };
        }
        return { ...state, redCurrent: state.redCurrent.slice(0, -1) };
      }
      const recovered = state.redHistory[rs];
      const nh: [string[], string[], string[]] = [...state.redHistory];
      nh[rs] = [];
      return { ...state, redHistory: nh, redStep: rs, redCurrent: recovered.length > 0 ? recovered.slice(-1) : [], orchIdx: state.orchIdx - 1 };
    }

    default:
      return state;
  }
}

function tierToClass(tier: string) {
  return 'tier-' + tier.toLowerCase().replace('.', '_');
}

export default function BPPage() {
  const [state, dispatch] = useReducer(reducer, initState);
  const [search, setSearch] = useState('');
  const [filterPos, setFilterPos] = useState<string>('all');

  const { phase, bans, blueHistory, blueCurrent, redHistory, redCurrent, orchIdx } = state;

  const currentOrch: OrchItem | null = phase === 'pick' ? ORCH[orchIdx] : null;

  const activeSide: Side | null =
    phase === 'pick' && currentOrch ? currentOrch.kind :
    phase === 'ban' ? state.banTurn : null;

  // 双方所有已选
  const blueAllPicks = [...blueHistory.flat(), ...blueCurrent];
  const redAllPicks = [...redHistory.flat(), ...redCurrent];

  const takenIds = useMemo(() => {
    if (phase === 'pick') return [...bans.blue, ...bans.red, ...blueAllPicks, ...redAllPicks];
    return [...bans.blue, ...bans.red];
  }, [bans, phase, blueAllPicks, redAllPicks]);

  const filteredHeroes = useMemo(() => {
    return heroes.filter(h => {
      if (takenIds.includes(h.id)) return false;
      if (filterPos !== 'all' && !h.position.includes(filterPos as any)) return false;
      if (search && !h.name.includes(search)) return false;
      return true;
    });
  }, [takenIds, filterPos, search]);

  const stepLabel = (() => {
    if (phase === 'ban') return (activeSide === 'blue' ? '🔵蓝方' : '🔴红方') + ' 禁用';
    if (phase === 'done') return '阵容完成';
    const o = currentOrch!;
    if (o.kind === 'blue') return `🔵蓝方 第${o.blueStep + 1}步（选${BLUE_STEPS[o.blueStep].count}个）`;
    return `🔴红方 第${o.redStep + 1}步（选${RED_STEPS[o.redStep].count}个）`;
  })();

  const remainInStep = (() => {
    if (phase !== 'pick' || !currentOrch) return 0;
    if (currentOrch.kind === 'blue') return BLUE_STEPS[currentOrch.blueStep].count - blueCurrent.length;
    return RED_STEPS[currentOrch.redStep].count - redCurrent.length;
  })();

  const analysis = useMemo(() => {
    if (blueAllPicks.length === 0 && redAllPicks.length === 0) return null;
    const calc = (picks: string[]) => {
      let score = 0, synergy = 0, weakness = 0;
      const objs = picks.map(id => getHeroById(id)).filter(Boolean) as Hero[];
      objs.forEach(h => {
        score += h.tierScore;
        picks.forEach(pid => { if (getHeroById(pid)?.counters.includes(h.id)) weakness++; });
        h.synergies.forEach(sid => { if (picks.includes(sid)) synergy++; });
      });
      const roles = new Set<string>();
      objs.forEach(h => {
        if (h.position.includes('warrior') || h.position.includes('tank')) roles.add('tank');
        if (h.position.includes('mage')) roles.add('mage');
        if (h.position.includes('marksman')) roles.add('marksman');
        if (h.position.includes('assassin')) roles.add('assassin');
        if (h.position.includes('support')) roles.add('support');
      });
      const completeness = Math.min(roles.size / 4 * 30, 30);
      return { total: Math.round(score + synergy * 3 - weakness * 2 + completeness), synergy, weakness, completeness: Math.round(completeness) };
    };
    return { blue: calc(blueAllPicks), red: calc(redAllPicks) };
  }, [blueAllPicks, redAllPicks]);

  return (
    <div className="bp-page">
      <div className="phase-bar">
        {(['ban', 'pick', 'done'] as Phase[]).map((p, i) => {
          const curIdx = ['ban', 'pick', 'done'].indexOf(phase);
          return (
            <div key={p} className={'phase-step ' + (phase === p ? 'current' : curIdx > i ? 'done' : '')}>
              <div className="phase-dot" />
              <span>{p === 'ban' ? '禁用阶段' : p === 'pick' ? '选择阶段' : '阵容分析'}</span>
            </div>
          );
        })}
      </div>

      <div className="bp-toolbar">
        <button className="undo-btn" onClick={() => dispatch({ type: 'UNDO' })}>↩ 返回上一步</button>
        <button className="reset-btn" onClick={() => dispatch({ type: 'RESET' })}>🔄 重新开始</button>
      </div>

      <div className="teams-panel">
        {/* 蓝方 */}
        <div className={'team-panel blue-team ' + (activeSide === 'blue' && phase !== 'done' ? 'active-turn' : '')}>
          <div className="team-header">
            <span className="team-name">🔵 蓝方</span>
            {analysis && <span className="team-score">{analysis.blue.total}分</span>}
          </div>
          <div className="ban-zone">
            <span className="zone-label">禁用</span>
            <div className="ban-slots">
              {[0,1,2,3,4].map(i => (
                <div key={i} className="ban-slot">
                  {bans.blue[i] ? <HeroMini id={bans.blue[i]} isBan /> : <div className="slot-empty">Ban</div>}
                </div>
              ))}
            </div>
          </div>
          <div className="pick-zone">
            <div className="step-indicator">
              {BLUE_STEPS.map((s, i) => {
                const done = blueHistory[i].length > 0;
                const cur = currentOrch ? currentOrch.kind === 'blue' && currentOrch.blueStep === i : false;
                return (
                  <div key={i} className={'step-badge ' + (done ? 'done' : cur ? 'current' : 'pending')}>
                    第{i+1}步（{s.count}个）{done ? '✓' : ''}
                  </div>
                );
              })}
            </div>
            <div className="pick-slots">
              {bpPositions.map((pos, i) => {
                const heroId = i < blueAllPicks.length ? blueAllPicks[i] : null;
                return (
                  <div key={pos.role} className="pick-slot">
                    {heroId ? (
                      <HeroMini id={heroId} />
                    ) : (
                      <div className={'slot-empty ' + (activeSide === 'blue' && phase === 'pick' ? 'highlight' : '')}>
                        <span className="pos-label">{pos.label}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* VS */}
        <div className="vs-divider">
          <span>VS</span>
          {analysis && (
            <div className="score-compare">
              <span className={analysis.blue.total > analysis.red.total ? 'winner' : ''}>蓝{analysis.blue.total}</span>
              <span className="divider">:</span>
              <span className={analysis.red.total > analysis.blue.total ? 'winner' : ''}>红{analysis.red.total}</span>
            </div>
          )}
        </div>

        {/* 红方 */}
        <div className={'team-panel red-team ' + (activeSide === 'red' && phase !== 'done' ? 'active-turn' : '')}>
          <div className="team-header">
            <span className="team-name">🔴 红方</span>
            {analysis && <span className="team-score">{analysis.red.total}分</span>}
          </div>
          <div className="ban-zone">
            <span className="zone-label">禁用</span>
            <div className="ban-slots">
              {[0,1,2,3,4].map(i => (
                <div key={i} className="ban-slot">
                  {bans.red[i] ? <HeroMini id={bans.red[i]} isBan /> : <div className="slot-empty">Ban</div>}
                </div>
              ))}
            </div>
          </div>
          <div className="pick-zone">
            <div className="step-indicator">
              {RED_STEPS.map((s, i) => {
                const done = redHistory[i].length > 0;
                const cur = currentOrch ? currentOrch.kind === 'red' && currentOrch.redStep === i : false;
                return (
                  <div key={i} className={'step-badge ' + (done ? 'done' : cur ? 'current' : 'pending')}>
                    第{i+1}步（{s.count}个）{done ? '✓' : ''}
                  </div>
                );
              })}
            </div>
            <div className="pick-slots">
              {bpPositions.map((pos, i) => {
                const heroId = i < redAllPicks.length ? redAllPicks[i] : null;
                return (
                  <div key={pos.role} className="pick-slot">
                    {heroId ? (
                      <HeroMini id={heroId} />
                    ) : (
                      <div className={'slot-empty ' + (activeSide === 'red' && phase === 'pick' ? 'highlight' : '')}>
                        <span className="pos-label">{pos.label}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {phase !== 'done' && (
        <div className="turn-indicator">
          <span className={'turn-badge ' + activeSide}>{stepLabel}</span>
          <span className="turn-tip">
            {phase === 'ban' && '禁用 · 蓝' + bans.blue.length + '/' + MAX_BANS + ' · 红' + bans.red.length + '/' + MAX_BANS}
            {phase === 'pick' && (
              '蓝' + blueAllPicks.length + '/' + MAX_PICKS + ' · 红' + redAllPicks.length + '/' + MAX_PICKS +
              (remainInStep > 0 ? ' · 还需选 ' + remainInStep + ' 个' : '')
            )}
          </span>
        </div>
      )}

      {phase === 'pick' && (
        <div className="orch-bar">
          {ORCH.map((o, i) => {
            const done = i < orchIdx;
            const cur = i === orchIdx;
            const cnt = o.kind === 'blue' ? BLUE_STEPS[o.blueStep].count : RED_STEPS[o.redStep].count;
            return (
              <div key={i} className={'orch-step ' + (done ? 'done' : cur ? 'current' : 'pending')}>
                {o.kind === 'blue' ? '🔵' : '🔴'}{cnt}
              </div>
            );
          })}
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
                  <div className="stat-row"><span>配合加成</span><span className="val good">+{analysis.blue.synergy * 3}</span></div>
                  <div className="stat-row"><span>被克制风险</span><span className="val bad">-{analysis.blue.weakness * 2}</span></div>
                </div>
              )}
              {blueAllPicks.map(id => <HeroAnalysisCard key={id} heroId={id} enemyPicks={redAllPicks} allPicks={blueAllPicks} />)}
            </div>
            <div className="analysis-card red">
              <h3>🔴 红方分析</h3>
              {analysis && (
                <div className="analysis-detail">
                  <div className="stat-row"><span>阵容评分</span><span className="val">{analysis.red.total}</span></div>
                  <div className="stat-row"><span>阵容完整度</span><span className="val">{analysis.red.completeness}/30</span></div>
                  <div className="stat-row"><span>配合加成</span><span className="val good">+{analysis.red.synergy * 3}</span></div>
                  <div className="stat-row"><span>被克制风险</span><span className="val bad">-{analysis.red.weakness * 2}</span></div>
                </div>
              )}
              {redAllPicks.map(id => <HeroAnalysisCard key={id} heroId={id} enemyPicks={blueAllPicks} allPicks={redAllPicks} />)}
            </div>
          </div>
        </div>
      )}

      {phase !== 'done' && (
        <div className="hero-picker">
          <div className="picker-toolbar">
            <input className="search-input" placeholder="搜索英雄..." value={search} onChange={e => setSearch(e.target.value)} />
            <div className="pos-filter">
              {[['all','全部'],['warrior','对抗'],['assassin','打野'],['mage','中路'],['marksman','射手'],['support','辅助']].map(([v, label]) => (
                <button key={v} className={'filter-btn ' + (filterPos === v ? 'active' : '')} onClick={() => setFilterPos(v)}>{label}</button>
              ))}
            </div>
          </div>
          <div className="hero-grid">
            {filteredHeroes.map(hero => (
              <div
                key={hero.id}
                className={'hero-card ' + tierToClass(hero.tier)}
                onClick={() => dispatch({ type: phase === 'ban' ? 'BAN' : 'PICK', heroId: hero.id })}
                title={hero.tier + ' · ' + hero.reason}
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
  const hero = id ? getHeroById(id) : null;
  return (
    <div className={'hero-mini ' + (isBan ? 'is-ban' : '')} title={hero ? hero.name + ' ' + hero.tier : ''}>
      <span className="mini-name">{hero ? hero.name : '-'}</span>
      {isBan && <span className="ban-x">✕</span>}
    </div>
  );
}

function HeroAnalysisCard({ heroId, enemyPicks, allPicks }: { heroId: string; enemyPicks: string[]; allPicks: string[] }) {
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
      {counters.length > 0 && <div className="ah-counters">✅ 克制：{counters.map(id => getHeroById(id)?.name).join('、')}</div>}
      {counteredBy.length > 0 && <div className="ah-countered">⚠️ 被克：{counteredBy.map(id => getHeroById(id)?.name).join('、')}</div>}
      {synergies.length > 0 && <div className="ah-synergy">🤝 配合：{synergies.map(id => getHeroById(id)?.name).join('、')}</div>}
    </div>
  );
}
