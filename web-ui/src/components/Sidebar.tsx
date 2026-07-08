import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

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
      { to: '/settings', label: 'Settings' },
    ],
  },
  {
    items: [
      { to: '/docs', label: 'Documentation' },
    ],
  },
];

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-30 md:hidden transition-opacity ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Off-canvas on mobile, static column on md+ */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 shrink-0 bg-surface-bg text-white flex flex-col transition-transform duration-200 md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="h-16 px-5 flex items-center gap-3">
          <img src="/icon-512.png" alt="" className="w-9 h-9 rounded-xl" />
          <h1 className="text-xl font-bold tracking-tight">rstify</h1>
        </div>

        <nav className="flex-1 px-2.5 py-2 overflow-y-auto">
          {navSections
            .filter(section => !section.admin || user?.is_admin)
            .map((section, idx) => (
              <div key={idx}>
                {section.label && (
                  <div className="text-caption font-semibold text-slate-500 uppercase tracking-wider px-3 pt-5 pb-1.5">
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
                            : 'text-slate-400 hover:bg-white/5 hover:text-white'
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
              </div>
            ))}
        </nav>

        <div className="px-5 py-4 border-t border-white/10 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-bold flex-shrink-0">
            {(user?.username?.[0] || '?').toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-white truncate">{user?.username}</div>
            {user?.is_admin && <div className="text-caption text-slate-500">Administrator</div>}
          </div>
        </div>
      </aside>
    </>
  );
}
