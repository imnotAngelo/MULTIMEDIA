import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuthStore } from '@/stores/authStore';

export function InstructorLayout() {
  const { user } = useAuthStore();

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-950">
      <Sidebar
        userRole="instructor"
        userName={user.full_name}
        userAvatar={user.avatar_url}
        xp={user.xp_total}
      />
      <div className="lg:ml-64 min-h-screen flex flex-col">
        <Header title="Instructor Dashboard" subtitle="Manage your courses and content" />
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
