import { useState } from 'react';
import BPPage from './pages/BPPage';
import TierPage from './pages/TierPage';
import './index.css';

type Tab = 'bp' | 'tier';

export default function App() {
  const [tab, setTab] = useState<Tab>('bp');

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">🎮</span>
            <div>
              <h1>王者荣耀 BP助手</h1>
              <p>S43赛季 · 智能排位选人</p>
            </div>
          </div>
          <nav className="tab-nav">
            <button
              className={`tab-btn ${tab === 'bp' ? 'active' : ''}`}
              onClick={() => setTab('bp')}
            >
              ⚔️ BP模拟
            </button>
            <button
              className={`tab-btn ${tab === 'tier' ? 'active' : ''}`}
              onClick={() => setTab('tier')}
            >
              🏆 版本梯度
            </button>
          </nav>
        </div>
      </header>

      <main className="app-main">
        {tab === 'bp' ? <BPPage /> : <TierPage />}
      </main>

      <footer className="app-footer">
        <p>⚠️ 数据来源：游侠网/17173/今日头条/腾讯网（2026-04）· 仅供娱乐参考</p>
      </footer>
    </div>
  );
}
