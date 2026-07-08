import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';

const navSections = [
  {
    items: [
      { to: '/', label: 'Dashboard' },
      { to: '/messages', label: 'Messages' },
    ],
  },
  {
    label: 'Manage',
    items: [
      { to: '/topics', label: 'Topics' },
      { to: '/applications', label: 'Applications' },
      { to: '/clients', label: 'Clients' },
    ],
  },
  {
    label: 'Integrations',
    items: [
      { to: '/webhooks', label: 'Webhooks' },
    ],
  },
  {
    label: 'Admin',
    admin: true,
    items: [
      { to: '/users', label: 'Users', admin: true },
      { to: '/permissions', label: 'Permissions', admin: true },
    ],
  },
  {
    items: [
      { to: '/settings', label: 'Settings' },
      { to: '/docs', label: 'Documentation' },
    ],
  },
];

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-30 md:hidden transition-opacity ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Off-canvas on mobile, static column on md+. Theme-aware surfaces. */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 shrink-0 flex flex-col bg-white dark:bg-surface-bg border-r border-slate-200 dark:border-white/[0.06] transition-transform duration-200 md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="h-16 px-5 flex items-center gap-3">
          <img src="/icon-512.png" alt="" className="w-9 h-9 rounded-xl" />
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">rstify</h1>
        </div>

        <nav className="flex-1 px-2.5 py-2 overflow-y-auto">
          {navSections
            .filter(section => !section.admin || user?.is_admin)
            .map((section, idx) => (
              <div key={idx}>
                {section.label && (
                  <div className="text-caption font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 pt-5 pb-1.5">
                    {section.label}
                  </div>
                )}
                {section.items
                  .filter(item => !(item as any).admin || user?.is_admin)
                  .map(item => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/'}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `block px-3 py-2 my-0.5 rounded-field text-sm font-medium transition ${
                          isActive
                            ? 'bg-primary text-white shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
              </div>
            ))}
        </nav>

        <div className="px-3 py-3 border-t border-slate-200 dark:border-white/10 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold flex-shrink-0">
            {(user?.username?.[0] || '?').toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">{user?.username}</div>
            {user?.is_admin && <div className="text-caption text-slate-400 dark:text-slate-500">Administrator</div>}
          </div>
          <button
            onClick={toggleTheme}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition"
            aria-label="Toggle dark mode"
          >
            {theme === 'dark' ? (
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-[18px] h-[18px]"><path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM10 7a3 3 0 100 6 3 3 0 000-6zM15.657 5.404a.75.75 0 10-1.06-1.06l-1.061 1.06a.75.75 0 001.06 1.06l1.06-1.06zM6.464 14.596a.75.75 0 10-1.06-1.06l-1.061 1.06a.75.75 0 001.06 1.06l1.06-1.06zM18 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 0118 10zM5 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 015 10zM14.596 15.657a.75.75 0 001.06-1.06l-1.06-1.061a.75.75 0 10-1.06 1.06l1.06 1.06zM5.404 6.464a.75.75 0 001.06-1.06l-1.06-1.061a.75.75 0 10-1.06 1.06l1.06 1.06z" /></svg>
            ) : (
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-[18px] h-[18px]"><path fillRule="evenodd" d="M7.455 2.004a.75.75 0 01.26.77 7 7 0 009.958 7.967.75.75 0 011.067.853A8.5 8.5 0 116.647 1.921a.75.75 0 01.808.083z" clipRule="evenodd" /></svg>
            )}
          </button>
          <button
            onClick={logout}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition"
            aria-label="Log out"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-[18px] h-[18px]"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          </button>
        </div>
      </aside>
    </>
  );
}
