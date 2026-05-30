import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider }        from '@tanstack/react-query';
import { AuthProvider, useAuth } from './lib/AuthContext.tsx';
import { StreamProvider }        from './lib/StreamContext.tsx';
import { AppLayout }             from './components/layout/AppLayout.tsx';
import { Landing }               from './pages/Landing.tsx';
import { Login }                 from './pages/Login.tsx';
import { Register }              from './pages/Register.tsx';
import { Dashboard }             from './pages/Dashboard.tsx';
import { Threats }               from './pages/Threats.tsx';
import { Alerts }                from './pages/Alerts.tsx';
import { Investigation }         from './pages/Investigation.tsx';
import { RAGQuery }              from './pages/RAGQuery.tsx';
import { Reports }               from './pages/Reports.tsx';
import { Settings }              from './pages/Settings.tsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5_000,
      refetchOnWindowFocus: false,
    },
  },
});

// ─── Guards ──────────────────────────────────────────────────────────────────

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthed } = useAuth();
  return isAuthed ? <>{children}</> : <Navigate to="/login" replace />;
}

function LandingOrDashboard() {
  const { isAuthed } = useAuth();
  return isAuthed ? <Navigate to="/dashboard" replace /> : <Landing />;
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Landing/Home */}
            <Route path="/" element={<LandingOrDashboard />} />

            {/* Public */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected */}
            <Route element={
              <RequireAuth>
                <StreamProvider>
                  <AppLayout />
                </StreamProvider>
              </RequireAuth>
            }>
              <Route path="dashboard"        element={<Dashboard />} />
              <Route path="threats"          element={<Threats />} />
              <Route path="alerts"           element={<Alerts />} />
              <Route path="investigation"    element={<Investigation />} />
              <Route path="investigation/:id" element={<Investigation />} />
              <Route path="logs"             element={<RAGQuery />} />
              <Route path="settings"         element={<Settings />} />
              <Route path="reports"          element={<Reports />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}


