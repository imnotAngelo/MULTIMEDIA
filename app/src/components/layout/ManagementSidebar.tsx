import { LayoutDashboard, BookOpen, ClipboardCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ManagementSidebarProps {
  activeTab: 'dashboard' | 'units' | 'assessments';
  onTabChange: (tab: 'dashboard' | 'units' | 'assessments') => void;
}

export function ManagementSidebar({ activeTab, onTabChange }: ManagementSidebarProps) {
  return (
    <aside className="w-64 bg-slate-900/95 backdrop-blur-xl border-r border-slate-800 flex flex-col sticky top-0 h-screen">
      {/* Sidebar Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800">
        <h2 className="text-lg font-semibold text-white">Management</h2>
      </div>

      {/* Sidebar Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {/* Dashboard */}
        <button
          onClick={() => onTabChange('dashboard')}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all duration-200',
            activeTab === 'dashboard'
              ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
              : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
          )}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span>Dashboard</span>
        </button>

        {/* Units */}
        <button
          onClick={() => onTabChange('units')}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all duration-200',
            activeTab === 'units'
              ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
              : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
          )}
        >
          <BookOpen className="w-5 h-5" />
          <span>Units</span>
        </button>

        {/* Assessments */}
        <button
          onClick={() => onTabChange('assessments')}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all duration-200',
            activeTab === 'assessments'
              ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
              : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
          )}
        >
          <ClipboardCheck className="w-5 h-5" />
          <span>Assessments</span>
        </button>
      </nav>
    </aside>
  );
}
