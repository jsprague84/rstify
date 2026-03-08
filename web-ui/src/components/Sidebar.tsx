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
      { to: '/bridges', label: 'MQTT Bridges' },
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

export default function Sidebar() {
  const { user } = useAuth();

  return (
    <aside className="w-56 bg-gray-900 text-white flex flex-col min-h-screen">
      <div className="p-4 border-b border-gray-700 flex items-center gap-3">
        <img src="/icon-512.png" alt="" className="w-8 h-8 rounded-md" />
        <h1 className="text-xl font-bold tracking-tight">rstify</h1>
      </div>
      <nav className="flex-1 py-2">
        {navSections
          .filter(section => !section.admin || user?.is_admin)
          .map((section, idx) => (
            <div key={idx}>
              {section.label && (
                <div className="text-xs text-gray-500 uppercase tracking-wider px-4 pt-4 pb-1">
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
                    className={({ isActive }) =>
                      `block px-4 py-2 text-sm ${
                        isActive
                          ? 'bg-indigo-600 text-white'
                          : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
            </div>
          ))}
      </nav>
      <div className="p-4 border-t border-gray-700 text-xs text-gray-400">
        {user?.username} {user?.is_admin && '(admin)'}
      </div>
    </aside>
  );
}
