import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuthStore } from '@/stores/authStore';

export function StudentLayout() {
  const { user } = useAuthStore();

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-950 aether-shell">
      <Sidebar 
        userRole={user.role}
        userName={user.full_name}
        userAvatar={user.avatar_url}
        yearLevel={user.year_level}
        section={user.section}
      />
      <div className="lg:ml-64 min-h-screen flex flex-col">
        <Header
          title="Learning studio"
          subtitle="Explore lessons, laboratories, and assessments"
        />
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
