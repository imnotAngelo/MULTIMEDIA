import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuthStore } from '@/stores/authStore';

export function InstructorLayout() {
  const { user } = useAuthStore();

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-950 aether-shell">
      <Sidebar
        userRole="instructor"
        userName={user.full_name}
        userAvatar={user.avatar_url}
        yearLevel={user.year_level}
        section={user.section}
      />
      <div className="lg:ml-64 min-w-0 min-h-screen flex flex-col">
        <Header
          title="Instructor Dashboard"
        />
        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
