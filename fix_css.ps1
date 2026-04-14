# 读取 index.css
$cssPath = 'D:\traeProject\wzry-bp\src\index.css'
$lines = Get-Content $cssPath -Encoding UTF8

# 找到旧 BP 样式的起止行
$startLine = -1
$endLine = -1
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match '/\* ===== 阵容面板 ===== \*/') { $startLine = $i }
    if ($lines[$i] -match '/\* ===== Modal ===== \*/') { $endLine = $i; break }
}

Write-Output "Old BP styles: line $($startLine+1) to line $($endLine)"

# 新的三栏布局样式
$newStyles = @'
/* ===== BP 3-column layout ===== */
.bp-layout {
  display: grid;
  grid-template-columns: 220px 1fr 220px;
  gap: 12px;
  align-items: start;
}

.center-column {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

/* Side panels */
.side-panel {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px;
  background: var(--bg-secondary);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.blue-side { border-top: 3px solid var(--blue); }
.red-side  { border-top: 3px solid var(--red); }

.blue-side.active-side { border-color: var(--blue); box-shadow: 0 0 12px rgba(56, 139, 253, 0.15); }
.red-side.active-side  { border-color: var(--red); box-shadow: 0 0 12px rgba(248, 81, 73, 0.15); }

.side-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.side-name {
  font-weight: 700;
  font-size: 14px;
}

.side-score {
  font-size: 12px;
  color: var(--gold);
  font-weight: 700;
}

/* Ban slots per side */
.side-bans {
  display: flex;
  gap: 4px;
}

.side-ban-slot {
  width: 20%;
}

.ban-empty {
  height: 36px;
  font-size: 10px;
  color: var(--red);
  opacity: 0.5;
}

/* Pick slots per side: 5 floors stacked vertically */
.side-picks {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.side-pick-slot {
  width: 100%;
  height: 42px;
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.side-pick-slot.highlight .slot-empty {
  border-color: var(--blue);
  background: var(--blue-bg);
  color: var(--blue);
}

/* Shared slot-empty */
.slot-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--text-muted);
  transition: all 0.2s;
}

.pos-label {
  font-size: 12px;
  font-weight: 600;
}

/* Orch bar */
.orch-bar {
  display: flex;
  gap: 4px;
  padding: 6px 10px;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  flex-wrap: wrap;
}

.orch-step {
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 700;
  border: 1px solid var(--border);
  color: var(--text-muted);
  transition: all 0.2s;
}

.orch-step.done {
  background: var(--blue-bg);
  border-color: var(--blue);
  color: var(--blue);
}

.orch-step.current {
  background: var(--blue);
  border-color: var(--blue);
  color: white;
  transform: scale(1.1);
}

.orch-step.pending {
  opacity: 0.35;
}

/* Hero card grid */
.hero-picker {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px;
  background: var(--bg-secondary);
}

.picker-toolbar {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.search-input {
  padding: 8px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
  flex: 1;
  min-width: 160px;
  transition: border-color 0.2s;
}

.search-input:focus {
  border-color: var(--blue);
}

.pos-filter {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.filter-btn {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.filter-btn:hover {
  border-color: var(--text-secondary);
  color: var(--text-primary);
}

.filter-btn.active {
  background: var(--blue-bg);
  color: var(--blue);
  border-color: rgba(56, 139, 253, 0.4);
}

.hero-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 6px;
  max-height: 400px;
  overflow-y: auto;
}

.hero-grid::-webkit-scrollbar {
  width: 4px;
}

.hero-grid::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 2px;
}

.hero-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 8px 6px;
  cursor: pointer;
  transition: all 0.15s;
  background: var(--bg-card);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  position: relative;
  overflow: hidden;
}

.hero-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  opacity: 0.7;
}

.hero-card.tier-t0::before { background: #e53935; }
.hero-card.tier-t1::before { background: #f97316; }
.hero-card.tier-t2::before { background: #eab308; }
.hero-card.tier-t3::before { background: #22c55e; }
.hero-card.tier-t4::before { background: #6b7280; }

.hero-card:hover {
  background: var(--bg-card-hover);
  box-shadow: var(--shadow);
  transform: translateY(-2px);
}

.hero-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: linear-gradient(135deg, #2d333b, #444c56);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 800;
  color: var(--text-primary);
  flex-shrink: 0;
}

.hero-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.hero-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  text-align: center;
}

.hero-tier {
  font-size: 10px;
  font-weight: 700;
}

.hero-pos {
  font-size: 10px;
  color: var(--text-muted);
  background: var(--bg-primary);
  border-radius: 3px;
  padding: 2px 6px;
}

.no-result {
  grid-column: 1 / -1;
  text-align: center;
  padding: 40px;
  color: var(--text-muted);
  font-size: 14px;
}

/* Hero mini (in pick/ban slots) */
.hero-mini {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  border: 1px solid var(--border);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  transition: all 0.2s;
  cursor: default;
  position: relative;
}

.hero-mini:hover {
  background: var(--bg-card-hover);
}

.hero-mini.is-ban {
  color: var(--red);
  background: rgba(248, 81, 73, 0.08);
  border-color: rgba(248, 81, 73, 0.3);
}

.mini-name {
  text-align: center;
  line-height: 1.2;
}

.ban-x {
  font-size: 16px;
  color: var(--red);
}

/* Done panel */
.done-panel {
  margin-top: 8px;
}

.analysis-summary {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.analysis-card {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px;
  background: var(--bg-secondary);
}

.analysis-card.blue { border-top: 3px solid var(--blue); }
.analysis-card.red  { border-top: 3px solid var(--red); }

.analysis-card h3 {
  font-size: 14px;
  margin: 0 0 10px;
  font-weight: 700;
}

.analysis-detail {
  background: var(--bg-card);
  border-radius: var(--radius-sm);
  margin-bottom: 10px;
  padding: 10px 12px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  font-size: 12px;
  color: var(--text-secondary);
}

.stat-row .val { font-weight: 700; color: var(--text-primary); font-size: 14px; }
.stat-row .val.good { color: var(--green); }
.stat-row .val.bad  { color: var(--red); }

.analysis-hero-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  margin-bottom: 8px;
  background: var(--bg-card);
}

.ah-name {
  font-weight: 700;
  font-size: 14px;
  margin-bottom: 4px;
}

.ah-tags {
  display: flex;
  gap: 8px;
  margin-bottom: 6px;
}

.ah-pos, .ah-score {
  font-size: 11px;
  color: var(--text-muted);
  background: var(--bg-primary);
  border-radius: 3px;
  padding: 2px 6px;
}

.ah-reason {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 6px;
  line-height: 1.5;
}

.ah-badges {
  margin-top: 4px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.ah-badges.good { color: var(--green); background: rgba(63,185,80,0.1); }
.ah-badges.bad  { color: var(--red); background: rgba(248,81,73,0.1); }
.ah-badges.syn  { color: var(--gold); background: rgba(240,192,64,0.1); }

/* Pick advice panel */
.pick-advice-panel {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 10px 12px;
  background: var(--bg-secondary);
}

.advice-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.advice-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
}

.advice-warn {
  font-size: 11px;
  color: var(--orange);
}

.advice-ok {
  font-size: 11px;
  color: var(--green);
}

.advice-tip {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 6px;
  line-height: 1.5;
}

.advice-heroes {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.advice-hero {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-card);
  cursor: pointer;
  transition: all 0.15s;
}

.advice-hero:hover {
  border-color: var(--text-secondary);
  transform: translateY(-1px);
}

.advice-hero.advice-fill {
  border-color: var(--blue);
  background: var(--blue-bg);
}

.advice-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.advice-tier {
  font-size: 10px;
  font-weight: 700;
}

.advice-pos {
  font-size: 10px;
  color: var(--text-muted);
}
'@

# 构建新文件
$newLines = $lines[0..($startLine-1)]
$newLines += $newStyles -split "`n"
$newLines += $lines[$endLine..($lines.Count-1)]

# 更新移动端适配中的旧类名引用
$updatedLines = $newLines | ForEach-Object {
    $_ -replace '\.teams-panel', '.bp-layout' `
       -replace '\.vs-divider', '.center-column' `
       -replace '\.ban-slots', '.side-bans' `
       -replace '\.pick-slots', '.side-picks'
}

# 写回
$updatedLines | Out-File -FilePath $cssPath -Encoding utf8
Write-Output "Done! Replaced lines $($startLine+1) to $($endLine+1)"
