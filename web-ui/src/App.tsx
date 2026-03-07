import { HashRouter, Routes, Route } from 'react-router-dom';
import { AuthContext, useAuthProvider } from './hooks/useAuth';
import { ThemeContext, useThemeProvider } from './hooks/useTheme';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './components/Toast';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Applications from './pages/Applications';
import Clients from './pages/Clients';
import Topics from './pages/Topics';
import Webhooks from './pages/Webhooks';
import Messages from './pages/Messages';
import Permissions from './pages/Permissions';
import Settings from './pages/Settings';
import { Link } from 'react-router-dom';

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-300 dark:text-gray-600">404</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">Page not found</p>
        <Link to="/" className="mt-4 inline-block text-indigo-600 hover:text-indigo-800 text-sm">Go to Dashboard</Link>
      </div>
    </div>
  );
}

export default function App() {
  const auth = useAuthProvider();
  const themeCtx = useThemeProvider();

  return (
    <ErrorBoundary>
    <ToastProvider>
    <ThemeContext.Provider value={themeCtx}>
      <AuthContext.Provider value={auth}>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/users" element={<Users />} />
              <Route path="/applications" element={<Applications />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/topics" element={<Topics />} />
              <Route path="/webhooks" element={<Webhooks />} />
              <Route path="/permissions" element={<Permissions />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </HashRouter>
      </AuthContext.Provider>
    </ThemeContext.Provider>
    </ToastProvider>
    </ErrorBoundary>
  );
}
