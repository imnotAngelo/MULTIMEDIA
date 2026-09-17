import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { useThemeStore } from '@/stores/themeStore';

const ROUTE_LABELS: Record<string, string> = {
  instructor: 'Instructor',
  student: 'Student',
  admin: 'Admin',
  dashboard: 'Dashboard',
  courses: 'Courses & Units',
  lessons: 'Lessons',
  lesson: 'Lesson Viewer',
  assessments: 'Assessments',
  quizzes: 'Quizzes',
  exam: 'Examination',
  laboratories: 'Laboratories',
  'laboratory-submissions': 'Submissions',
  portfolio: 'Portfolio',
  announcements: 'Announcements',
  messages: 'Messages',
  settings: 'Settings',
  'student-approvals': 'Student Approvals',
  'student-performance': 'Student Performance',
  'create-auto': 'AI Auto-Generate Quiz',
  'create-manual': 'Create Quiz Manually',
  create: 'Create',
};

export function Breadcrumbs() {
  const location = useLocation();
  const theme = useThemeStore((state) => state.theme);
  const isLightMode = theme === 'light';

  const pathSegments = location.pathname.split('/').filter(Boolean);

  if (pathSegments.length === 0) return null;

  // Build breadcrumb items
  const breadcrumbs = pathSegments.map((segment, index) => {
    const url = `/${pathSegments.slice(0, index + 1).join('/')}`;
    const isLast = index === pathSegments.length - 1;
    // Format UUIDs / IDs cleanly
    const isId = /^[0-9a-fA-F-]{8,}$/.test(segment) || /^\d+$/.test(segment);
    const label = isId ? 'Item Detail' : ROUTE_LABELS[segment] || segment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    return {
      label,
      url,
      isLast,
    };
  });

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center gap-1.5 text-xs py-2 px-1 mb-3 transition-colors ${
        isLightMode ? 'text-slate-500' : 'text-slate-400'
      }`}
    >
      <Link
        to="/"
        className={`flex items-center gap-1 hover:text-violet-500 transition-colors ${
          isLightMode ? 'text-slate-600' : 'text-slate-300'
        }`}
      >
        <Home className="w-3.5 h-3.5" />
      </Link>

      {breadcrumbs.map((crumb, idx) => (
        <div key={crumb.url + idx} className="flex items-center gap-1.5">
          <ChevronRight className="w-3.5 h-3.5 opacity-50 shrink-0" />
          {crumb.isLast ? (
            <span
              className={`font-semibold truncate max-w-[200px] ${
                isLightMode ? 'text-slate-900' : 'text-slate-100'
              }`}
            >
              {crumb.label}
            </span>
          ) : (
            <Link
              to={crumb.url}
              className="hover:text-violet-500 transition-colors truncate max-w-[150px]"
            >
              {crumb.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}
export default Breadcrumbs;

