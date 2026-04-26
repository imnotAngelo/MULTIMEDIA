import { Bell, Search, Sparkles, LogOut as LogOutIcon, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { authFetch } from '@/lib/authFetch';
import { useNavigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';

interface HeaderProps {
  title?: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { user, logout } = useAuthStore();
  const notifications = useNotificationStore((state) => state.notifications);
  const unreadCount = useNotificationStore((state) => state.getUnreadCount());
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const markAllRead = useNotificationStore((state) => state.markAllRead);
  const setFromApi = useNotificationStore((state) => state.setFromApi);
  const navigate = useNavigate();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = async () => {
    try {
      const res = await authFetch('/notifications');
      if (res.ok) {
        const rows = await res.json();
        setFromApi(rows);
      } else {
        const text = await res.text().catch(() => '');
        console.error('[notify] Fetch failed:', res.status, text);
      }
    } catch (err) {
      console.error('[notify] Fetch error:', err);
    }
  };

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    fetchNotifications();
    pollRef.current = setInterval(fetchNotifications, 30_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleMarkAllRead = async () => {
    markAllRead();
    try {
      await authFetch('/notifications/read-all', { method: 'PATCH' });
    } catch {
      // Silent
    }
  };

  const handleMarkOneRead = async (id: string) => {
    markAsRead(id);
    try {
      await authFetch(`/notifications/${id}/read`, { method: 'PATCH' });
    } catch {
      // Silent
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'lesson':     return <span className="text-lg">📖</span>;
      case 'unit':       return <span className="text-lg">📚</span>;
      case 'quiz':       return <span className="text-lg">📝</span>;
      case 'lab':        return <span className="text-lg">🧪</span>;
      case 'assignment': return <span className="text-lg">✏️</span>;
      case 'achievement':return <span className="text-lg">🎉</span>;
      case 'announcement': return <span className="text-lg">📢</span>;
      default:           return <Sparkles className="w-4 h-4 text-yellow-400" />;
    }
  };

  /**
   * Map notification type → destination route based on the user's role.
   * Returns null if there's no sensible destination.
   */
  const getNotificationDestination = (type: string): string | null => {
    const isInstructor = user?.role === 'instructor';
    switch (type) {
      case 'announcement':
        return isInstructor ? '/instructor/announcements' : '/announcements';
      case 'lesson':
      case 'unit':
        return isInstructor ? '/instructor/courses' : '/lessons';
      case 'quiz':
        return isInstructor ? '/instructor/quizzes' : '/quizzes';
      case 'lab':
        return isInstructor ? '/instructor/laboratories' : '/laboratories';
      case 'assignment':
        return isInstructor ? '/instructor/assessments' : '/assessments';
      case 'achievement':
        return isInstructor ? null : '/achievements';
      default:
        return null;
    }
  };

  const handleNotificationClick = (notification: { id: string; type: string }) => {
    // Mark as read locally + on the server
    handleMarkOneRead(notification.id);
    // Navigate to the relevant page
    const dest = getNotificationDestination(notification.type);
    if (dest) navigate(dest);
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return `${days} day${days > 1 ? 's' : ''} ago`;
  };

  return (
    <header className="h-14 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-30">
      {/* Left Section */}
      <div className="flex items-center gap-4">
        {title && (
          <div>
            <h1 className="text-xl font-semibold text-white">{title}</h1>
            {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
          </div>
        )}
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="hidden md:flex items-center relative">
          <Search className="absolute left-3 w-4 h-4 text-slate-400" />
          <Input
            type="search"
            placeholder="Search..."
            className="w-64 pl-10 bg-slate-800/50 border-slate-700 text-slate-200 placeholder:text-slate-500 focus-visible:ring-violet-500"
          />
        </div>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative text-slate-400 hover:text-slate-100"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 bg-slate-900 border-slate-800">
            <DropdownMenuLabel className="flex items-center justify-between text-slate-200">
              <span>Notifications {unreadCount > 0 && <span className="text-red-400">({unreadCount})</span>}</span>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 font-normal"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-800" />
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-slate-400">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <DropdownMenuItem
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`flex flex-col items-start gap-1 p-3 cursor-pointer hover:bg-slate-800 ${
                      !notification.read ? 'bg-slate-800/50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 w-full">
                      {getNotificationIcon(notification.type)}
                      <span className="text-sm font-medium text-slate-200 flex-1 leading-tight">{notification.title}</span>
                      {!notification.read && (
                        <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-slate-400 leading-snug">{notification.message}</p>
                    {notification.attachmentUrl && (
                      <a
                        href={notification.attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 mt-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs text-amber-400 hover:text-amber-300 transition-colors"
                      >
                        📎 {notification.attachmentName ?? 'View attachment'}
                      </a>
                    )}
                    <span className="text-xs text-slate-500">{formatTime(notification.timestamp)}</span>
                  </DropdownMenuItem>
                ))
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                <span className="text-white font-semibold text-sm">
                  {user?.full_name?.charAt(0).toUpperCase() || 'S'}
                </span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-slate-900 border-slate-800">
            <DropdownMenuLabel className="text-slate-200">
              <div className="flex flex-col">
                <span>{user?.full_name || 'Student'}</span>
                <span className="text-xs text-slate-400 font-normal">{user?.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-800" />
            <DropdownMenuItem className="text-slate-300 hover:text-slate-100 hover:bg-slate-800 cursor-pointer">
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="text-slate-300 hover:text-slate-100 hover:bg-slate-800 cursor-pointer">
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-800" />
            <DropdownMenuItem 
              onClick={handleLogout}
              className="text-red-400 hover:text-red-300 hover:bg-slate-800 cursor-pointer"
            >
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
