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
  UserCheck,
  Users,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Folder,
  Sparkles,
  Trophy,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useEffect, useState, useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useSidebarStore } from '@/stores/sidebarStore';
import { AetherLogo } from '@/components/AetherLogo';
import { useCourseTreeStore } from '@/stores/courseTreeStore';
import { authFetch } from '@/lib/authFetch';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
  subItems?: NavItem[];
  unitId?: string;
  lessonId?: string;
  category?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

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
  const { logout, user: authUser } = useAuthStore();
  const { isCollapsed, toggleCollapsed } = useSidebarStore();
  const { cache, loadUserCourseTree } = useCourseTreeStore();
  const quickActionStorageKey = authUser?.id ? `aether-course-quick-action:${authUser.id}` : 'aether-course-quick-action';

  // ── Delete state ──────────────────────────────────────────────────────────
  const [unitToDelete, setUnitToDelete] = useState<{ id: string; title: string } | null>(null);
  const [lessonToDelete, setLessonToDelete] = useState<{ id: string; title: string; unitId: string } | null>(null);
  const [isDeletingUnit, setIsDeletingUnit] = useState(false);
  const [isDeletingLesson, setIsDeletingLesson] = useState(false);

  const handleConfirmDeleteUnit = async () => {
    if (!unitToDelete) return;
    try {
      setIsDeletingUnit(true);
      const response = await authFetch(`/units/${unitToDelete.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error?.message || 'Failed to delete unit');
      toast.success(`"${unitToDelete.title}" deleted`);
      setUnitToDelete(null);
      // Refresh sidebar tree
      if (authUser?.id) void loadUserCourseTree(authUser.id);
      window.dispatchEvent(new CustomEvent('aether-course-outline-refresh', { detail: { userId: authUser?.id } }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete unit');
    } finally {
      setIsDeletingUnit(false);
    }
  };

  const handleConfirmDeleteLesson = async () => {
    if (!lessonToDelete) return;
    try {
      setIsDeletingLesson(true);
      const response = await authFetch(`/units/lessons/${lessonToDelete.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error?.message || 'Failed to delete lesson');
      toast.success(`"${lessonToDelete.title}" deleted`);
      setLessonToDelete(null);
      // Refresh sidebar tree
      if (authUser?.id) void loadUserCourseTree(authUser.id);
      window.dispatchEvent(new CustomEvent('aether-course-outline-refresh', { detail: { userId: authUser?.id } }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete lesson');
    } finally {
      setIsDeletingLesson(false);
    }
  };

  useEffect(() => {
    if (userRole !== 'instructor' && userRole !== 'student') {
      setCourseOutline([]);
      setExpandedCourseUnits([]);
      return;
    }

    if (!authUser?.id) {
      setCourseOutline([]);
      setExpandedCourseUnits([]);
      return;
    }

    const tree = cache[authUser.id];
    if (!tree) {
      void loadUserCourseTree(authUser.id);
      setCourseOutline([]);
      setExpandedCourseUnits([]);
      return;
    }

    const isInstructor = userRole === 'instructor';
    const outline = tree.units.map((unit) => {
      const unitLessons = tree.lessons.filter((lesson: any) => lesson.unitId === unit.id);
      const latestLesson = [...unitLessons].sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      )[0] || unitLessons[unitLessons.length - 1];

      const unitHref = isInstructor
        ? (latestLesson
            ? `/instructor/lesson/${encodeURIComponent(unit.id)}/${encodeURIComponent(latestLesson.id)}`
            : `/instructor/courses?unit=${encodeURIComponent(unit.id)}`)
        : (latestLesson
            ? `/lessons?unit=${encodeURIComponent(unit.id)}&lesson=${encodeURIComponent(latestLesson.id)}`
            : `/lessons?unit=${encodeURIComponent(unit.id)}`);

      return {
        label: unit.title,
        unitId: unit.id,
        href: unitHref,
        icon: Folder,
        subItems: unitLessons.map((lesson: any) => ({
          label: lesson.title,
          unitId: unit.id,
          lessonId: lesson.id,
          href: isInstructor
            ? `/instructor/lesson/${encodeURIComponent(unit.id)}/${encodeURIComponent(lesson.id)}`
            : `/lessons?unit=${encodeURIComponent(unit.id)}&lesson=${encodeURIComponent(lesson.id)}`,
          icon: FileText,
        })),
      };
    });

    setCourseOutline(outline);
    // Expand active unit
    const currentParams = new URLSearchParams(location.search);
    const activeUnitId = currentParams.get('unit');
    if (activeUnitId) {
      const found = outline.find(u => u.unitId === activeUnitId);
      if (found) {
        setExpandedCourseUnits(prev => prev.includes(found.href) ? prev : [...prev, found.href]);
      }
    } else if (outline.length > 0) {
      setExpandedCourseUnits([outline[0].href]);
    }
  }, [userRole, authUser?.id, cache]);

  useEffect(() => {
    if (userRole === 'instructor') {
      setExpandedItems((prev) => (prev.includes('Units & Lessons') ? prev : [...prev, 'Units & Lessons']));
    } else if (userRole === 'student') {
      setExpandedItems((prev) => (prev.includes('Units & Lessons') ? prev : [...prev, 'Units & Lessons']));
    }
  }, [userRole, authUser?.id]);

  useEffect(() => {
    if (userRole !== 'instructor' && userRole !== 'student') return;

    const handleRefresh = (e: Event) => {
      const customEvent = e as CustomEvent<{ userId?: string | null }>;
      const targetUserId = customEvent.detail?.userId ?? authUser?.id;
      if (targetUserId) {
        void loadUserCourseTree(targetUserId);
      }
    };

    window.addEventListener('aether-course-outline-refresh', handleRefresh);
    return () => window.removeEventListener('aether-course-outline-refresh', handleRefresh);
  }, [userRole, authUser?.id, loadUserCourseTree]);

  const handleLogout = () => {
    logout();
    setIsMobileMenuOpen(false);
    navigate('/login');
  };

  const handleQuickAdd = (mode: 'unit' | 'lesson', unitId?: string) => {
    const quickAction = { mode, unitId: unitId ?? null };
    sessionStorage.setItem(quickActionStorageKey, JSON.stringify(quickAction));
    sessionStorage.removeItem('aether-course-quick-action');

    setIsMobileMenuOpen(false);

    const action = mode === 'unit' ? 'add-unit' : 'add-lesson';
    const params = new URLSearchParams({ view: 'units', action });
    if (unitId) params.set('unit', unitId);

    navigate(`/instructor/courses?${params.toString()}`);
  };

  const toggleExpanded = (label: string) => {
    setExpandedItems((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  // Build categorized groups for Option 1
  const categorizedGroups: NavGroup[] = useMemo(() => {
    if (userRole === 'student') {
      return [
        {
          title: 'Academic & Learning',
          items: [
            { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
            { label: 'Units & Lessons', href: '/lessons', icon: BookOpen, subItems: courseOutline },
          ],
        },
        {
          title: 'Assessment & Result',
          items: [
            {
              label: 'Quizzes',
              href: '/quizzes',
              icon: Zap,
              subItems: [
                { label: 'Quiz Result', href: '/quizzes#quiz-result', icon: Trophy },
              ],
            },
            { label: 'Laboratories', href: '/laboratories', icon: Layers },
            { label: 'Portfolio', href: '/portfolio', icon: Image },
          ],
        },
        {
          title: 'Announcements & Communication',
          items: [
            { label: 'Messages', href: '/chatbox', icon: MessageSquare },
          ],
        },
      ];
    }

    if (userRole === 'instructor') {
      return [
        {
          title: 'Curriculum Studio',
          items: [
            { label: 'Dashboard', href: '/instructor/dashboard', icon: LayoutDashboard },
            { label: 'Units & Lessons', href: '/instructor/courses', icon: BookOpen, subItems: courseOutline },
          ],
        },
        {
          title: 'Laboratory & Submissions',
          items: [
            { label: 'Laboratories', href: '/instructor/laboratories', icon: Layers },
            {
              label: 'Laboratory Submissions',
              href: '/instructor/laboratory-submissions',
              icon: ClipboardCheck,
              subItems: [
                { label: 'Laboratory Results', href: '/instructor/laboratory-submissions#lab-results', icon: ClipboardCheck },
              ],
            },
          ],
        },
        {
          title: 'Evaluation & Quizzes',
          items: [
            { label: 'View All Students', href: '/instructor/student-performance', icon: Users },
            {
              label: 'Quizzes',
              href: '/instructor/quizzes',
              icon: Zap,
              subItems: [
                { label: 'Quiz Result', href: '/instructor/quizzes#quiz-result', icon: ClipboardCheck },
              ],
            },
          ],
        },
        {
          title: 'Announcements & Communication',
          items: [
            { label: 'Student Approvals', href: '/instructor/student-approvals', icon: UserCheck },
            { label: 'Announcements', href: '/instructor/announcements', icon: MessageSquare },
          ],
        },
      ];
    }

    return [
      {
        title: 'Administration',
        items: [
          { label: 'Instructor Approvals', href: '/admin/instructors', icon: UserCheck },
        ],
      },
    ];
  }, [userRole, courseOutline]);

  const SidebarContent = ({ isRail = false }: { isRail?: boolean }) => (
    <div className="flex h-full flex-col aether-sidebar select-none">
      {/* Brand Header */}
      <div className={cn(
        'flex h-16 items-center border-b border-slate-200/80 dark:border-slate-800/80 transition-all duration-300',
        isRail ? 'justify-center px-2' : 'justify-between px-5'
      )}>
        <div className="flex items-center gap-3 min-w-0">
          <AetherLogo compact />
          {!isRail && (
            <div className="truncate">
              <h1 className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white leading-tight">
                Multimedia
              </h1>
              <p className="text-[10px] font-semibold text-violet-600 dark:text-violet-400 leading-tight tracking-wider uppercase">
                Learning System
              </p>
            </div>
          )}
        </div>

        {/* Desktop Collapse Trigger */}
        {!isRail && (
          <button
            onClick={toggleCollapsed}
            type="button"
            className="hidden lg:flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
            title="Collapse sidebar (Mini-Rail)"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-4">
        {categorizedGroups.map((group, groupIdx) => (
          <div key={group.title} className="space-y-1">
            {/* Section Title */}
            {!isRail ? (
              <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {group.title}
              </div>
            ) : groupIdx > 0 ? (
              <div className="my-2 border-t border-slate-200 dark:border-slate-800/80" />
            ) : null}

            {/* Nav Items */}
            {group.items.map((item) => {
              const isExpanded = expandedItems.includes(item.label);
              const isCourseOutlineItem =
                (item.label === 'Units & Lessons' && userRole === 'instructor') ||
                (item.label === 'Units & Lessons' && userRole === 'student');
              const hasSubItems = Boolean((item.subItems && item.subItems.length > 0) || isCourseOutlineItem);

              const currentPath = location.pathname;
              const isPrimaryActive =
                currentPath === item.href.split('?')[0] ||
                (item.href === '/lessons' && currentPath.startsWith('/lessons')) ||
                (item.href.startsWith('/instructor/courses') && currentPath.startsWith('/instructor/courses'));

              if (isRail) {
                return (
                  <NavLink
                    key={item.label}
                    to={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'relative flex h-11 w-full items-center justify-center rounded-xl transition-all duration-200 group',
                        isActive || isPrimaryActive
                          ? 'bg-violet-600 text-white shadow-md shadow-violet-500/25'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                      )
                    }
                    title={item.label}
                  >
                    <item.icon className="w-5 h-5" />
                    {/* Active glowing dot */}
                    {(isPrimaryActive) && (
                      <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-4 bg-violet-500 rounded-r" />
                    )}
                  </NavLink>
                );
              }

              return (
                <div key={item.label} className="space-y-0.5">
                  <div className="flex items-center">
                    <NavLink
                      to={item.href}
                      onClick={() => {
                        if (hasSubItems && !isExpanded) {
                          setExpandedItems((current) => [...current, item.label]);
                        }
                        setIsMobileMenuOpen(false);
                      }}
                      className={({ isActive }) =>
                        cn(
                          'flex-1 flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition-all duration-200',
                          isActive || isPrimaryActive
                            ? 'bg-violet-500/15 text-violet-700 dark:text-violet-300 font-bold border-l-2 border-violet-500 shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100 border-l-2 border-transparent'
                        )
                      }
                    >
                      <item.icon className={cn('w-4 h-4 shrink-0', (isPrimaryActive) ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400')} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge && (
                        <span className="bg-violet-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </NavLink>

                    {hasSubItems && (
                      <button
                        type="button"
                        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${item.label}`}
                        onClick={() => toggleExpanded(item.label)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                      >
                        <ChevronDown
                          className={cn('w-3.5 h-3.5 transition-transform duration-200', !isExpanded && '-rotate-90')}
                        />
                      </button>
                    )}
                  </div>

                  {/* Sub-Items Tree (Accordion) */}
                  {hasSubItems && isExpanded && (
                    <div className="ml-3 pl-2.5 border-l border-slate-200 dark:border-slate-800/80 space-y-1 my-1">
                      {item.label === 'Units & Lessons' && userRole === 'instructor' && (
                        <button
                          type="button"
                          onClick={() => handleQuickAdd('unit')}
                          className="flex w-full items-center gap-2 rounded-lg border border-dashed border-violet-500/30 bg-violet-500/5 px-2.5 py-1.5 text-left text-[11px] font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-500/10 transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                          Add Unit
                        </button>
                      )}

                      {item.subItems && item.subItems.length > 0 ? (
                        isCourseOutlineItem ? (
                          // ── Course-outline items: units with lessons, delete buttons, Add Lesson ──
                          item.subItems.map((subItem) => {
                            const unitId = subItem.unitId || (new URLSearchParams(subItem.href.split('?')[1] || '').get('unit') || undefined);
                            const hasLessonItems = Boolean(subItem.subItems?.length);
                            const currentSearchParams = new URLSearchParams(location.search);
                            const activeUnitId = currentSearchParams.get('unit');
                            const activeLessonId = currentSearchParams.get('lesson');

                            const isThisUnitActive = location.pathname.startsWith('/lessons')
                              ? activeUnitId === unitId
                              : location.pathname.includes(`/instructor/courses`) && activeUnitId === unitId;

                            return (
                              <div key={subItem.href} className="space-y-0.5 group/unit">
                                <div className="flex items-center gap-0.5">
                                  <NavLink
                                    to={subItem.href}
                                    onClick={() => {
                                      if (!expandedCourseUnits.includes(subItem.href)) {
                                        setExpandedCourseUnits((current) => [...current, subItem.href]);
                                      }
                                      setIsMobileMenuOpen(false);
                                    }}
                                    className={cn(
                                      'flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all duration-200',
                                      isThisUnitActive
                                        ? 'bg-violet-500/15 text-violet-700 dark:text-violet-300 font-bold border-l-2 border-violet-500'
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200 border-l-2 border-transparent'
                                    )}
                                  >
                                    <Folder className={cn('h-3.5 w-3.5 shrink-0', isThisUnitActive ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400')} />
                                    <span className="truncate flex-1">{subItem.label}</span>
                                    {subItem.subItems && subItem.subItems.length > 0 && (
                                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                        ({subItem.subItems.length})
                                      </span>
                                    )}
                                  </NavLink>

                                  {/* Unit action buttons — only for instructors */}
                                  {userRole === 'instructor' && (
                                    <>
                                      {hasLessonItems && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setExpandedCourseUnits((current) =>
                                              current.includes(subItem.href)
                                                ? current.filter((href) => href !== subItem.href)
                                                : [...current, subItem.href]
                                            )
                                          }
                                          className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                        >
                                          <ChevronRight
                                            className={cn(
                                              'w-3 h-3 transition-transform duration-200',
                                              expandedCourseUnits.includes(subItem.href) && 'rotate-90'
                                            )}
                                          />
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setUnitToDelete({ id: subItem.unitId!, title: subItem.label });
                                        }}
                                        className="p-1 rounded opacity-0 group-hover/unit:opacity-100 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                        title={`Delete ${subItem.label}`}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </>
                                  )}

                                  {/* Student view: just the chevron */}
                                  {userRole !== 'instructor' && hasLessonItems && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedCourseUnits((current) =>
                                          current.includes(subItem.href)
                                            ? current.filter((href) => href !== subItem.href)
                                            : [...current, subItem.href]
                                        )
                                      }
                                      className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                    >
                                      <ChevronRight
                                        className={cn(
                                          'w-3 h-3 transition-transform duration-200',
                                          expandedCourseUnits.includes(subItem.href) && 'rotate-90'
                                        )}
                                      />
                                    </button>
                                  )}
                                </div>

                                {/* Lesson sub-items */}
                                {expandedCourseUnits.includes(subItem.href) && (
                                  <div className="ml-3 pl-2 border-l border-slate-200 dark:border-slate-800/80 space-y-0.5 py-0.5">
                                    {hasLessonItems &&
                                      subItem.subItems!.map((lessonItem) => {
                                        const lessonUrlParams = new URLSearchParams(lessonItem.href.split('?')[1] || '');
                                        const lessonTargetId = lessonUrlParams.get('lesson');
                                        const isThisLessonActive = location.pathname.startsWith('/lessons')
                                          ? activeLessonId === lessonTargetId
                                          : location.pathname.includes(`/instructor/lesson/`);

                                        return (
                                          <div key={lessonItem.href} className="flex items-center gap-0.5 group/lesson">
                                            <NavLink
                                              to={lessonItem.href}
                                              onClick={() => setIsMobileMenuOpen(false)}
                                              className={cn(
                                                'flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] transition-all',
                                                isThisLessonActive
                                                  ? 'bg-violet-600/20 text-violet-700 dark:text-violet-300 font-bold'
                                                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
                                              )}
                                            >
                                              <FileText className={cn('h-3 w-3 shrink-0', isThisLessonActive ? 'text-violet-500' : 'text-slate-400')} />
                                              <span className="truncate">{lessonItem.label}</span>
                                            </NavLink>

                                            {/* Lesson delete — instructor only */}
                                            {userRole === 'instructor' && (
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  setLessonToDelete({
                                                    id: lessonItem.lessonId!,
                                                    title: lessonItem.label,
                                                    unitId: lessonItem.unitId!,
                                                  });
                                                }}
                                                className="p-1 rounded opacity-0 group-hover/lesson:opacity-100 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0"
                                                title={`Delete ${lessonItem.label}`}
                                              >
                                                <Trash2 className="h-3 w-3" />
                                              </button>
                                            )}
                                          </div>
                                        );
                                      })}

                                    {!hasLessonItems && (
                                      <p className="px-2 py-0.5 text-[10px] text-slate-400">No lessons yet</p>
                                    )}

                                    {userRole === 'instructor' && (
                                      <button
                                        type="button"
                                        onClick={() => handleQuickAdd('lesson', unitId)}
                                        className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-[10px] font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-500/10"
                                      >
                                        <Plus className="h-3 w-3" />
                                        Add Lesson
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          // ── Non-course items (Laboratories, Quizzes, etc.): plain flat NavLinks ──
                          item.subItems.map((subItem) => {
                            const isSubActive = location.pathname === subItem.href || location.pathname.startsWith(subItem.href + '/');
                            return (
                              <NavLink
                                key={subItem.href}
                                to={subItem.href}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={cn(
                                  'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all duration-200',
                                  isSubActive
                                    ? 'bg-violet-500/15 text-violet-700 dark:text-violet-300 font-bold border-l-2 border-violet-500'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200 border-l-2 border-transparent'
                                )}
                              >
                                <subItem.icon className={cn('h-3.5 w-3.5 shrink-0', isSubActive ? 'text-violet-500' : 'text-slate-400')} />
                                <span className="truncate">{subItem.label}</span>
                              </NavLink>
                            );
                          })
                        )
                      ) : isCourseOutlineItem ? (
                        <p className="px-2 py-1 text-[10px] text-slate-400">No units yet</p>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User Profile & Footer Dock */}
      <div className="border-t border-slate-200/80 dark:border-slate-800/80 p-3 bg-slate-50/50 dark:bg-slate-950/50">
        {isRail ? (
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={toggleCollapsed}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-violet-500 transition-colors"
              title="Expand Sidebar"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>

            <button
              onClick={handleLogout}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 p-2 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                {userAvatar ? (
                  <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white font-bold text-xs">
                    {userName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate leading-tight">
                  {userName}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate leading-tight mt-0.5">
                  {userRole === 'student'
                    ? (section ? `Sec ${section}` : 'Student')
                    : 'Instructor'}
                </p>
              </div>
            </div>

            <Button
              onClick={handleLogout}
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl shrink-0"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 shadow-sm"
      >
        {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Desktop Sidebar (Collapsible Rail Mode) */}
      <aside
        className={cn(
          'hidden lg:flex flex-col bg-white/95 dark:bg-slate-950/95 border-r border-slate-200/80 dark:border-slate-800/80 fixed h-full z-40 transition-all duration-300 ease-in-out backdrop-blur-xl',
          isCollapsed ? 'w-20' : 'w-64'
        )}
      >
        <SidebarContent isRail={isCollapsed} />
      </aside>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 w-72 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col">
            <SidebarContent isRail={false} />
          </aside>
        </div>
      )}

      {/* ── Delete Unit Confirmation ─────────────────────────────────────── */}
      <AlertDialog open={!!unitToDelete} onOpenChange={(open) => { if (!open) setUnitToDelete(null); }}>
        <AlertDialogContent className="border border-slate-800 bg-slate-950 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Unit?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Deleting <span className="font-semibold text-slate-200">"{unitToDelete?.title}"</span> will permanently remove it
              and <span className="font-semibold text-red-400">all lessons inside it</span>. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
              onClick={() => setUnitToDelete(null)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteUnit}
              disabled={isDeletingUnit}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeletingUnit ? 'Deleting…' : 'Yes, delete unit'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete Lesson Confirmation ───────────────────────────────────── */}
      <AlertDialog open={!!lessonToDelete} onOpenChange={(open) => { if (!open) setLessonToDelete(null); }}>
        <AlertDialogContent className="border border-slate-800 bg-slate-950 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Lesson?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              <span className="font-semibold text-slate-200">"{lessonToDelete?.title}"</span> will be permanently deleted.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
              onClick={() => setLessonToDelete(null)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteLesson}
              disabled={isDeletingLesson}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeletingLesson ? 'Deleting…' : 'Yes, delete lesson'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
