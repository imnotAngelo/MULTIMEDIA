import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'student' | 'instructor' | 'admin';
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, user, isHydrated } = useAuthStore();

  // Wait for hydration from localStorage
  if (!isHydrated) {
    return null;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
