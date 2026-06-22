// GreenGuard — Root App Component
// Sets up routing, context providers, and protected route logic

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import CollectorDashboard from './pages/CollectorDashboard';
import ComplaintNew from './pages/ComplaintNew';
import CollectionNew from './pages/CollectionNew';
import MapView from './pages/MapView';
import SmsPanel from './pages/SmsPanel';
import Store from './pages/Store';
import UpcycleHub from './pages/UpcycleHub';
import AiConfidencePanel from './pages/AiConfidencePanel';
import Profile from './pages/Profile';
import Layout from './components/layout/Layout';

// Protected route wrapper — redirects to /login if not authenticated
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--color-gray-500)', fontSize: 14 }}>Loading GreenGuard...</p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to appropriate dashboard
    if (user.role === 'ADMIN') return <Navigate to="/admin" replace />;
    if (user.role === 'COLLECTOR') return <Navigate to="/collector" replace />;
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

// Public route — redirect authenticated users to their dashboard
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) {
    if (user.role === 'ADMIN') return <Navigate to="/admin" replace />;
    if (user.role === 'COLLECTOR') return <Navigate to="/collector" replace />;
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

// Inner app with socket context (only after auth is known)
const AppWithSocket = () => (
  <SocketProvider>
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

      {/* Shared Authenticated Routes inside Layout */}
      <Route element={<Layout />}>
        {/* Citizen Routes */}
        <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['CITIZEN']}><Dashboard /></ProtectedRoute>} />
        <Route path="/complaint/new" element={<ProtectedRoute allowedRoles={['CITIZEN']}><ComplaintNew /></ProtectedRoute>} />
        <Route path="/collection/new" element={<ProtectedRoute allowedRoles={['CITIZEN']}><CollectionNew /></ProtectedRoute>} />

        {/* Admin Routes */}
        <Route path="/admin" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/sms" element={<ProtectedRoute allowedRoles={['ADMIN']}><SmsPanel /></ProtectedRoute>} />
        <Route path="/admin/ai-confidence" element={<ProtectedRoute allowedRoles={['ADMIN']}><AiConfidencePanel /></ProtectedRoute>} />

        {/* Collector Routes */}
        <Route path="/collector" element={<ProtectedRoute allowedRoles={['COLLECTOR']}><CollectorDashboard /></ProtectedRoute>} />

        {/* Shared Routes */}
        <Route path="/map" element={<ProtectedRoute><MapView /></ProtectedRoute>} />
        <Route path="/store" element={<ProtectedRoute><Store /></ProtectedRoute>} />
        <Route path="/upcycle" element={<ProtectedRoute><UpcycleHub /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      </Route>

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  </SocketProvider>
);

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppWithSocket />
        {/* Global toast notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              fontFamily: 'Inter, sans-serif',
              fontSize: '13px',
              borderRadius: '10px',
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
            },
            success: { iconTheme: { primary: '#16a34a', secondary: '#fff' } },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}
