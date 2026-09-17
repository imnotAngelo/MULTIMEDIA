import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Breadcrumbs } from './Breadcrumbs';
import { useAuthStore } from '@/stores/authStore';
import { useSidebarStore } from '@/stores/sidebarStore';
import { cn } from '@/lib/utils';

export function InstructorLayout() {
  const { user } = useAuthStore();
  const isCollapsed = useSidebarStore((s) => s.isCollapsed);

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
      <div className={cn('min-w-0 min-h-screen flex flex-col transition-all duration-300 ease-in-out', isCollapsed ? 'lg:ml-20' : 'lg:ml-64')}>
        <Header
          title="Instructor Dashboard"
        />
        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <Breadcrumbs />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
