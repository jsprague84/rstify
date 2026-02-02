import { HashRouter, Routes, Route } from 'react-router-dom';
import { AuthContext, useAuthProvider } from './hooks/useAuth';
import { ThemeContext, useThemeProvider } from './hooks/useTheme';
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

export default function App() {
  const auth = useAuthProvider();
  const themeCtx = useThemeProvider();

  return (
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
              <Route path="/messages" element={<Messages />} />
            </Route>
          </Routes>
        </HashRouter>
      </AuthContext.Provider>
    </ThemeContext.Provider>
  );
}
