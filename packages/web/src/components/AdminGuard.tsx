import { Navigate } from 'react-router-dom';
import { useStore } from '../store';

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const user = useStore(s => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (!['admin', 'super_admin'].includes(user.role)) return <Navigate to="/app" replace />;
  return <>{children}</>;
}
