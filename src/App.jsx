import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { isAuthenticated } from './lib/auth';
import { Layout } from './components/Layout';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import GenerateInvitation from './pages/GenerateInvitation';
import EditInvitation from './pages/EditInvitation';
import GuestManager from './pages/GuestManager';
import WishManager from './pages/WishManager';
import Settings from './pages/Settings';
import Support from './pages/Support';
import Review from './pages/Review';

function RequireAuth({ children }) {
  return isAuthenticated() ? children : <Navigate to="/" replace />;
}

function RequireGuest({ children }) {
  return isAuthenticated() ? <Navigate to="/dashboard" replace /> : children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<RequireGuest><Login /></RequireGuest>} />

        {/* Protected */}
        <Route element={<RequireAuth><Layout /></RequireAuth>}>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/dashboard"  element={<Dashboard />} />
          <Route path="/events/:id/generate" element={<GenerateInvitation />} />
          <Route path="/events/:id/edit"     element={<EditInvitation />} />
          <Route path="/events/:id/guests"   element={<GuestManager />} />
          <Route path="/events/:id/wishes"   element={<WishManager />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/support"  element={<Support />} />
          <Route path="/review"   element={<Review />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to={isAuthenticated() ? '/dashboard' : '/'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
