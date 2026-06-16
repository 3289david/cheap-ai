import { Navigate } from 'react-router-dom';
import { useStore } from '../store';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const token = useStore(s => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
