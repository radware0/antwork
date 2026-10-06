import React, { useLayoutEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight } from 'lucide-react';
import { LiquidThemeToggle } from './components/ui/liquid-theme-toggle.tsx';
import './theme-toggle.css';
import './site.css';

function readTheme(): 'black' | 'white' {
  try { return localStorage.getItem('antwork-site-theme') === 'white' ? 'white' : 'black'; }
  catch { return 'black'; }
}

function DownloadPage() {
  const [theme, setTheme] = useState(readTheme);
  useLayoutEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  const switchTheme = async (next: 'light' | 'dark') => {
    const value = next === 'light' ? 'white' : 'black';
    setTheme(value);
    try { localStorage.setItem('antwork-site-theme', value); }
    catch { /* The toggle still works when browser storage is unavailable. */ }
  };

  return <div className="site-shell">
    <header className="site-header">
      <LiquidThemeToggle theme={theme === 'white' ? 'light' : 'dark'} onThemeChange={switchTheme} />
    </header>
    <main className="site-main">
      <div className="site-message">
        <h1>Antwork available as app</h1>
        <a className="site-download" href="https://github.com/radware0/antwork/releases/latest">
          Download on GitHub<ArrowUpRight size={18} aria-hidden="true" />
        </a>
      </div>
    </main>
    <footer className="site-footer"><span>antwork 2026</span><a href="/docs/">Docs</a></footer>
  </div>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><DownloadPage /></React.StrictMode>);
