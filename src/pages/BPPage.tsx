import { useReducer, useMemo, useState } from 'react';
import { heroes, getHeroById, bpPositions, tierColors, type Hero, type Position } from '../data/heroes';

type Side = 'blue' | 'red';
type Phase = 'ban' | 'pick' | 'done';

const MAX_BANS = 5;

// 每步选几个
const BLUE_STEPS = [1, 2, 2];
const RED_STEPS  = [2, 2, 1];

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
  // 每步完成后固化到 history；当前步骤进行中的放 current
  blueHistory: [string[], string[], string[]];
  blueCurrent: string[];
  redHistory: [string[], string[], string[]];
  redCurrent: string[];
  orchIdx: number; // 0~5 进行中，6 = done
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
  blueCurrent: [],
  redHistory: [[], [], []],
  redCurrent: [],
  orchIdx: 0,
  banTurn: 'blue',
};

function cloneHistory(h: [string[], string[], string[]]): [string[], string[], string[]] {
  return [h[0].slice(), h[1].slice(), h[2].slice()];
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'RESET':
      return { ...initState, blueHistory: [[], [], []], redHistory: [[], [], []] };

    case 'BAN': {
      if (state.phase !== 'ban') return state;
      const side = state.banTurn;
      if (state.bans[side].length >= MAX_BANS) return state;
      const nextBans = { ...state.bans, [side]: [...state.bans[side], action.heroId] };
      const done = nextBans.blue.length === MAX_BANS && nextBans.red.length === MAX_BANS;
      return {
        ...state,
        bans: nextBans,
        phase: done ? 'pick' : 'ban',
        banTurn: done ? 'blue' : (side === 'blue' ? 'red' : 'blue'),
      };
    }

    case 'PICK': {
      if (state.phase !== 'pick') return state;
      if (state.orchIdx >= ORCH.length) return state;
      const orch = ORCH[state.orchIdx];

      if (orch.kind === 'blue') {
        const stepIdx = orch.blueStep;
        const maxCount = BLUE_STEPS[stepIdx];
        if (state.blueCurrent.length >= maxCount) return state;
        const next = [...state.blueCurrent, action.heroId];
        if (next.length < maxCount) {
          // 步骤未完成，只更新 current
          return { ...state, blueCurrent: next };
        }
        // 步骤完成：固化到 history，推进 orchIdx
        const newHistory = cloneHistory(state.blueHistory);
        newHistory[stepIdx] = next;
        const ni = state.orchIdx + 1;
        return {
          ...state,
          blueHistory: newHistory,
          blueCurrent: [],
          orchIdx: ni,
          phase: ni >= ORCH.length ? 'done' : 'pick',
        };
      }

      // red
      const stepIdx = orch.redStep;
      const maxCount = RED_STEPS[stepIdx];
      if (state.redCurrent.length >= maxCount) return state;
      const next = [...state.redCurrent, action.heroId];
      if (next.length < maxCount) {
        return { ...state, redCurrent: next };
      }
      const newHistory = cloneHistory(state.redHistory);
      newHistory[stepIdx] = next;
      const ni = state.orchIdx + 1;
      return {
        ...state,
        redHistory: newHistory,
        redCurrent: [],
        orchIdx: ni,
        phase: ni >= ORCH.length ? 'done' : 'pick',
      };
    }

    case 'UNDO': {
      // done → 回到 pick 最后一步
      if (state.phase === 'done') {
        return { ...state, phase: 'pick' };
      }

      if (state.phase === 'ban') {
        // 谁最后 ban 的就撤谁
        const lastBanner: Side = state.bans.blue.length > state.bans.red.length ? 'blue' : 'red';
        if (state.bans[lastBanner].length === 0) return state;
        const newBans = { ...state.bans, [lastBanner]: state.bans[lastBanner].slice(0, -1) };
        // 撤销后轮到 lastBanner
        return { ...state, bans: newBans, banTurn: lastBanner };
      }

      // pick 阶段
      // 如果 current 里有东西，先撤 current 最后一个
      const orch = ORCH[state.orchIdx];
      if (orch) {
        if (orch.kind === 'blue' && state.blueCurrent.length > 0) {
          return { ...state, blueCurrent: state.blueCurrent.slice(0, -1) };
        }
        if (orch.kind === 'red' && state.redCurrent.length > 0) {
          return { ...state, redCurrent: state.redCurrent.slice(0, -1) };
        }
      }

      // current 为空，退回上一个 orch step
      if (state.orchIdx === 0) {
        // 退回到 ban 阶段最后一步
        const lastBanner: Side = state.bans.blue.length >= state.bans.red.length ? 'blue' : 'red';
        const newBans = { ...state.bans, [lastBanner]: state.bans[lastBanner].slice(0, -1) };
        return { ...state, phase: 'ban', bans: newBans, banTurn: lastBanner };
      }

      const prevOrchIdx = state.orchIdx - 1;
      const prevOrch = ORCH[prevOrchIdx];

      if (prevOrch.kind === 'blue') {
        const ps = prevOrch.blueStep;
        // 把 blueHistory[ps] 恢复到 blueCurrent，并清空 history[ps]
        const recovered = state.blueHistory[ps].slice();
        const nh = cloneHistory(state.blueHistory);
        nh[ps] = [];
        // 撤销最后一个 pick（恢复 count-1 个）
        return {
          ...state,
          blueHistory: nh,
          blueCurrent: recovered.slice(0, -1),
          orchIdx: prevOrchIdx,
        };
      }

      // red
      const ps = prevOrch.redStep;
      const recovered = state.redHistory[ps].slice();
      const nh = cloneHistory(state.redHistory);
      nh[ps] = [];
      return {
        ...state,
        redHistory: nh,
        redCurrent: recovered.slice(0, -1),
        orchIdx: prevOrchIdx,
      };
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

  const currentOrch: OrchItem | null = phase === 'pick' && orchIdx < ORCH.length ? ORCH[orchIdx] : null;

  const activeSide: Side | null =
    phase === 'pick' && currentOrch ? currentOrch.kind :
    phase === 'ban' ? state.banTurn : null;

  // 双方所有已选（history 固化 + current 进行中）
  const blueAllPicks = useMemo(() => [...blueHistory[0], ...blueHistory[1], ...blueHistory[2], ...blueCurrent], [blueHistory, blueCurrent]);
  const redAllPicks  = useMemo(() => [...redHistory[0],  ...redHistory[1],  ...redHistory[2],  ...redCurrent],  [redHistory,  redCurrent]);

  const takenIds = useMemo(() => {
    const base = [...bans.blue, ...bans.red];
    if (phase === 'pick' || phase === 'done') return [...base, ...blueAllPicks, ...redAllPicks];
    return base;
  }, [bans, phase, blueAllPicks, redAllPicks]);

  const filteredHeroes = useMemo(() => {
    return heroes.filter(h => {
      if (takenIds.includes(h.id)) return false;
      if (filterPos !== 'all' && !h.position.includes(filterPos as any)) return false;
      if (search && !h.name.includes(search)) return false;
      return true;
    });
  }, [takenIds, filterPos, search]);

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
      const roleCount: Record<string, number> = { tank: 0, mage: 0, marksman: 0, assassin: 0, support: 0, warrior: 0 };
      objs.forEach(h => {
        if (h.position.includes('warrior') || h.position.includes('tank')) { roles.add('tank'); roleCount.tank++; roleCount.warrior++; }
        if (h.position.includes('mage')) { roles.add('mage'); roleCount.mage++; }
        if (h.position.includes('marksman')) { roles.add('marksman'); roleCount.marksman++; }
        if (h.position.includes('assassin')) { roles.add('assassin'); roleCount.assassin++; }
        if (h.position.includes('support')) { roles.add('support'); roleCount.support++; }
      });
      const completeness = Math.min(roles.size / 4 * 30, 30);

      // 阵容合理性检测
      const issues: string[] = [];
      const mageCount = roleCount.mage;
      const mmCount = roleCount.marksman;
      const tankCount = roleCount.tank + roleCount.warrior;
      const supCount = roleCount.support;
      const jgCount = roleCount.assassin;

      if (mageCount >= 5) issues.push('⚠️ 全法师阵容，缺少物理伤害');
      else if (mageCount === 4 && mmCount === 0) issues.push('⚠️ 4法师无射手，阵容偏科严重');
      else if (mageCount >= 4 && mmCount >= 1) issues.push('⚡ 中射双法，需平衡物理输出');

      if (mmCount >= 5) issues.push('⚠️ 全射手阵容，前排坦度严重不足');
      else if (mmCount >= 3 && tankCount === 0) issues.push('⚠️ 多射手无前排，团战生存困难');
      else if (mmCount >= 3 && tankCount >= 1) issues.push('⚡ 多射手阵容，需保护后排');

      if (tankCount === 0 && picks.length >= 3) issues.push('⚠️ 无前排战士，阵容坦度不足');
      if (supCount === 0 && picks.length >= 4) issues.push('⚠️ 无辅助位视野和保护');
      if (jgCount === 0 && picks.length >= 3) issues.push('⚠️ 无打野位，前期节奏能力弱');
      if (mageCount === 0 && mmCount === 0) issues.push('⚠️ 无法师无射手，远程输出缺失');
      if (tankCount >= 3 && mageCount + mmCount <= 1) issues.push('⚡ 多前排阵容，输出核心明确');

      return { total: Math.round(score + synergy * 3 - weakness * 2 + completeness), synergy, weakness, completeness: Math.round(completeness), issues };
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

      <div className="bp-layout">
        {/* 左侧：蓝方 */}
        <div className={'side-panel blue-side' + (activeSide === 'blue' && phase !== 'done' ? ' active-side' : '')}>
          <div className="side-header">
            <span className="side-name">🔵 蓝方</span>
            {analysis && <span className="side-score">{analysis.blue.total}分</span>}
          </div>
          <div className="side-bans">
            {['禁用','禁用','禁用','禁用','禁用'].map((_, i) => (
              <div key={i} className="side-ban-slot">
                {bans.blue[i] ? <HeroMini id={bans.blue[i]} isBan /> : <div className="slot-empty ban-empty">禁</div>}
              </div>
            ))}
          </div>
          <div className="side-picks">
            {[1,2,3,4,5].map(i => {
              const heroId = blueAllPicks[i - 1] ?? null;
              return (
                <div key={i} className={'side-pick-slot ' + (activeSide === 'blue' && phase === 'pick' && !heroId ? 'highlight' : '')}>
                  {heroId ? <HeroMini id={heroId} /> : (
                    <div className="slot-empty">
                      <span className="pos-label">{phase === 'done' ? bpPositions[i-1]?.label : i + '楼'}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 中间：英雄池 */}
        <div className="center-column">
          {phase === 'pick' && (
            <div className="orch-bar">
              {ORCH.map((o, i) => {
                const done = i < orchIdx;
                const cur = i === orchIdx;
                const cnt = o.kind === 'blue' ? BLUE_STEPS[o.blueStep] : RED_STEPS[o.redStep];
                return (
                  <div key={i} className={'orch-step ' + (done ? 'done' : cur ? 'current' : 'pending')}>
                    {o.kind === 'blue' ? '🔵' : '🔴'}{cnt}
                  </div>
                );
              })}
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
          {phase === 'pick' && activeSide && (
            <PickAdvicePanel bluePicks={blueAllPicks} redPicks={redAllPicks} activeSide={activeSide} onSelect={heroId => dispatch({ type: 'PICK', heroId })} />
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
                      {analysis.blue.issues.map((issue, i) => (
                        <div key={i} className="stat-row"><span></span><span className="val bad" style={{ fontSize: 12 }}>{issue}</span></div>
                      ))}
                      {analysis.blue.issues.length === 0 && blueAllPicks.length >= 5 && (
                        <div className="stat-row"><span></span><span className="val good" style={{ fontSize: 12 }}>✅ 阵容合理</span></div>
                      )}
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
                      {analysis.red.issues.map((issue, i) => (
                        <div key={i} className="stat-row"><span></span><span className="val bad" style={{ fontSize: 12 }}>{issue}</span></div>
                      ))}
                      {analysis.red.issues.length === 0 && redAllPicks.length >= 5 && (
                        <div className="stat-row"><span></span><span className="val good" style={{ fontSize: 12 }}>✅ 阵容合理</span></div>
                      )}
                    </div>
                  )}
                  {redAllPicks.map(id => <HeroAnalysisCard key={id} heroId={id} enemyPicks={blueAllPicks} allPicks={redAllPicks} />)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 右侧：红方 */}
        <div className={'side-panel red-side' + (activeSide === 'red' && phase !== 'done' ? ' active-side' : '')}>
          <div className="side-header">
            <span className="side-name">🔴 红方</span>
            {analysis && <span className="side-score">{analysis.red.total}分</span>}
          </div>
          <div className="side-bans">
            {['禁用','禁用','禁用','禁用','禁用'].map((_, i) => (
              <div key={i} className="side-ban-slot">
                {bans.red[i] ? <HeroMini id={bans.red[i]} isBan /> : <div className="slot-empty ban-empty">禁</div>}
              </div>
            ))}
          </div>
          <div className="side-picks">
            {[1,2,3,4,5].map(i => {
              const heroId = redAllPicks[i - 1] ?? null;
              return (
                <div key={i} className={'side-pick-slot ' + (activeSide === 'red' && phase === 'pick' && !heroId ? 'highlight' : '')}>
                  {heroId ? <HeroMini id={heroId} /> : (
                    <div className="slot-empty">
                      <span className="pos-label">{phase === 'done' ? bpPositions[i-1]?.label : i + '楼'}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
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

function PickAdvicePanel({ bluePicks, redPicks, activeSide, onSelect }: { bluePicks: string[]; redPicks: string[]; activeSide: Side; onSelect: (heroId: string) => void }) {
  const allPicks = activeSide === 'blue' ? bluePicks : redPicks;
  const enemyPicks = activeSide === 'blue' ? redPicks : bluePicks;

  const picksObj = allPicks.map(id => getHeroById(id)).filter(Boolean) as Hero[];
  const enemyObjs = enemyPicks.map(id => getHeroById(id)).filter(Boolean) as Hero[];

  // 统计已有位置
  const hasPos: Record<string, boolean> = { tank: false, warrior: false, mage: false, marksman: false, assassin: false, support: false };
  picksObj.forEach(h => {
    if (h.position.includes('tank')) hasPos.tank = true;
    if (h.position.includes('warrior')) hasPos.warrior = true;
    if (h.position.includes('mage')) hasPos.mage = true;
    if (h.position.includes('marksman')) hasPos.marksman = true;
    if (h.position.includes('assassin')) hasPos.assassin = true;
    if (h.position.includes('support')) hasPos.support = true;
  });

  const missingRoles = (Object.keys(hasPos) as Position[]).filter(k => !hasPos[k]);

  // 阵容问题提示
  const roleCount: Record<string, number> = { tank: 0, warrior: 0, mage: 0, marksman: 0, assassin: 0, support: 0 };
  picksObj.forEach(h => {
    if (h.position.includes('tank') || h.position.includes('warrior')) roleCount.tank++;
    if (h.position.includes('mage')) roleCount.mage++;
    if (h.position.includes('marksman')) roleCount.marksman++;
    if (h.position.includes('assassin')) roleCount.assassin++;
    if (h.position.includes('support')) roleCount.support++;
  });

  const issues: string[] = [];
  if (roleCount.mage >= 4) issues.push('⚠️ 法师过多');
  if (roleCount.marksman >= 3) issues.push('⚠️ 射手过多');
  if (roleCount.tank === 0 && allPicks.length >= 2) issues.push('⚠️ 缺少前排');

  // 找推荐英雄：优先补缺失位置，避开被敌方克制的
  const already = [...allPicks, ...enemyPicks];
  const suggestions = heroes
    .filter(h => !already.includes(h.id))
    .filter(h => !enemyObjs.some(e => e.counters.includes(h.id) && h.counteredBy.includes(e.id)))
    .sort((a, b) => {
      const aMatch = missingRoles.some(r => a.position.includes(r)) ? 10 : 0;
      const bMatch = missingRoles.some(r => b.position.includes(r)) ? 10 : 0;
      const aCountered = enemyObjs.some(e => e.counters.includes(a.id)) ? -5 : 0;
      const bCountered = enemyObjs.some(e => e.counters.includes(b.id)) ? -5 : 0;
      const aSynergy = a.synergies.some(sid => allPicks.includes(sid)) ? 3 : 0;
      const bSynergy = b.synergies.some(sid => allPicks.includes(sid)) ? 3 : 0;
      return (b.tierScore + bMatch + bSynergy + bCountered) - (a.tierScore + aMatch + aSynergy + aCountered);
    })
    .slice(0, 6);

  const posLabels: Record<string, string> = { tank: '前排', warrior: '前排', mage: '中单', marksman: '射手', assassin: '打野', support: '游走' };

  return (
    <div className="pick-advice-panel">
      <div className="advice-header">
        <span className="advice-title">💡 {activeSide === 'blue' ? '蓝方' : '红方'}选人建议</span>
        {issues.length > 0 && <span className="advice-warn">{issues.join(' ')}</span>}
        {issues.length === 0 && allPicks.length > 0 && <span className="advice-ok">阵容暂无明显问题</span>}
      </div>
      {missingRoles.length > 0 && (
        <div className="advice-tip">
          建议补充：{missingRoles.map(r => posLabels[r] || r).join('、')}
        </div>
      )}
      {suggestions.length > 0 && (
        <div className="advice-heroes">
          {suggestions.map(h => (
            <div key={h.id} className={'advice-hero ' + (missingRoles.some(r => h.position.includes(r)) ? 'advice-fill' : '')} onClick={() => onSelect(h.id)}>
              <span className="advice-name">{h.name}</span>
              <span className="advice-tier" style={{ color: tierColors[h.tier] }}>{h.tier}</span>
              <span className="advice-pos">{h.position.map(p => p[0].toUpperCase()).join('/')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
