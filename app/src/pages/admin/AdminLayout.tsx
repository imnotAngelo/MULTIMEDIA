import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { useAuthStore } from '@/stores/authStore';

export function AdminLayout() {
  const { user } = useAuthStore();

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-950 aether-shell">
      <Sidebar userRole="admin" userName={user.full_name} userAvatar={user.avatar_url} />
      <div className="lg:ml-64 min-h-screen flex flex-col">
        <Header title="Administration" subtitle="Review instructor access requests" />
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}