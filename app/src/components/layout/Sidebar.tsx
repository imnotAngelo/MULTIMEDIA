import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  BookOpen, 
  FileText,
  ClipboardCheck, 
  MessageSquare, 
  Palette,
  LogOut,
  Menu,
  X,
  Plus,
  Eye,
  CheckSquare,
  Zap,
  Layers,
  Image,
  UserCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { AetherLogo } from '@/components/AetherLogo';
import { authFetch } from '@/lib/authFetch';

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
  { label: 'Quizzes', href: '/quizzes', icon: Zap },
  { label: 'Message', href: '/chatbox', icon: MessageSquare },
];

const instructorNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/instructor/dashboard', icon: LayoutDashboard },
  {
    label: 'Units & Lessons',
    href: '/instructor/courses?view=units',
    icon: BookOpen,
    subItems: [],
  },
  { label: 'Laboratory Submissions', href: '/instructor/laboratory-submissions', icon: Palette },
  { 
    label: 'Laboratories', 
    href: '/instructor/laboratories', 
    icon: Layers,
    subItems: [
      { label: 'All Laboratories', href: '/instructor/laboratories', icon: Eye },
      { label: 'Create Laboratory', href: '/instructor/laboratories/create', icon: Plus },
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
  { label: 'Student approvals', href: '/instructor/student-approvals', icon: UserCheck },
  { label: 'Messages', href: '/instructor/messages', icon: MessageSquare },
];

const adminNavItems: NavItem[] = [
  { label: 'Instructor approvals', href: '/admin/instructors', icon: UserCheck },
];

const bottomNavItems: NavItem[] = [];

interface SidebarProps {
  userRole?: 'student' | 'instructor' | 'admin';
  userName?: string;
  userAvatar?: string;
  yearLevel?: number | null;
  section?: string | null;
}

export function Sidebar({ 
  userRole = 'student', 
  userName = 'Student', 
  userAvatar,
  yearLevel,
  section,
}: SidebarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>(['Laboratories', 'Units & Lessons']);
  const [courseOutline, setCourseOutline] = useState<NavItem[]>([]);
  const [expandedCourseUnits, setExpandedCourseUnits] = useState<string[]>([]);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  const navItems = userRole === 'student'
    ? studentNavItems
    : userRole === 'admin'
      ? adminNavItems
      : instructorNavItems;

  useEffect(() => {
    if (userRole !== 'instructor') return;

    let cancelled = false;
    const loadCourseOutline = async () => {
      try {
        const response = await authFetch('/units', { cache: 'no-store' });
        const payload = await response.json();
        if (!response.ok || !payload.success) return;

        const units = Array.isArray(payload.data) ? payload.data : [];
        const outline = await Promise.all(units.map(async (unit: any) => {
          try {
            const lessonsResponse = await authFetch(`/units/${unit.id}/lessons`, { cache: 'no-store' });
            const lessonsPayload = await lessonsResponse.json();
            const lessons = lessonsResponse.ok && lessonsPayload.success && Array.isArray(lessonsPayload.data)
              ? lessonsPayload.data
              : [];

            return {
              label: unit.title,
              href: `/instructor/courses?unit=${encodeURIComponent(unit.id)}`,
              icon: Layers,
              subItems: lessons.map((lesson: any) => ({
                label: lesson.title,
                href: `/instructor/courses?unit=${encodeURIComponent(unit.id)}&lesson=${encodeURIComponent(lesson.id)}`,
                icon: FileText,
              })),
            };
          } catch {
            return {
              label: unit.title,
              href: `/instructor/courses?unit=${encodeURIComponent(unit.id)}`,
              icon: Layers,
              subItems: [],
            };
          }
        }));

        if (!cancelled) {
          setCourseOutline(outline);
          setExpandedCourseUnits(outline.map((unit) => unit.href));
        }
      } catch {
        if (!cancelled) setCourseOutline([]);
      }
    };

    loadCourseOutline();
    return () => { cancelled = true; };
  }, [userRole]);

  const resolvedNavItems = navItems.map((item) => (
    item.label === 'Units & Lessons' && userRole === 'instructor'
      ? { ...item, subItems: courseOutline }
      : item
  ));

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
    <div className="flex h-full flex-col aether-sidebar">
      {/* Logo */}
      <div className="flex h-16 items-center px-6 border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <AetherLogo compact />
          <div>
            <h1 className="text-white font-semibold text-sm leading-tight">Multimedia</h1>
            <p className="text-slate-300 text-[11px] leading-tight">Learning System</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <div className="space-y-1">
          {resolvedNavItems.map((item) => {
            const isExpanded = expandedItems.includes(item.label);
            const hasSubItems = item.subItems && item.subItems.length > 0;
            const isActive = location.pathname === item.href.split('?')[0] ||
              item.subItems?.some(sub => `${location.pathname}${location.search}` === sub.href);

            return (
              <div key={item.label}>
                <div className="flex aether-orbit">
                  <NavLink
                    to={item.href}
                    onClick={() => {
                      if (hasSubItems && !isExpanded) {
                        setExpandedItems((current) => [...current, item.label]);
                      }
                      setIsMobileMenuOpen(false);
                    }}
                    className={({ isActive: linkActive }) =>
                      cn(
                        'sidebar-nav-link flex-1 flex items-center gap-3 rounded-lg border px-3 py-2.5 text-[13px] font-medium transition-all duration-200',
                        linkActive || isActive
                          ? 'sidebar-nav-link--active border-teal-300/40 bg-teal-400/10 text-teal-200'
                          : 'border-transparent text-slate-200 hover:bg-slate-800/60 hover:text-white'
                      )
                    }
                  >
                    <item.icon className="w-5 h-5 aether-icon" />
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
                      className="rounded-md px-2 py-2.5 text-slate-300 hover:bg-slate-800/60 hover:text-teal-200"
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
                      <div key={subItem.href}>
                        <div className="flex items-center">
                          <NavLink
                            to={subItem.href}
                            onClick={() => {
                              if (subItem.subItems && subItem.subItems.length > 0 && !expandedCourseUnits.includes(subItem.href)) {
                                setExpandedCourseUnits((current) => [...current, subItem.href]);
                              }
                              setIsMobileMenuOpen(false);
                            }}
                            className={({ isActive: subActive }) =>
                              cn(
                                'sidebar-subnav-link flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2 pl-4 text-[12px] font-medium transition-all duration-200',
                                subActive
                                  ? 'border-l-2 border-teal-300 bg-teal-400/10 text-teal-200'
                                  : 'border-l-2 border-transparent text-slate-300 hover:bg-slate-800/60 hover:text-white'
                              )
                            }
                          >
                            <subItem.icon className="h-4 w-4 shrink-0" />
                            <span className="truncate">{subItem.label}</span>
                          </NavLink>
                          {subItem.subItems && subItem.subItems.length > 0 && (
                            <button
                              type="button"
                              aria-label={`${expandedCourseUnits.includes(subItem.href) ? 'Hide' : 'Show'} lessons for ${subItem.label}`}
                              aria-expanded={expandedCourseUnits.includes(subItem.href)}
                              onClick={() => setExpandedCourseUnits((current) => (
                                current.includes(subItem.href)
                                  ? current.filter((href) => href !== subItem.href)
                                  : [...current, subItem.href]
                              ))}
                              className="mr-1 rounded p-1.5 text-slate-300 hover:bg-slate-800 hover:text-teal-200"
                            >
                              <svg
                                className={cn('h-3.5 w-3.5 transition-transform', expandedCourseUnits.includes(subItem.href) && 'rotate-180')}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          )}
                        </div>
                        {subItem.subItems && subItem.subItems.length > 0 && expandedCourseUnits.includes(subItem.href) && (
                          <div className="ml-4 border-l border-slate-800/80 pl-2">
                            {subItem.subItems.map((lessonItem) => (
                              <NavLink
                                key={lessonItem.href}
                                to={lessonItem.href}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={({ isActive: lessonActive }) => cn(
                                  'sidebar-lesson-link flex items-center gap-2 rounded-md px-3 py-1.5 text-[11px] transition-colors',
                                  lessonActive
                                    ? 'bg-teal-400/10 text-teal-200'
                                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                                )}
                              >
                                <FileText className="h-3 w-3 shrink-0" />
                                <span className="truncate">{lessonItem.label}</span>
                              </NavLink>
                            ))}
                          </div>
                        )}
                      </div>
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
                    : 'text-slate-200 hover:bg-slate-800/60 hover:text-white'
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
      <div className="sidebar-profile border-t border-slate-800 p-4">
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
            <p className="text-slate-300 text-xs truncate">
              {section ? `Section ${section}` : 'Section not set'}
            </p>
          </div>
          <Button 
            onClick={handleLogout}
            variant="ghost" 
            size="icon" 
            className="text-slate-300 hover:text-white"
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
      <aside className="hidden lg:flex w-64 flex-col bg-slate-950/95 border-r border-teal-400/20 fixed h-full aether-panel">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="sidebar-mobile-backdrop absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <aside className="sidebar-mobile-drawer absolute left-0 top-0 h-full w-64 bg-slate-950/95 border-r border-teal-400/20 aether-panel">
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  );
}
