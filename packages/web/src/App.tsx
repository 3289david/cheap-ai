import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './store';
import Landing from './pages/Landing';
import Login from './pages/Login';
import IDE from './pages/IDE';
import Admin from './pages/Admin';
import AuthGuard from './components/AuthGuard';
import AdminGuard from './components/AdminGuard';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Navigate to="/login" replace />} />
        <Route path="/app" element={<AuthGuard><IDE /></AuthGuard>} />
        <Route path="/admin/*" element={<AdminGuard><Admin /></AdminGuard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
