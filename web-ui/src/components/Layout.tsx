import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-50 dark:bg-surface-bg">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile-only bar for the drawer trigger — desktop uses the sidebar, no floating header. */}
        <header className="md:hidden h-14 flex-shrink-0 flex items-center gap-3 px-4 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-surface-card">
          <button
            onClick={() => setSidebarOpen(true)}
            className="-ml-1 w-9 h-9 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-surface-elevated transition"
            aria-label="Open menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <img src="/icon-512.png" alt="" className="w-7 h-7 rounded-lg" />
          <span className="font-bold text-slate-900 dark:text-white tracking-tight">rstify</span>
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
