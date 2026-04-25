import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  BookOpen, 
  ClipboardCheck, 
  TrendingUp, 
  MessageSquare, 
  Award,
  Palette,
  Settings,
  HelpCircle,
  LogOut,
  Menu,
  X,
  Plus,
  Eye,
  CheckSquare,
  Zap,
  Layers,
  Image
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
  subItems?: NavItem[];
}

const studentNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Lessons', href: '/lessons', icon: BookOpen },
  { label: 'Laboratories', href: '/laboratories', icon: Layers },
  { label: 'Portfolio', href: '/portfolio', icon: Image },
  { 
    label: 'Assessments', 
    href: '/assessments', 
    icon: ClipboardCheck,
    subItems: [
      { label: 'My Assessments', href: '/assessments', icon: Eye },
      { label: 'Submissions', href: '/assessments?tab=submissions', icon: CheckSquare },
    ]
  },
  { label: 'Progress', href: '/progress', icon: TrendingUp },
  { label: 'Forum', href: '/forum', icon: MessageSquare, badge: 3 },
  { label: 'Achievements', href: '/achievements', icon: Award },
];

const instructorNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/instructor/dashboard', icon: LayoutDashboard },
  { label: 'Units', href: '/instructor/courses', icon: BookOpen },
  { label: 'Laboratory Submissions', href: '/instructor/laboratory-submissions', icon: Palette },
  { 
    label: 'Assessments', 
    href: '/instructor/assessments', 
    icon: ClipboardCheck,
    subItems: [
      { label: 'All Assessments', href: '/instructor/assessments', icon: Eye },
      { label: 'Create Assessment', href: '/instructor/assessments/create', icon: Plus },
      { label: 'Submissions', href: '/instructor/assessments?tab=submissions', icon: CheckSquare },
    ]
  },
  { 
    label: 'Quizzes', 
    href: '/instructor/quizzes', 
    icon: Zap,
    subItems: [
      { label: 'All Quizzes', href: '/instructor/quizzes', icon: Eye },
      { label: 'Create Quiz', href: '/instructor/quiz/create', icon: Plus },
    ]
  },
  { label: 'Analytics', href: '/instructor/analytics', icon: TrendingUp },
  { label: 'Messages', href: '/instructor/messages', icon: MessageSquare, badge: 2 },
];

const bottomNavItems: NavItem[] = [
  { label: 'Settings', href: '/settings', icon: Settings },
  { label: 'Help', href: '/help', icon: HelpCircle },
];

interface SidebarProps {
  userRole?: 'student' | 'instructor' | 'admin';
  userName?: string;
  userAvatar?: string;
  xp?: number;
}

export function Sidebar({ 
  userRole = 'student', 
  userName = 'Student', 
  userAvatar,
  xp = 0 
}: SidebarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>(['Assessments']);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  const navItems = userRole === 'student' ? studentNavItems : instructorNavItems;

  const handleLogout = () => {
    logout();
    setIsMobileMenuOpen(false);
    navigate('/login');
  };

  const toggleExpanded = (label: string) => {
    setExpandedItems(prev =>
      prev.includes(label)
        ? prev.filter(l => l !== label)
        : [...prev, label]
    );
  };

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center px-6 border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/15">
            <span className="text-white font-bold text-sm">M</span>
          </div>
          <div>
            <h1 className="text-white font-semibold text-sm leading-tight">Multimedia</h1>
            <p className="text-slate-500 text-[11px] leading-tight">Learning System</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <div className="space-y-1">
          {navItems.map((item) => {
            const isExpanded = expandedItems.includes(item.label);
            const hasSubItems = item.subItems && item.subItems.length > 0;
            const isActive = location.pathname === item.href || 
                           item.subItems?.some(sub => location.pathname === sub.href);

            return (
              <div key={item.label}>
                <div className="flex">
                  <NavLink
                    to={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={({ isActive: linkActive }) =>
                      cn(
                        'flex-1 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                        linkActive || isActive
                          ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                      )
                    }
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span className="bg-violet-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                  {hasSubItems && (
                    <button
                      onClick={() => toggleExpanded(item.label)}
                      className="px-2 py-2.5 text-slate-400 hover:text-slate-100"
                    >
                      <svg
                        className={cn(
                          'w-4 h-4 transition-transform duration-200',
                          isExpanded && 'rotate-180'
                        )}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Sub Items */}
                {hasSubItems && isExpanded && (
                  <div className="mt-1 ml-4 border-l border-slate-800 space-y-1">
                    {item.subItems!.map((subItem) => (
                      <NavLink
                        key={subItem.href}
                        to={subItem.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={({ isActive: subActive }) =>
                          cn(
                            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 pl-4',
                            subActive
                              ? 'bg-violet-500/10 text-violet-400 border-l-2 border-violet-500'
                              : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 border-l-2 border-transparent'
                          )
                        }
                      >
                        <subItem.icon className="w-4 h-4" />
                        <span>{subItem.label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom Navigation */}
        <div className="mt-8 pt-4 border-t border-slate-800 space-y-1">
          {bottomNavItems.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                )
              }
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* User Profile */}
      <div className="border-t border-slate-800 p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center overflow-hidden">
            {userAvatar ? (
              <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-white font-semibold text-sm">
                {userName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{userName}</p>
            <p className="text-slate-400 text-xs">{xp.toLocaleString()} XP</p>
          </div>
          <Button 
            onClick={handleLogout}
            variant="ghost" 
            size="icon" 
            className="text-slate-400 hover:text-slate-100"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-slate-900 rounded-lg border border-slate-800 text-slate-300"
      >
        {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col bg-slate-900/95 backdrop-blur-xl border-r border-slate-800 fixed h-full">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-64 bg-slate-900 border-r border-slate-800">
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  );
}
