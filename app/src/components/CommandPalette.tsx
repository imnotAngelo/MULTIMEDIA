import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  LayoutDashboard,
  BookOpen,
  Sparkles,
  Beaker,
  FileCheck,
  Settings,
  Sun,
  Moon,
  LogOut,
  GraduationCap,
  MessageSquare,
  FileText,
  UserCheck,
  Users,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';

interface CommandPaletteProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CommandPalette({ open: controlledOpen, onOpenChange: setControlledOpen }: CommandPaletteProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? setControlledOpen! : setInternalOpen;

  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();

  const isInstructor = user?.role === 'instructor';
  const isAdmin = user?.role === 'admin';

  // Toggle on Ctrl+K or Cmd+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, setOpen]);

  const runCommand = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search destination... (e.g. quiz, lessons, labs)" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Quick Navigation */}
        <CommandGroup heading="Navigation">
          <CommandItem
            onSelect={() =>
              runCommand(() =>
                navigate(isInstructor ? '/instructor/dashboard' : isAdmin ? '/admin/instructors' : '/dashboard')
              )
            }
          >
            <LayoutDashboard className="mr-2.5 h-4 w-4 text-violet-500" />
            <span>Dashboard</span>
          </CommandItem>

          <CommandItem
            onSelect={() => runCommand(() => navigate(isInstructor ? '/instructor/courses' : '/lessons'))}
          >
            <BookOpen className="mr-2.5 h-4 w-4 text-sky-500" />
            <span>{isInstructor ? 'Courses & Outline Management' : 'Lessons & Learning Modules'}</span>
          </CommandItem>

          <CommandItem
            onSelect={() => runCommand(() => navigate(isInstructor ? '/instructor/quizzes' : '/quizzes'))}
          >
            <GraduationCap className="mr-2.5 h-4 w-4 text-emerald-500" />
            <span>Quizzes & Assessments</span>
          </CommandItem>

          <CommandItem
            onSelect={() => runCommand(() => navigate(isInstructor ? '/instructor/laboratories' : '/laboratories'))}
          >
            <Beaker className="mr-2.5 h-4 w-4 text-amber-500" />
            <span>Laboratories & Workspaces</span>
          </CommandItem>

          <CommandItem
            onSelect={() =>
              runCommand(() => navigate(isInstructor ? '/instructor/messages' : '/chatbox'))
            }
          >
            <MessageSquare className="mr-2.5 h-4 w-4 text-pink-500" />
            <span>Messages & Announcements</span>
          </CommandItem>
        </CommandGroup>

        {/* Instructor Specific Actions */}
        {isInstructor && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Instructor Studio">
              <CommandItem onSelect={() => runCommand(() => navigate('/instructor/quiz/create-auto'))}>
                <Sparkles className="mr-2.5 h-4 w-4 text-violet-400" />
                <span className="font-semibold text-violet-500">AI Auto-Generate Quiz</span>
              </CommandItem>

              <CommandItem onSelect={() => runCommand(() => navigate('/instructor/quiz/create-manual'))}>
                <FileText className="mr-2.5 h-4 w-4 text-slate-400" />
                <span>Create Quiz Manually</span>
              </CommandItem>

              <CommandItem onSelect={() => runCommand(() => navigate('/instructor/student-performance'))}>
                <Users className="mr-2.5 h-4 w-4 text-teal-400" />
                <span>View All Students (Quiz & Lab Records)</span>
              </CommandItem>

              <CommandItem onSelect={() => runCommand(() => navigate('/instructor/student-approvals'))}>
                <UserCheck className="mr-2.5 h-4 w-4 text-blue-400" />
                <span>Student Approvals</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        {/* System & Preferences */}
        <CommandGroup heading="Preferences & System">
          <CommandItem onSelect={() => runCommand(toggleTheme)}>
            {theme === 'dark' ? (
              <Sun className="mr-2.5 h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="mr-2.5 h-4 w-4 text-slate-400" />
            )}
            <span>Switch to {theme === 'dark' ? 'Light' : 'Dark'} Mode</span>
          </CommandItem>

          <CommandItem
            onSelect={() =>
              runCommand(() =>
                navigate(isInstructor ? '/instructor/settings' : isAdmin ? '/admin/settings' : '/settings')
              )
            }
          >
            <Settings className="mr-2.5 h-4 w-4 text-slate-400" />
            <span>Account Settings</span>
          </CommandItem>

          <CommandItem
            onSelect={() =>
              runCommand(() => {
                logout();
                navigate('/login');
              })
            }
            className="text-rose-500 hover:text-rose-600 focus:text-rose-600"
          >
            <LogOut className="mr-2.5 h-4 w-4 text-rose-500" />
            <span>Sign Out</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
export default CommandPalette;

