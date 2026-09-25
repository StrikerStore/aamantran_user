import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { isAuthenticated } from './lib/auth';
import { Layout } from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import GenerateInvitation from './pages/GenerateInvitation';
import EditInvitation from './pages/EditInvitation';
import GuestsHub, { WishesRedirect } from './pages/GuestsHub';
import Settings from './pages/Settings';
import Support from './pages/Support';
import Review from './pages/Review';
import Guide from './pages/Guide';
import Share from './pages/Share';
import Tasks from './pages/Tasks';
import Inventory from './pages/Inventory';
import Budget from './pages/Budget';
import Vendors from './pages/Vendors';
import Timeline from './pages/Timeline';
import MoodBoard from './pages/MoodBoard';
import Gifts from './pages/Gifts';
import PhotoWall from './pages/PhotoWall';

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
          {/* The old set-up page is retired — invitations are created at checkout. */}
          <Route path="/onboarding" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"  element={<Dashboard />} />
          <Route path="/events/:id/generate"  element={<GenerateInvitation />} />
          <Route path="/events/:id/edit"      element={<EditInvitation />} />
          <Route path="/events/:id/guests"    element={<GuestsHub />} />
          <Route path="/events/:id/wishes"    element={<WishesRedirect />} />
          <Route path="/events/:id/tasks"     element={<Tasks />} />
          <Route path="/events/:id/inventory" element={<Inventory />} />
          <Route path="/events/:id/budget"    element={<Budget />} />
          <Route path="/events/:id/vendors"   element={<Vendors />} />
          <Route path="/events/:id/timeline"  element={<Timeline />} />
          <Route path="/events/:id/moodboard" element={<MoodBoard />} />
          <Route path="/events/:id/gifts"     element={<Gifts />} />
          <Route path="/events/:id/photos"    element={<PhotoWall />} />
          <Route path="/events/:id/share"     element={<Share />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/support"  element={<Support />} />
          <Route path="/review"   element={<Review />} />
          <Route path="/guide"    element={<Guide />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to={isAuthenticated() ? '/dashboard' : '/'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
