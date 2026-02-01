import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/users', label: 'Users', admin: true },
  { to: '/applications', label: 'Applications' },
  { to: '/clients', label: 'Clients' },
  { to: '/topics', label: 'Topics' },
  { to: '/webhooks', label: 'Webhooks' },
  { to: '/messages', label: 'Messages' },
];

export default function Sidebar() {
  const { user } = useAuth();

  return (
    <aside className="w-56 bg-gray-900 text-white flex flex-col min-h-screen">
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-xl font-bold tracking-tight">rstify</h1>
      </div>
      <nav className="flex-1 py-4">
        {navItems
          .filter(item => !item.admin || user?.is_admin)
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
      </nav>
      <div className="p-4 border-t border-gray-700 text-xs text-gray-400">
        {user?.username} {user?.is_admin && '(admin)'}
      </div>
    </aside>
  );
}
